#!/usr/bin/env python3
"""Injecte data/situation.json dans prototype/template.html pour produire prototype/index.html (page autonome).

Usage : python3 scripts/build_prototype.py data/situation.json prototype/template.html prototype/index.html
"""
import json
import sys

data = json.load(open(sys.argv[1], encoding='utf-8'))
slim = {'source': data['source'], 'groups': data['groups'], 'hypotheses': data.get('hypotheses', {}), 'floors': {}}
for f, fl in data['floors'].items():
    slim['floors'][f] = {'label': fl['label'], 'cells': [c for c in fl['cells'] if c['t'] in ('seat', 'wall', 'office', 'room', 'green', 'free', 'free_m')]}
template = open(sys.argv[2], encoding='utf-8').read()
page = template.replace('/*__DATA__*/', json.dumps(slim, ensure_ascii=False, separators=(',', ':')))
open(sys.argv[3], 'w', encoding='utf-8').write(page)
print('écrit', sys.argv[3], len(page), 'octets')
