# PrestigePlaces

Étude et maquette pour une application de dispatching des positions de travail sur le site Sofrecom de Tunis : 5 niveaux, 5 directions opérationnelles, télétravail partiel, règle d'équité unique (même taux de places par personne pour chaque direction). Déclencheur : libérer le centre du RDC, occupé par l'équipe BLI, pour en faire une salle de formation.

## Contenu

| Chemin | Rôle |
| --- | --- |
| `docs/etude-dispatching.md` | L'étude complète : contexte, analyse du classeur, besoins, règles d'équité, algorithme, architecture, feuille de route, risques |
| `prototype/index.html` | Maquette interactive autonome (plans des 5 niveaux, paramètres modifiables, proposition de dispatching). S'ouvre dans un navigateur sans serveur |
| `prototype/template.html` | Source de la maquette, sans données ; `/*__DATA__*/` est remplacé à la construction |
| `data/situation.json` | Plans d'étage et effectifs agrégés extraits du classeur « Situation 7 » (aucune donnée nominative) |
| `scripts/extract_situation.py` | Extrait plans et agrégats d'un classeur « Situation » (openpyxl) |
| `scripts/build_prototype.py` | Injecte les données dans le gabarit pour produire la page autonome |

Le document de référence de l'étude, avec graphiques et schémas, est partagé ici :
https://claude.ai/code/artifact/f9f228c2-59e9-4931-929e-07c42da3c8eb

La maquette est aussi publiée en ligne (privée tant qu'elle n'est pas partagée) :
https://claude.ai/artifact/S5dwPRLWJgmsrA7WN6uZsA

## Reconstruire la maquette à partir d'un nouveau classeur

```bash
pip install openpyxl
python3 -I scripts/extract_situation.py Situation.xlsx data/situation.json
python3 scripts/build_prototype.py data/situation.json prototype/template.html prototype/index.html
```

Les classeurs RH nominatifs ne doivent pas être versionnés (`*.xlsx` est ignoré par git).

## Règle d'équité implémentée dans la maquette

```
quota(direction) = positions à répartir × effectif cible(direction) / Σ effectifs cibles
effectif cible   = CDI + consultants externes + recrutements à venir
positions à répartir = toutes les positions hors fonctions support, moins la réserve
```

Les quotas sont arrondis au plus fort reste. La répartition par niveau est un flot à coût minimal (au plus un nouveau niveau par direction), puis les positions sont choisies au bord des équipes qui cèdent et au plus près des équipes qui reprennent. La version cible décrite dans l'étude utilise un solveur CP-SAT (OR-Tools).

## Pilotage par l'IA

Le projet est conçu pour être géré de bout en bout par Claude Code : `CLAUDE.md` porte les règles métier et les conventions, `.claude/` porte le harnais.

| Élément | Rôle |
| --- | --- |
| `data/hypotheses.json` | Source unique des hypothèses (effectifs, externes, recrutements, réserve, zones à libérer). Une instruction donnée en session se traduit par une modification de ce fichier |
| `.claude/hooks/on-hypotheses-change.sh` | À chaque modification de `data/hypotheses.json` : régénère `data/situation.json`, reconstruit la maquette, réensemence l'application |
| `.claude/hooks/session-start.sh` | Installe les dépendances de l'application et prépare la base en session cloud |
| `.claude/skills/` | `/hypotheses` (appliquer une hypothèse), `/maquette` (reconstruire et republier), `/etude` (mettre à jour l'étude), `/lot` (lancer un lot d'implémentation), `/steward` (conduite des PR) |
| `.claude/agents/` | Agents spécialisés avec routage de modèle : `engine-dev` et `qa-reviewer` (opus), `ui-dev` et `data-dev` (sonnet), `doc-writer` (haiku) |
| `.claude/workflows/` | Workflows multi-agents : `lot1-implementation.js`, `apply-hypotheses.js`, `review-changes.js` |
| `.github/workflows/ci.yml` | CI : régénération depuis les hypothèses, logique de la maquette, lint, typecheck, tests et build de l'application |

Appliquer une hypothèse à la main :

```bash
# modifier data/hypotheses.json, puis
python3 -I scripts/apply_hypotheses.py        # situation.json + maquette, affiche les quotas
node scripts/test_prototype.js prototype/index.html
```

## Application (lot 1)

L'application de dispatching est dans `app/` (Next.js, TypeScript strict, Prisma : SQLite en développement, PostgreSQL en production). Elle reprend la règle d'équité de l'étude : quotas par direction, répartition par niveau, plans interactifs, scénarios comparables, import des fichiers RH et SIRH. La documentation complète (installation, variables d'environnement, base de données, tests, comptes de développement, limites connues et lot 2) est dans [`app/README.md`](app/README.md).

Commandes principales, depuis `app/` :

```bash
npm install                 # installe les dépendances et génère le client Prisma
cp .env.example .env        # configuration locale (ignorée par git)
npm run db:push             # crée la base SQLite (prisma/dev.db)
npm run db:seed             # charge le site Tunis et le scénario « Situation 7 (classeur) »
npm run dev                 # http://localhost:3000
npm run typecheck && npm run lint && npm test   # vérifications unitaires
npm run e2e                 # bout en bout sur une base dédiée (prisma/e2e.db), port 3210
```

Production : `DB_PROVIDER=postgresql` et `DATABASE_URL=postgresql://…` dans `.env`, puis `npm run db:generate` et `npm run db:push`. Les fichiers RH et les bases locales ne sont jamais versionnés.
