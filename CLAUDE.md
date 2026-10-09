# PrestigePlaces — mémoire du projet

Application de dispatching des positions de travail du site Sofrecom de Tunis (5 niveaux, 5 directions opérationnelles, télétravail partiel). Le projet est piloté par l'IA : toute instruction donnée dans une session Claude Code doit finir dans le dépôt (données, maquette, application, étude), vérifiée et commitée.

## Où sont les choses

| Chemin | Rôle |
| --- | --- |
| `data/hypotheses.json` | **Source unique des hypothèses** : CDI par groupe, externes, recrutements (source SIRH ou MAIL_CLIENT), règles (réserve, fenêtre des recrutements, support hors équation), zones à libérer |
| `data/situation.json` | Plans des 5 niveaux (cellules) + groupes ; **généré** par `scripts/apply_hypotheses.py` à partir des hypothèses, lu par la maquette et par le seed de l'application |
| `prototype/template.html` → `prototype/index.html` | Maquette autonome (plans 2D, vue 3D, paramètres, proposition). `index.html` est **généré**, ne pas l'éditer à la main |
| `app/` | Application Next.js + Prisma (lot 1). Voir `app/README.md` |
| `docs/etude-dispatching.md` | Étude (miroir markdown du document Claude) |
| `scripts/` | Extraction du classeur, application des hypothèses, construction et contrôle de la maquette |
| `.claude/` | Harnais : permissions, hooks, skills, agents, workflows |

Document de référence de l'étude : https://claude.ai/code/artifact/f9f228c2-59e9-4931-929e-07c42da3c8eb
Maquette publiée : https://claude.ai/artifact/S5dwPRLWJgmsrA7WN6uZsA (republier avec l'outil Artifact, paramètre `url`, après chaque reconstruction)

## Règles métier figées (ne pas réinterpréter)

- Périmètre : site de Tunis, directions AMMAR, BOUBAKER, ZEINEB, AMINE, BEJI. Les fonctions support (groupe SUP) et leurs positions sont hors équation et ne bougent jamais.
- Effectif cible d'une direction = CDI + consultants externes + recrutements retenus. Recrutements retenus = ouverts dans le SIRH ou déclarés officiellement par le client par mail sur la fenêtre `recruitWindowMonths` (3 mois).
- Quota = positions à répartir × effectif cible / somme des effectifs cibles, arrondi au plus fort reste, jamais inférieur aux postes fixes. Positions à répartir = toutes les positions hors SUP, moins la réserve.
- Postes fixes (directeur, manager) ne changent jamais de direction. Même hypothèse de télétravail pour toutes les équipes.
- Le centre du RDC (39 positions, ex-BLI) est une zone à libérer : salle de formation, jamais affectée.
- Toutes les valeurs restent paramétrables dans l'application et dans la maquette.
- Correspondance groupes → directions : BLI, SN3, AMMAR AUTRES → AMMAR ; AGAL → BOUBAKER ; Z → ZEINEB ; AMINE → AMINE ; OMEA, PFS, BEJI AUTRES → BEJI ; SUP → SUPPORT ; V → vide.

## Quand l'utilisateur donne une nouvelle hypothèse (effectifs, externes, recrutements, réserve, zones)

Suivre le skill `/hypotheses` : modifier `data/hypotheses.json` (jamais `situation.json` à la main), laisser le hook reconstruire la maquette et réensemencer l'application, vérifier les quotas affichés, republier la maquette, mettre à jour l'étude (document Claude + markdown), commiter et pousser. Une instruction donnée dans la conversation vaut décision : pas de question de confirmation, sauf si deux lectures donnent des résultats différents.

## Vérifications avant tout commit

```bash
python3 -I scripts/apply_hypotheses.py            # régénère situation.json + maquette, affiche les quotas
node scripts/test_prototype.js prototype/index.html # logique de la maquette (quotas, mouvements)
cd app && npm run lint && npm run typecheck && npm test && npm run build   # application, si app/ existe
```

Résultats de référence (hypothèses du 30/09/2026) : quotas AMMAR 204, BOUBAKER 137, ZEINEB 294, AMINE 195, BEJI 217 ; 69 positions changent de direction.

## Conventions

- Interface, documentation et messages de commit en français. Code TypeScript strict, Python sans dépendance hors `openpyxl`.
- Aucune donnée nominative dans le dépôt : pas de classeur RH (`*.xlsx` ignoré), pas de noms dans `data/`. L'import RH tourne dans l'application, pas dans git.
- Ne jamais commiter `app/.env`, `app/dev.db`, `node_modules`, `.next`.
- Commits petits et descriptifs ; la branche de travail est celle de la session ; pousser après chaque étape vérifiée.
- Les figures de l'étude (tableaux, graphiques) doivent rester cohérentes avec `data/hypotheses.json` : après un changement d'hypothèse, mettre à jour la section Analyse et la synthèse.

## Routage des modèles (sous-agents et workflows)

| Tâche | Modèle | Effort |
| --- | --- | --- |
| Moteur de dispatching, règles métier, sécurité et authentification, architecture, revue finale | opus | high |
| Écrans, services, import, scripts, corrections ciblées | sonnet | medium |
| Documentation, renommages, mise en forme, changelog | haiku | low |

Les agents de `.claude/agents/` portent déjà ce routage ; les workflows de `.claude/workflows/` l'appliquent par tâche.

## Ce qu'il ne faut jamais faire

- Modifier `prototype/index.html` ou `data/situation.json` directement (fichiers générés).
- Réaffecter une position SUP, une position à libérer ou un poste fixe dans une proposition.
- Changer la règle d'équité ou le périmètre sans instruction explicite de l'utilisateur.
- Lancer `playwright install` (Chromium est préinstallé, `PLAYWRIGHT_BROWSERS_PATH` est défini).
