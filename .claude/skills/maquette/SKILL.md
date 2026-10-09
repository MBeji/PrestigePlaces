---
name: maquette
description: Reconstruit, contrôle et republie la maquette interactive (prototype/index.html) après une modification du gabarit, des données ou des hypothèses. Utiliser pour toute demande visuelle sur la maquette (plans 2D, vue 3D, légende, écrans).
---

# Maquette

- Source : `prototype/template.html` (HTML, CSS et JavaScript, données injectées à la place de `/*__DATA__*/`). `prototype/index.html` est généré.
- Reconstruire : `python3 -I scripts/build_prototype.py data/situation.json prototype/template.html prototype/index.html` (ou `python3 -I scripts/apply_hypotheses.py`, qui reconstruit aussi).
- Contrôler la logique : `node scripts/test_prototype.js prototype/index.html` (quotas de référence : 204 / 137 / 294 / 195 / 217, 69 mouvements).
- Contrôler le rendu : `NODE_PATH=/opt/node22/lib/node_modules node scripts/check_prototype.js prototype/index.html /tmp/pp-shots` puis regarder les captures (bureau, mobile, sombre) ; aucun défilement horizontal à 400 px, aucune erreur console.
- Republier : outil Artifact avec `file_path` = `prototype/index.html` et `url` = https://claude.ai/artifact/S5dwPRLWJgmsrA7WN6uZsA (même adresse, l'icône est conservée).
- Contraintes de la page publiée : scripts externes uniquement depuis cdnjs.cloudflare.com (versions épinglées), pas de téléchargement, pas d'iframe, thèmes clair et sombre par variables CSS, interface en français.
- Les couleurs des directions sont fixes (voir `:root` du gabarit) et identiques dans l'étude et l'application.
