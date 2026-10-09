#!/usr/bin/env python3
"""Contrôle de confidentialité : refuse les fichiers suivis par git qui contiendraient des données personnelles
ou des secrets d'entreprise. Autorisés : prénoms des directeurs, noms des projets et des équipes.

Usage : python3 scripts/check_privacy.py   (code de retour 1 si un problème est trouvé)
"""
import re
import subprocess
import sys

FORBIDDEN_EXT = ('.xlsx', '.xlsm', '.xls', '.csv', '.tsv', '.db', '.sqlite', '.pem', '.key', '.p12')
ALLOWED_EMAILS = {'noreply@anthropic.com'}
PATTERNS = [
    (re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'), 'adresse e-mail'),
    (re.compile(r'AKIA[0-9A-Z]{16}'), 'clé AWS'),
    (re.compile(r'(?i)(client_secret|api[_-]?key|password|mot de passe)\s*[:=]\s*["\']?[A-Za-z0-9/+_\-]{12,}'), 'secret en clair'),
    (re.compile(r'(?i)\b(matricule|cuid)\s*[:=;,]\s*\d{2,}'), 'identifiant RH'),
    (re.compile(r'(?i)date d.embauche\s*[:=;,]\s*\d'), 'date d\'embauche'),
    (re.compile(r'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'), 'jeton JWT'),
]
SKIP_DIRS = ('app/node_modules/', 'app/.next/')

files = subprocess.run(['git', 'ls-files', '-z'], capture_output=True, check=True).stdout.decode().split('\0')
problems = []
for path in filter(None, files):
    if path.startswith(SKIP_DIRS):
        continue
    if path.lower().endswith(FORBIDDEN_EXT):
        problems.append(f'{path}: type de fichier interdit (données brutes ou secret)')
        continue
    try:
        text = open(path, encoding='utf-8', errors='ignore').read()
    except OSError:
        continue
    for rx, label in PATTERNS:
        for m in rx.finditer(text):
            if label == 'adresse e-mail' and (m.group(0).lower() in ALLOWED_EMAILS or m.group(0).endswith(('example.com', 'example.org'))):
                continue
            line = text.count('\n', 0, m.start()) + 1
            problems.append(f'{path}:{line}: {label} ({m.group(0)[:40]})')
if problems:
    print('Contrôle de confidentialité : problèmes trouvés')
    print('\n'.join(problems))
    sys.exit(1)
print(f'Contrôle de confidentialité : OK ({len([f for f in files if f])} fichiers suivis)')
