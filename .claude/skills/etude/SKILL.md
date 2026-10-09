---
name: etude
description: Met à jour l'étude PrestigePlaces (document Claude partagé et son miroir docs/etude-dispatching.md) après une décision, une nouvelle hypothèse ou une évolution de l'application. Utiliser pour toute demande portant sur l'étude, ses chiffres, ses graphiques ou ses sections.
---

# Mettre à jour l'étude

Deux supports à garder synchrones :

1. Le document Claude (référence, avec graphiques et schémas) : https://claude.ai/code/artifact/f9f228c2-59e9-4931-929e-07c42da3c8eb. Le modifier avec les outils du connecteur Claude Docs : `read` (outline) puis `update` avec des cibles `find` sur les phrases exactes ; les graphiques (écarts par direction, positions par niveau) sont des widgets dont les lignes de données doivent être réécrites quand les chiffres changent (`draft` + `publish`).
2. Le miroir markdown `docs/etude-dispatching.md` : mêmes sections, mêmes chiffres, tableaux à la place des graphiques.

Chiffres à recalculer après un changement d'hypothèse (dans cet ordre) : effectifs cibles par direction, positions à répartir, taux commun, quotas, écarts, positions qui changent de direction, niveaux avant → après, postes partagés et taux de présence moyen maximal. Les valeurs sortent de `python3 -I scripts/apply_hypotheses.py` et de `node scripts/test_prototype.js prototype/index.html`.

Sections concernées selon le changement :

| Changement | Sections |
| --- | --- |
| Effectifs, externes, recrutements | Synthèse, Analyse (tableau, graphique des écarts), Règles d'équité (tableau des postes partagés), Risques (ligne Acceptation) |
| Réserve, fenêtre des recrutements, zones | Règles d'équité (paramètres), Analyse (constats), Décisions de conception |
| Nouvelle décision de conception | Risques : bloc « Décisions de conception » |
| Évolution de l'application ou de la maquette | Besoins fonctionnels, Maquette interactive, Feuille de route |

Style : phrases courtes, chiffres avec espace insécable pour les milliers (1 047), pourcentages avec une décimale, vocabulaire du projet (positions, directions, quota, îlot, zone à libérer).
