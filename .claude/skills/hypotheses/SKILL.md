---
name: hypotheses
description: Applique une nouvelle hypothèse sur les places (effectifs CDI, consultants externes, recrutements, réserve, zones à libérer, règles) à la maquette, à l'application et à l'étude. Utiliser dès que l'utilisateur énonce un chiffre ou une règle sur les positions, les directions ou les recrutements, même sans le mot « hypothèse ».
---

# Appliquer une hypothèse

Source unique : `data/hypotheses.json`. Tout le reste (situation.json, maquette, base de l'application) en découle.

## Procédure

1. Lire `data/hypotheses.json` et traduire l'instruction en modifications précises (tableau ci-dessous). Une instruction vaut décision : ne pas demander confirmation, sauf si deux lectures donnent des résultats différents (alors poser une seule question courte).
2. Modifier `data/hypotheses.json` avec l'outil Edit (jamais `situation.json`, jamais `prototype/index.html`). Le hook PostToolUse régénère `data/situation.json` et `prototype/index.html`, réensemence `app/` et renvoie les quotas calculés.
3. Vérifier : `node scripts/test_prototype.js prototype/index.html` (quotas, mouvements, niveaux par direction). Si l'application existe : `cd app && npm test`.
4. Republier la maquette : outil Artifact, `file_path` = `prototype/index.html`, `url` = https://claude.ai/artifact/S5dwPRLWJgmsrA7WN6uZsA.
5. Mettre à jour l'étude (skill `/etude`) : section Analyse (tableau et graphiques), Synthèse, Risques si la décision en change un ; puis `docs/etude-dispatching.md`.
6. Commiter (`git add data docs prototype && git commit`) avec un message qui cite l'hypothèse, puis pousser.
7. Répondre en trois lignes : l'hypothèse appliquée, les quotas qui changent (direction, avant → après), les liens (maquette, étude).

## Traduction des instructions

| Instruction (exemples) | Champ dans `data/hypotheses.json` |
| --- | --- |
| « Zeineb recrute 10 personnes en janvier, ouvert dans le SIRH » | `directions.ZEINEB.groups.Z.recrutements` : ajouter `{count: 10, source: "SIRH", expectedDate: "2027-01", reference: "..."}` |
| « le client a confirmé par mail 5 renforts chez Béji PFS » | `directions.BEJI.groups.PFS.recrutements` avec `source: "MAIL_CLIENT"` |
| « les externes d'Amine passent à 12 » | `directions.AMINE.groups.AMINE.externes = 12` |
| « 3 départs chez Boubaker » | `directions.BOUBAKER.groups.AGAL.cdi.c` diminué de 3 (ou `m`/`d` si précisé) |
| « garde 2 % de réserve » | `rules.reservePct = 2` |
| « fenêtre des recrutements à 6 mois » | `rules.recruitWindowMonths = 6` |
| « on libère aussi l'îlot X de l'étage 2 » | `zonesToFree` : ajouter `{floor, label, cells/îlot, positions}` puis adapter `scripts/apply_hypotheses.py` et la maquette si le type de zone est nouveau |
| « nouveau effectif CDI Tunis : fichier RH » | lancer `scripts/extract_situation.py` sur le classeur, puis reporter les `cdi` par groupe dans `hypotheses.json` ; ne jamais commiter le classeur |

Les effectifs d'une direction sont la somme de ses groupes ; un chiffre donné « pour la direction » sans groupe va dans le groupe principal (AMMAR AUTRES, AGAL, Z, AMINE, BEJI AUTRES) sauf indication contraire.

## Garde-fous

- Les positions du support (SUP), les postes fixes et la zone à libérer du RDC ne bougent jamais.
- Après application, la somme des quotas doit valoir les positions à répartir ; sinon, signaler l'anomalie au lieu de la masquer.
- Ne pas inventer de chiffre : une valeur absente de l'instruction reste celle du fichier.
