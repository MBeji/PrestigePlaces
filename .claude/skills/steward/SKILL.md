---
name: steward
description: Conventions pour conduire une pull request de PrestigePlaces jusqu'au vert (CI, revue, conflits). Lu avant d'agir sur un événement de PR.
---

# Conduite des pull requests

- Vérifications locales avant tout push : `python3 -I scripts/apply_hypotheses.py`, `node scripts/test_prototype.js prototype/index.html`, et dans `app/` : `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. La CI (`.github/workflows/ci.yml`) exécute les mêmes commandes.
- Un échec de CI sur l'application se corrige dans `app/` ; un échec sur la maquette se corrige dans `prototype/template.html` ou `scripts/`, jamais dans `prototype/index.html`.
- Conflits : fusionner la branche de base (merge, pas de rebase sur une branche partagée) ; régénérer `prototype/index.html` et `data/situation.json` avec les scripts après la fusion.
- Commentaires de revue : appliquer les demandes locales (nommage, test, petite refactorisation) ; pour une demande de conception (règle métier, modèle de données), proposer dans le fil et laisser l'auteur décider.
- Ne jamais : désactiver un test, commiter un classeur RH ou un `.env`, pousser en force, changer une règle métier figée de `CLAUDE.md`.
- Niveau de proactivité : élevé. Une PR rouge est du travail à faire immédiatement ; une PR verte attend ses relecteurs.
