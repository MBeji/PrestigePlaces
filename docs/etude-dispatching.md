# Étude PrestigePlaces – Dispatching des places

*Site de Tunis · effectifs au 30/09/2026 · version du 09/10/2026*

Version de travail de l'étude. La version de référence, avec ses graphiques et ses schémas, est le document Claude partagé :
https://claude.ai/code/artifact/f9f228c2-59e9-4931-929e-07c42da3c8eb

## Synthèse

Hors fonctions support, le site de Tunis offre 1 047 positions pour 1 334 personnes à loger dans les cinq directions opérationnelles : 1 292 CDI au 30/09/2026, 31 recrutements et 11 consultants externes prévus. Cela fait 78,5 % de places par personne, et la règle d'équité retenue donne ce même taux à chaque direction. Aujourd'hui, le taux va de 66 % (Béji) à 97 % (Ammar). L'exercice part d'une décision : libérer les 39 positions du centre du RDC, occupées par l'équipe BLI (direction Ammar), pour y créer une salle de formation ; les plans du classeur les laissent déjà sans affectation.

L'application proposée fait trois choses :

- elle affiche les 5 niveaux (RDC à 4) avec chaque position colorée par direction, en situation actuelle et en proposition ;
- elle centralise la saisie : effectifs CDI importés de la RH, consultants externes, recrutements à venir, taux de présence par collaborateur, contraintes de poste fixe ou d'étage ; toutes ces valeurs restent paramétrables ;
- elle calcule le quota équitable de chaque direction et propose une réaffectation des positions par étage et par îlot qui minimise les déménagements.

Appliquée aux données actuelles, la règle déplace 69 positions entre directions, en reprenant les 16 positions vides.

Recommandation : développer une application web interne (Next.js, PostgreSQL, moteur d'optimisation OR-Tools) en trois lots. Le lot 1 (plans, données, quotas, proposition de réaffectation) est livrable en 6 à 8 semaines. Une maquette interactive construite sur les données réelles accompagne cette étude (`prototype/index.html`).

## Contexte et périmètre

L'étude porte sur le seul site de Tunis et sur ses cinq directions opérationnelles : 1 292 CDI au 30/09/2026 (5 directeurs, 57 managers, 1 230 collaborateurs), hors stagiaires, agents de nettoyage et de sécurité. Les 150 personnes de Sfax sont hors périmètre, de même que les 78 personnes des fonctions support et leurs 106 positions, qui restent où elles sont et sortent de l'équation. Le déclencheur de l'exercice est la libération du centre du RDC : ses 39 positions, occupées aujourd'hui par l'équipe BLI, deviennent une salle de formation et BLI doit être relogée. Les plans du classeur (situation 7) montrent déjà ce centre vidé et BLI placée aux étages 1 et 3 ; c'est cette situation qui sert de référence à l'étude. Le bâtiment compte 5 niveaux (RDC et étages 1 à 4) qui partagent la même emprise : bureaux de direction aux angles, postes managers, open spaces, salles et espaces communs autour d'un noyau central.

La population à loger est composée de trois catégories : les CDI présents, les consultants externes et les recrutements à venir à court terme. Les trois comptent dans l'effectif qui sert de base à l'équité entre directions.

| Direction | Groupes du fichier Excel | Codes utilisés dans les plans |
| --- | --- | --- |
| Ammar | BLI, SN3, autres pôles | BLI, SN3, AMMAR AUTRES |
| Boubaker | tous pôles | AGAL |
| Zeineb | tous pôles | Z |
| Amine | tous pôles | AMINE |
| Béji | OMEA, PFS, autres pôles | OMEA, PFS, BEJI AUTRES |
| Fonctions support (hors équation) | RH, finance, DG, DSI interne, communication, logistique | SUP |

Chaque groupe est décliné en quatre catégories : directeur (d), manager (m), collaborateur (c) et externe (e). Directeurs et managers occupent un poste fixe ; les collaborateurs et externes se partagent les postes restants selon leur taux de présence.

L'outil actuel est le classeur Excel « Situation 7 » : chaque niveau est dessiné cellule par cellule, une position est une cellule portant un code de groupe, et les totaux sont recalculés par comptage. Ses limites motivent l'application : saisie manuelle et fragile (la couleur porte du sens), pas d'historique entre les situations, onglet « Externes » encore vide, aucun contrôle d'équité ni de capacité par jour.

## Analyse du fichier Excel

Hors fonctions support, les 1 047 positions existantes couvrent 78,5 % de l'effectif cible de 1 334 personnes, mais ce taux va aujourd'hui de 66 % (Béji) à 97 % (Ammar).

| Direction | CDI | Recrutements | Externes | Effectif cible | Positions actuelles | Taux actuel | Quota équitable | Écart |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ammar | 249 | 11 | 0 | 260 | 251 | 96,5 % | 204 | −47 |
| Boubaker | 174 | 0 | 0 | 174 | 136 | 78,2 % | 137 | +1 |
| Zeineb | 375 | 0 | 0 | 375 | 259 | 69,1 % | 294 | +35 |
| Amine | 248 | 0 | 0 | 248 | 201 | 81,0 % | 195 | −6 |
| Béji | 246 | 20 | 11 | 277 | 184 | 66,4 % | 217 | +33 |
| Vides | | | | | 16 | | 0 | −16 |
| **Total** | **1 292** | **31** | **11** | **1 334** | **1 047** | **78,5 %** | **1 047** | 0 |

Les quotas sont arrondis à la position par la méthode du plus fort reste, ce qui garantit un total égal aux 1 047 positions à répartir. Zeineb et Béji reçoivent 68 positions et Boubaker une seule ; Ammar en cède 47 et Amine 6, et les 16 positions vides sont reprises.

Positions actuelles par niveau et par direction :

| Niveau | Ammar | Boubaker | Zeineb | Amine | Béji | Vides | Support (hors équation) | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Étage 4 | | | | 2 | 124 | | 67 | 193 |
| Étage 3 | 69 | | | 199 | | 16 | 1 | 285 |
| Étage 2 | | | 259 | | | | 12 | 271 |
| Étage 1 | 139 | 136 | | | | | 1 | 276 |
| RDC | 43 | | | | 60 | | 25 | 128 |
| **Total** | **251** | **136** | **259** | **201** | **184** | **16** | **106** | **1 153** |

Zeineb et Amine occupent chacune un niveau presque entier ; Ammar et Béji sont répartis sur plusieurs niveaux. Les positions que Zeineb et Béji doivent gagner viendront donc d'îlots aujourd'hui tenus par Ammar (étages 1 et 3, RDC) et des 16 positions vides de l'étage 3.

Autres constats :

- Les 16 positions vides sont toutes à l'étage 3.
- Le centre du RDC porte 39 positions dessinées mais sans affectation (38 postes et un poste manager) : c'est la zone occupée aujourd'hui par BLI, qui devient une salle de formation. Elle est retirée de la capacité et n'entre dans aucun quota.
- Le classeur suppose 40 % de télétravail pour les collaborateurs, 60 % pour les externes et 0 % pour les managers, les directeurs et BLI. Ce calcul donne un besoin théorique de 863 postes pour les cinq directions, soit 184 de moins que les 1 047 positions à répartir. L'étude retient à ce stade la même hypothèse de télétravail pour toutes les équipes, BLI et PFS comprises, car les indicateurs de présence montrent des taux très proches d'une équipe à l'autre ; le besoin théorique tombe alors à 823 postes. La règle par effectif distribue toute la capacité ; chaque direction garde en interne la marge entre son quota et son besoin réel de présence.
- Les 31 recrutements et 11 externes viennent de la colonne « Projection de croissance » du classeur. L'onglet « Externes » est vide : la liste nominative reste à constituer, et les 31 recrutements sont à rapprocher du backlog SIRH et des mails clients sur 3 mois.
- Deux nuances de bleu distinguent les postes collaborateurs dans les plans (groupes d'Ammar et Béji au RDC) sans légende ; l'application devra porter ce sens dans les données, pas dans la couleur.

## Besoins fonctionnels

L'application remplace le classeur par quatre modules : les plans, les données, les propositions de dispatching et, dans un second temps, les taux de présence.

| Rôle | Ce qu'il fait dans l'application |
| --- | --- |
| Services généraux (administrateur du site) | Tient les plans à jour, importe l'effectif RH, lance les propositions, publie la situation de référence |
| Directeur | Voit son quota et ses îlots, déclare externes et recrutements, répartit son quota entre ses pôles, valide ou conteste une proposition |
| Manager | Renseigne les contraintes et le taux de présence de ses collaborateurs, voit les postes de son équipe |
| Collaborateur | Consulte le plan de son étage et les postes de son équipe |
| CODIR | Compare les scénarios et arbitre la règle d'équité et ses exceptions |

**Plans dynamiques**

- Un plan par niveau, chaque position dessinée à sa place et colorée par direction, avec filtres par direction, par groupe et par état (affectée, vide, poste fixe).
- Info-bulle sur chaque position : groupe, type de poste, occupant si poste fixe, îlot.
- Vue « situation actuelle » et vue « proposition », avec les positions qui changent mises en évidence.
- Vue 3D du site : les cinq niveaux empilés en vue éclatée, chaque position en volume coloré par direction (postes fixes plus hauts, positions qui changent surélevées), étiquettes de comptage par open space et par niveau, tableau des positions par niveau et par direction, rotation et zoom à la souris ou au doigt.
- Édition des plans : ajouter ou retirer des positions, définir des îlots et des zones (open space, bureau fermé, salle, zone à libérer), reprise du dessin Excel actuel à l'initialisation.

**Données et saisie** (toutes les valeurs de l'équation sont paramétrables)

- Import de l'effectif RH (Excel ou CSV, clé matricule) avec détection des entrées et sorties entre deux imports ; le nombre de CDI par direction reste modifiable à la main pour simuler.
- Fiche collaborateur : direction, pôle, manager, grade, taux de présence, contraintes (poste fixe, étage imposé, proximité du manager, besoin particulier).
- Consultants externes : liste nominative ou nombre par direction, avec date de fin de mission.
- Recrutements à venir : ceux ouverts dans le SIRH (backlog officiel) ou déclarés officiellement par le client par mail pour les 3 prochains mois, avec le nombre par direction et par pôle, la source et la date d'arrivée prévue.
- Historique : chaque « situation » devient un scénario daté que l'on peut comparer à un autre.

**Propositions de dispatching**

- Calcul du quota de chaque direction selon la règle d'équité, avec les paramètres du scénario (recrutements retenus, réserve de positions libres, zones à libérer).
- Proposition de répartition des positions par niveau et par îlot, qui respecte les postes fixes et limite les déménagements.
- Indicateurs : taux de chaque direction, nombre de positions qui changent de direction, nombre de niveaux par direction.
- Validation par les directeurs, publication de la situation retenue, export Excel et PDF des plans et de la liste des mouvements.

**Taux de présence et planning (lot 2)**

- Proposition d'un taux de présence par collaborateur cohérent avec le quota de sa direction, ajustable par le manager.
- Contrôle de la capacité par jour de la semaine et proposition des jours de présence par équipe.

**Exigences non fonctionnelles**

- Authentification par le SSO du groupe (Entra ID) et droits par rôle ; les taux de présence et contraintes individuelles sont des données personnelles, visibles du seul manager et des services généraux.
- Traçabilité de chaque modification et de chaque publication.
- Calcul d'une proposition en moins de 10 secondes ; interface en français, utilisable sur écran et tablette.

## Règles d'équité et contraintes

La règle est unique : chaque direction reçoit la même proportion de positions que son poids dans l'effectif cible, et c'est elle qui répartit ensuite ce quota entre ses pôles et ses collaborateurs.

```
S_d = r × N_d        r = S_site / Σ N_d        N_d = CDI_d + Externes_d + Recrutements_d
```

Avec les données actuelles, r vaut 1 047 / 1 334 = 78,5 % : les 106 positions des fonctions support et leurs 78 personnes sont hors de l'équation. Les quotas sont arrondis à l'unité par la méthode du plus fort reste pour que leur somme reste égale aux positions du site.

**Paramètres du scénario**

- Recrutements comptés : uniquement ceux déjà ouverts dans l'outil SIRH (backlog officiel de recrutement) ou déclarés officiellement par le client par mail pour les 3 prochains mois ; par défaut aucun autre recrutement n'entre dans l'effectif. Missions externes en cours à la date du calcul.
- Hypothèse de télétravail : la même pour toutes les équipes à ce stade, y compris celles qui déclarent en faire moins (BLI, PFS), tant que les indicateurs de présence restent proches ; postes à équipement dédié comptés dans le quota de leur direction.
- Réserve de positions gardées libres pour les arrivées non prévues (0 % par défaut).
- Zones à libérer : le centre du RDC (39 positions, future salle de formation) est retiré de la capacité ; d'autres zones peuvent être déclarées de la même façon.

**Contraintes dures, toujours respectées**

- Chaque directeur et chaque manager garde un poste fixe, compté dans le quota de sa direction.
- Un poste réservé (équipement, accessibilité) ne change pas de direction sans décision explicite.
- La capacité de chaque niveau et de chaque îlot n'est jamais dépassée, et aucune position n'est affectée dans une zone à libérer.
- Une direction occupe au plus deux niveaux et ses îlots sont contigus (paramétrable).

**Critères optimisés, par ordre de priorité**

1. Le moins possible de positions qui changent de direction.
2. Le moins possible de niveaux par direction.
3. Les postes managers au plus près de leurs équipes.
4. La stabilité d'une situation à la suivante.

**À l'intérieur d'une direction**

Le quota se répartit entre les pôles au prorata de leurs effectifs, sauf arbitrage du directeur. Les postes fixes des directeurs et managers sont retirés du quota ; le reste est partagé par les collaborateurs et externes selon leur taux de présence, dont la somme ne peut dépasser les postes partagés. Le taux proposé par défaut est le même pour tous les collaborateurs flexibles de la direction.

| Direction | Postes fixes (directeur et managers) | Postes partagés | Effectif flexible | Taux de présence moyen maximal |
| --- | ---: | ---: | ---: | ---: |
| Ammar | 10 | 194 | 250 | 77,6 % |
| Boubaker | 10 | 127 | 164 | 77,4 % |
| Zeineb | 13 | 281 | 362 | 77,6 % |
| Amine | 18 | 177 | 230 | 77,0 % |
| Béji | 11 | 206 | 266 | 77,4 % |

Un taux moyen maximal de 77 % correspond à un peu moins de quatre jours de présence par semaine. Une direction qui applique 40 % de télétravail à ses collaborateurs n'utilise donc qu'environ les trois quarts de ses postes partagés ; la marge reste la sienne, pour ses recrutements ou pour une équipe qui vient plus souvent sur site. En lot 2, le taux individuel s'exprime en jours par semaine (1 à 5) et la capacité se contrôle jour par jour : le nombre de présents un même jour ne peut dépasser les postes partagés.

## Algorithme d'affectation

Le calcul va de la règle globale à la position en trois étapes, et seule la deuxième demande un moteur d'optimisation.

1. **Quotas par direction** : quota = taux unique × effectif cible, arrondi au plus fort reste. Calcul arithmétique, immédiat.
2. **Répartition par niveau et par îlot** : modèle CP-SAT avec capacités, postes fixes et deux niveaux au plus par direction ; minimise les déménagements, la fragmentation et la distance aux managers.
3. **Taux et jours de présence (lot 2)** : taux par collaborateur dans la limite des postes partagés, capacité contrôlée jour par jour.

Une contrainte ajoutée par un directeur après validation relance l'étape 2 sans refaire les quotas.

**Étape 2 en détail (lot 1)**

- Un îlot est un groupe de positions contiguës, séparées d'au plus une cellule. Les plans actuels en comptent 75, de 1 à 113 positions ; l'application permettra de redécouper les grands îlots.
- Variables : x(d, i), nombre de positions de la direction d dans l'îlot i ; y(d, n), vaut 1 si la direction d occupe le niveau n.
- Contraintes : la somme des positions attribuées dans un îlot ne dépasse pas sa capacité ; la somme des positions d'une direction vaut son quota ; les postes fixes et réservés sont imposés ; une direction occupe au plus deux niveaux.
- Objectif : minimiser d'abord les positions qui changent de direction, puis le nombre de niveaux occupés, puis la distance entre postes managers et équipes, avec des pondérations réglables.
- Résolution : OR-Tools CP-SAT, quelques centaines de variables entières (75 îlots pour 5 directions), résolu en moins d'une seconde. La maquette utilise une heuristique plus simple qui donne déjà un bon point de départ : répartition par niveau par un flot à coût minimal (au plus un nouveau niveau par direction, libération d'abord sur le niveau le moins occupé), puis choix des positions au bord des équipes et au plus près des équipes qui les reprennent.

**Étape 3 en détail (lot 2)**

- Variables : a(c, j), vaut 1 si le collaborateur c est présent le jour j.
- Contraintes : chaque collaborateur a son nombre de jours (taux de présence × 5) ; chaque jour, les présents d'une direction ne dépassent pas ses postes partagés ; les jours d'équipe fixés par le manager sont imposés.
- Objectif : respecter les préférences de jours et lisser la présence sur la semaine.

## Architecture technique et modèle de données

Une application web interne suffit : un front qui dessine les plans, une API qui porte les règles, une base PostgreSQL et un moteur d'optimisation isolé pour que le reste de l'application n'en dépende pas.

```
Navigateur (directeurs, managers, services généraux, CODIR)
    │
    ▼
Application web Next.js ──────────► PostgreSQL (effectifs, plans, îlots, scénarios, historique)
  Front : plans SVG, saisie   └────► Moteur d'optimisation (Python, OR-Tools CP-SAT)
  API : règles, droits, exports
    ▲                ▲
SSO Entra ID     Import RH (Excel ou CSV, clé matricule)
```

Le moteur n'est appelé qu'à l'étape 2 et en lot 2 ; tout le reste (quotas, plans, saisie, exports) tourne dans l'application web.

| Option | Avantages | Limites |
| --- | --- | --- |
| A. Application sur mesure : Next.js, PostgreSQL, OR-Tools (recommandée) | Plans interactifs, règles maîtrisées, SSO du groupe, réutilisable sur d'autres sites, réalisable par une équipe interne | Développement à financer, voir la feuille de route |
| B. Power Apps, Power Automate et SharePoint | Rapide, dans l'écosystème Microsoft du groupe | Plan interactif limité, optimisation à externaliser, licences par utilisateur |
| C. Classeur Excel renforcé (VBA, Power Query) | Coût nul, continuité avec l'existant | Pas de multi-utilisateur, pas de droits, pas d'optimisation, fragile |

**Modèle de données**

| Entité | Attributs principaux | Lien |
| --- | --- | --- |
| Site, niveau | nom, plan (grille importée ou SVG) | un site a plusieurs niveaux |
| Îlot | niveau, type (open space, bureau fermé, salle, zone à libérer), capacité | un niveau a plusieurs îlots |
| Position | îlot, coordonnées, type (poste, poste manager, bureau directeur), réservée ou non | un îlot a plusieurs positions |
| Direction, pôle | code, directeur, pôle parent, hors équation ou non | un pôle appartient à une direction |
| Personne | matricule, nom, grade (d, m, c, e), pôle, manager, site, type (CDI, externe, recrutement ouvert dans le SIRH ou déclaré par le client), dates d'arrivée et de fin, taux de présence, contraintes | une personne appartient à un pôle |
| Scénario | nom, date, paramètres (recrutements retenus, réserve, zones à libérer), statut (brouillon, proposé, validé, publié) | un scénario regroupe des affectations |
| Affectation | scénario, position, direction ou pôle, personne si poste fixe | une position par scénario |
| Mouvement | scénario, position, direction avant, direction après | calculé à chaque proposition |
| Journal | auteur, action, date | sur toute modification et publication |

Le modèle est multi-site dès le départ : ajouter Sfax ne demande qu'un site et ses plans.

## Maquette interactive

`prototype/index.html` (publiée aussi sur https://claude.ai/artifact/S5dwPRLWJgmsrA7WN6uZsA) est une page autonome construite sur les plans et les effectifs du classeur (données agrégées, aucun nom). Elle montre :

- les cinq niveaux avec chaque position colorée par direction, les postes fixes marqués D ou M, les positions du support hachurées (hors équation), le centre du RDC marqué comme future salle de formation ;
- une vue 3D du site (Three.js) : niveaux empilés en vue éclatée ou compacte, positions en volumes colorés par direction, étiquettes de comptage par open space et par niveau, tableau des positions par niveau et par direction avant → après, liste des open spaces avec leurs effectifs par direction ;
- les paramètres modifiables par direction (CDI, externes, recrutements) et globaux (réserve, fenêtre des recrutements déclarés par mail client), avec recalcul immédiat des quotas ;
- la proposition : positions avant et après par direction, niveaux occupés, postes partagés et taux de présence moyen maximal, liste des mouvements par niveau et par îlot, vue « changements » sur les plans.

Pour la reconstruire à partir d'un nouveau classeur :

```
python3 -I scripts/extract_situation.py Situation.xlsx data/situation.json
python3 scripts/build_prototype.py data/situation.json prototype/template.html prototype/index.html
```

## Feuille de route et estimation

Quatre lots, dont deux suffisent pour remplacer le classeur : le lot 1 produit la première situation complète huit semaines après le lancement du cadrage. Les durées sont des estimations pour une équipe de trois personnes : un développeur full-stack à temps plein, un profil data et optimisation à mi-temps, un product owner côté services généraux à un jour par semaine.

| Lot | Contenu | Livrable | Durée | Charge estimée |
| --- | --- | --- | --- | --- |
| Lot 0 · Cadrage | Règle d'équité et exceptions validées en CODIR, plans redessinés en îlots, liste des externes et des recrutements par direction | Note de cadrage et plans de référence | 2 semaines | 10 jours |
| Lot 1 · MVP | Plans dynamiques, import RH, saisie des externes et recrutements, quotas, proposition par îlot, exports, SSO | Situation 8 produite par l'application | 6 semaines | 60 jours |
| Lot 2 · Présence | Taux de présence par collaborateur, jours de présence, contrôle de capacité par jour, saisie manager | Planning hebdomadaire par direction | 4 semaines | 40 jours |
| Lot 3 · Extension | Réservation quotidienne, autres sites, import RH automatique | Selon besoin | optionnel | à chiffrer |

Jalons : règles validées en CODIR (fin du lot 0), situation produite par l'application (fin du lot 1), taux saisis par les managers (fin du lot 2).

Une première version du lot 1 a été produite le 09/10/2026 par un workflow d'agents (dossier `app/`) : socle Next.js et Prisma, moteur de dispatching testé sur les chiffres de référence, import RH, authentification Entra ID avec mode de développement, services, plans dynamiques, paramètres, proposition et scénarios, parcours de bout en bout automatisé. Elle reste à déployer et à faire valider par les services généraux.

## Risques, hypothèses et points à arbitrer

Le principal risque n'est pas technique : c'est l'acceptation de la règle par les directions qui cèdent des positions. Les autres points se traitent au cadrage.

**Décisions de conception prises le 09/10/2026**

- Périmètre : site de Tunis, cinq directions opérationnelles ; fonctions support et leurs 106 positions hors équation.
- Règle : même taux de positions par personne pour chaque direction, sur l'effectif CDI + externes + recrutements.
- Recrutements comptés : ouverts dans le SIRH ou déclarés officiellement par le client par mail sur 3 mois.
- Centre du RDC : 39 positions libérées pour la salle de formation, hors capacité ; BLI relogée.
- Télétravail : même hypothèse pour toutes les équipes, BLI et PFS comprises.
- Toutes les valeurs de l'équation restent paramétrables dans l'application.
- Socle technique retenu pour le lot 1 : option A (Next.js, PostgreSQL, moteur d'optimisation), SSO Entra ID.

| Point | Enjeu | Proposition |
| --- | --- | --- |
| Acceptation de la règle | Ammar cède 47 positions et Amine 6 au premier calcul | Présenter la règle avec la marge interne qu'elle laisse (taux moyen maximal de 77 %) et une transition en deux vagues |
| Recrutements comptés dans l'effectif | Seuls les recrutements ouverts dans le SIRH ou déclarés officiellement par le client par mail sur 3 mois entrent dans l'effectif | Export SIRH mensuel et mail client joint au scénario comme justificatif ; revue chaque trimestre |
| Relogement de BLI | BLI (91 personnes) quitte le centre du RDC pour la salle de formation ; avec la même hypothèse de télétravail que les autres équipes, elle tient dans le quota d'Ammar (204 positions pour 260 personnes) | Garder BLI groupée sur un seul niveau et la déménager dans la première vague |
| Postes réservés et télétravail | Certains postes ont un équipement dédié ; BLI et PFS déclarent moins de télétravail que les autres équipes | Même hypothèse de télétravail pour toutes les équipes tant que les indicateurs de présence restent proches ; postes à équipement comptés dans le quota de leur direction |
| Fonctions support hors équation | Leurs 106 positions restent figées alors que leurs 78 personnes occupent 136 % de places | Revoir ce choix si leur effectif ou leurs locaux changent |
| Qualité des données RH | Codes de direction tenus à la main, une personne sans directeur dans l'extraction | Import mensuel avec contrôle des écarts, codes portés par l'application |
| Données personnelles | Taux de présence et contraintes individuelles | Accès limité au manager et aux services généraux, finalité déclarée, conservation limitée aux scénarios publiés |
| Déménagements | 69 positions changent de direction au premier calcul, même si l'algorithme les minimise | Plan de déménagement par vagues, aligner la première sur les recrutements |
| Sfax | Hors périmètre, mais la même question se posera | Modèle multi-site dès le lot 1, plans de Sfax en lot 3 |
| Capacité de développement | L'outil dépend d'une équipe interne disponible | Confier le lot 1 à un pôle logiciel interne ; Power Apps en solution de repli |

Décisions attendues :

- [ ] Valider la règle d'équité et le périmètre (support hors équation) en CODIR
- [ ] Extraire le backlog SIRH et les mails clients sur 3 mois, fixer la liste des externes par direction
- [ ] Planifier le déménagement de BLI et l'aménagement de la salle de formation
- [ ] Désigner l'équipe du lot 1 et le product owner
