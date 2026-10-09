---
name: lot
description: Lance un lot d'implémentation PrestigePlaces sous forme de workflow multi-agents avec routage du modèle par tâche (opus pour le cœur métier et la sécurité, sonnet pour les écrans et services, haiku pour la documentation). Utiliser quand l'utilisateur demande d'implémenter un lot, une fonctionnalité transverse ou de relancer le workflow.
---

# Lancer un lot

1. Lire `CLAUDE.md` (règles métier, routage) et l'état de `app/` (`app/README.md`, `npm test`).
2. Choisir le script : `.claude/workflows/lot1-implementation.js` (socle complet), `.claude/workflows/apply-hypotheses.js` (propagation d'hypothèses en plusieurs agents), `.claude/workflows/review-changes.js` (revue adverse du diff), ou en écrire un nouveau sur le même modèle : tâches déclarées avec `complexity` et `risk`, fonction `route()` qui en déduit `model` et `effort`, phases explicites, résultats structurés (`status`, `summary`, `files`, `checks`, `api`, `notes`).
3. Lancer avec l'outil Workflow (`scriptPath`), suivre `/workflows`, ne pas attendre activement.
4. À la fin : lire le bilan, lancer les vérifications de `CLAUDE.md`, commiter par étape, pousser, mettre à jour `app/README.md` et l'étude (sections Maquette, Feuille de route).

Règles pour les agents du workflow : dossiers disjoints par agent, pas de commit par les agents, `package.json`, `schema.prisma` et `layout.tsx` réservés à l'agent de socle ou de données, jamais `playwright install`.
