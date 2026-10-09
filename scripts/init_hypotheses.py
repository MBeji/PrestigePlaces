#!/usr/bin/env python3
"""Crée data/hypotheses.json (source unique des hypothèses) à partir de data/situation.json. À lancer une seule fois.

Usage : python3 scripts/init_hypotheses.py data/situation.json data/hypotheses.json
"""
import json
import sys

situation = json.load(open(sys.argv[1], encoding='utf-8'))
DIR_LABEL = {'AMMAR': 'Ammar', 'BOUBAKER': 'Boubaker', 'ZEINEB': 'Zeineb', 'AMINE': 'Amine', 'BEJI': 'Béji', 'SUPPORT': 'Fonctions support'}
directions = {}
for code, g in situation['groups'].items():
    d = directions.setdefault(g['direction'], {'label': DIR_LABEL.get(g['direction'], g['direction']), 'inEquation': g['direction'] != 'SUPPORT', 'groups': {}})
    rec = [{'count': g['recrutements'], 'source': 'SIRH', 'expectedDate': None, 'reference': 'Projection de croissance du classeur'}] if g['recrutements'] else []
    d['groups'][code] = {'label': g['label'], 'cdi': dict(g['cdi']), 'externes': g['externes'], 'recrutements': rec}
hyp = {
    'version': 1,
    'asOf': '2026-09-30',
    'site': 'Tunis',
    'source': situation.get('source', ''),
    'rules': {
        'equity': 'quota(direction) = positions à répartir × effectif cible / somme des effectifs cibles, arrondi au plus fort reste',
        'targetHeadcount': 'CDI + consultants externes + recrutements retenus',
        'supportInEquation': False,
        'teleworkHypothesis': 'uniform',
        'recruitmentRule': 'recrutements ouverts dans le SIRH ou déclarés officiellement par le client par mail sur recruitWindowMonths',
        'recruitWindowMonths': 3,
        'reservePct': 0,
        'maxFloorsPerDirection': 2,
    },
    'zonesToFree': [
        {'floor': 'RDC', 'label': 'Salle de formation', 'cells': 'free', 'positions': 39, 'reason': 'zone occupée par BLI, libérée pour la salle de formation'}
    ],
    'directions': directions,
}
json.dump(hyp, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('écrit', sys.argv[2])
