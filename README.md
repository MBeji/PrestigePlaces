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
