#!/usr/bin/env python3
"""Applique data/hypotheses.json (source unique) à data/situation.json, puis reconstruit la maquette.

Usage : python3 scripts/apply_hypotheses.py [data/hypotheses.json] [data/situation.json]
Affiche l'effectif cible et le quota équitable par direction pour contrôle.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
hyp_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data', 'hypotheses.json')
sit_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'data', 'situation.json')
hyp = json.load(open(hyp_path, encoding='utf-8'))
sit = json.load(open(sit_path, encoding='utf-8'))

# 1. groupes : effectifs, externes, recrutements retenus
for dcode, d in hyp['directions'].items():
    for gcode, g in d['groups'].items():
        target = sit['groups'].setdefault(gcode, {'label': g.get('label', gcode), 'direction': dcode})
        target['label'] = g.get('label', target.get('label', gcode))
        target['direction'] = dcode
        target['cdi'] = {k: int(g['cdi'].get(k, 0)) for k in 'dmc'}
        target['externes'] = int(g.get('externes', 0))
        target['recrutements'] = int(sum(int(r.get('count', 0)) for r in g.get('recrutements', [])))
        target['recrutementsDetail'] = g.get('recrutements', [])
sit['hypotheses'] = {'asOf': hyp.get('asOf'), 'rules': hyp['rules'], 'zonesToFree': hyp.get('zonesToFree', []),
                     'directions': {k: {'label': v['label'], 'inEquation': v.get('inEquation', True)} for k, v in hyp['directions'].items()}}
json.dump(sit, open(sit_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
# copie embarquée par l'application (déploiement Vercel avec app/ comme racine)
app_copy = os.path.join(ROOT, 'app', 'prisma', 'situation.json')
if os.path.isdir(os.path.dirname(app_copy)):
    json.dump(sit, open(app_copy, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

# 2. contrôle : quotas équitables
positions = {}
for f, fl in sit['floors'].items():
    for c in fl['cells']:
        if c['t'] == 'seat':
            positions[c['g']] = positions.get(c['g'], 0) + 1
support = sum(n for g, n in positions.items() if sit['groups'].get(g, {}).get('direction') == 'SUPPORT')
pool = sum(positions.values()) - support
reserve = round(pool * float(hyp['rules'].get('reservePct', 0)) / 100)
alloc = pool - reserve
N = {}
for dcode, d in hyp['directions'].items():
    if not d.get('inEquation', True):
        continue
    N[dcode] = sum(sum(g['cdi'].values()) + g.get('externes', 0) + sum(r.get('count', 0) for r in g.get('recrutements', [])) for g in d['groups'].values())
tot = sum(N.values())
raw = {d: n * alloc / tot for d, n in N.items()}
quota = {d: int(v) for d, v in raw.items()}
for d, _ in sorted(raw.items(), key=lambda kv: kv[1] - int(kv[1]), reverse=True)[: alloc - sum(quota.values())]:
    quota[d] += 1
print(f"positions à répartir {alloc} (réserve {reserve}) · effectif cible {tot} · taux commun {alloc / tot * 100:.1f} %")
for d in N:
    current = sum(n for g, n in positions.items() if sit['groups'].get(g, {}).get('direction') == d)
    print(f"  {d:9s} effectif {N[d]:4d}  positions {current:4d}  quota {quota[d]:4d}  écart {quota[d] - current:+d}")

# 3. maquette
subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'scripts', 'build_prototype.py'), sit_path,
                os.path.join(ROOT, 'prototype', 'template.html'), os.path.join(ROOT, 'prototype', 'index.html')], check=True)
