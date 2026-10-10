# PrestigePlaces : application (lot 1)

Application de dispatching des positions de travail du site Sofrecom de Tunis. Elle porte la règle d'équité décrite dans `../docs/etude-dispatching.md` : quotas par direction, répartition par niveau, plans interactifs, scénarios comparables, import des fichiers RH et SIRH.

Stack : Next.js (App Router, TypeScript strict), Prisma (SQLite en développement, PostgreSQL en production, même schéma), next-auth 4, interface en français.

## Fonctionnalités

| Page | Contenu |
| --- | --- |
| `/` | Vue d'ensemble pour les directeurs : la règle d'équité en une phrase (positions pour 100 personnes), les chiffres de paramétrage (CDI, externes, recrutements retenus, effectif cible ; positions du site, support, zone à libérer, réserve, positions à répartir), le tableau par direction (part de l'effectif, positions attribuées, part des positions), les barres comparées et les hypothèses communes |
| `/plans` | Plans 2D des 5 niveaux (SVG) : situation, proposition et changements, détail d'une position, salle de formation du RDC |
| `/vue-3d` | Vue 3D du site (Three.js) : niveaux empilés en vue éclatée ou compacte, positions colorées par direction, postes fixes plus hauts, changements surélevés ; tableau « Positions par niveau et par direction » (avant → après) et open spaces avec leurs effectifs par direction (voir « Vue 3D ») |
| `/parametres` | Effectifs par direction (CDI, externes, recrutements), réserve, fenêtre des recrutements |
| `/proposition` | Calcul de la proposition : quotas, niveaux avant → après, mouvements |
| `/scenarios` | Création, duplication, statuts, comparaison A/B des scénarios |
| `/import` | Import des fichiers RH et SIRH (services généraux) |
| `/connexion` | SSO Microsoft Entra ID ou sélecteur de rôle en développement |

Aucune donnée nominative ne doit entrer dans le dépôt. Les fichiers RH (`*.xlsx`, `*.csv`, etc.) et les bases locales (`*.db`) sont ignorés par git.

## Prérequis

- Node.js (version LTS compatible avec Next.js 16) et npm.
- Pour les tests de bout en bout : un Chromium compatible (voir plus bas).
- Pour la production : une base PostgreSQL accessible.

## Installation

```bash
cd app
npm install          # déclenche aussi `prisma generate` (postinstall)
cp .env.example .env # puis adapter les valeurs
npm run db:push      # crée la base (SQLite par défaut)
npm run db:seed      # charge le site Tunis, les plans et le scénario « Situation 7 (classeur) »
npm run dev          # http://localhost:3000
```

Le seed est idempotent : il remplace le site Tunis et le scénario de référence, sans toucher aux autres scénarios. Il lit `../data/situation.json`, qui ne contient que des agrégats et des plans.

## Variables d'environnement

Le fichier `.env.example` documente toutes les variables. Le résumé :

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `DATABASE_URL` | Connexion Prisma. SQLite : `file:./dev.db` (relatif à `prisma/`). PostgreSQL : `postgresql://…` | `file:./dev.db` |
| `DB_PROVIDER` | `sqlite` ou `postgresql`, lu par `npm run db:provider` | `sqlite` |
| `NEXTAUTH_URL` | URL publique de l'application, doit correspondre au port servi | `http://localhost:3000` |
| `NEXTAUTH_SECRET` (ou `AUTH_SECRET`) | Clé de signature des sessions. Obligatoire hors mode développement | aucun |
| `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` | Fournisseur SSO Microsoft Entra ID, actif si les trois sont renseignées. Redirection : `<NEXTAUTH_URL>/api/auth/callback/azure-ad` | vides |
| `AUTH_DEV_MODE` | Connexion de développement sans mot de passe (sélecteur de rôle). `AUTH_DEV_LOGIN` est un alias ancien | `false` |
| `AUTH_DEFAULT_ROLE` | Rôle d'un compte SSO absent de la table `UserRole` : `LECTURE`, `MANAGER`, `DIRECTEUR`, `SERVICES_GENERAUX` ou `AUCUN` (refus) | `LECTURE` |
| `STORE_PERSONS` | `true` conserve aussi les matricules hachés (SHA-256 salé) dans `Person`. `false` ne garde que des effectifs agrégés | `false` |
| `PERSON_HASH_SALT` | Sel des matricules, obligatoire si `STORE_PERSONS=true`. Secret, jamais versionné | vide |
| `E2E_PORT` | Port des tests de bout en bout (facultatif) | `3210` |
| `PW_CHROMIUM_PATH` | Exécutable Chromium forcé pour Playwright (facultatif) | vide |

Garde-fou : `AUTH_DEV_MODE=true` n'est actif en production que si `NEXTAUTH_URL` pointe sur `localhost`. Un serveur déployé avec une autre URL refuse la connexion de développement.

## Base de données

### Développement : SQLite

Le réglage par défaut suffit : `DATABASE_URL="file:./dev.db"`, `DB_PROVIDER="sqlite"`. La base est créée dans `prisma/dev.db`, ignorée par git.

### Production : PostgreSQL

```bash
# .env
DATABASE_URL="postgresql://utilisateur:motdepasse@hote:5432/prestigeplaces"
DB_PROVIDER="postgresql"

npm run db:generate   # bascule le provider du schéma puis génère le client
npm run db:push       # applique le schéma
```

Attention : `db:provider` réécrit la ligne `provider` de `prisma/schema.prisma` selon `DB_PROVIDER`. Ne pas committer un schéma basculé sur `postgresql` pour un usage de développement, et remettre `sqlite` avant de versionner.

Les migrations Prisma ne sont pas encore versionnées : le schéma est appliqué avec `db:push`. Pour une production durable, il faudra des migrations versionnées (voir « Limites connues »).

## Commandes

Toutes les commandes se lancent depuis `app/`. Elles sont celles de `package.json`.

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production (après `build`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Tests unitaires et de service (Vitest, `vitest run`) |
| `npm run e2e` | Tests de bout en bout (Playwright) |
| `npm run e2e:db` | Prépare `prisma/e2e.db` (push + seed), sans toucher à `dev.db` |
| `npm run db:provider` | Aligne le provider Prisma sur `DB_PROVIDER` |
| `npm run db:generate` | Provider + `prisma generate` |
| `npm run db:push` | Provider + `prisma db push` |
| `npm run db:seed` | Charge les données de référence (`prisma/seed.ts`) |

## Tests

### Unitaires et services

```bash
npm run typecheck
npm run lint
npm test
```

Les tests couvrent le moteur (quotas, flot, îlots, propositions), l'import RH, les services de scénarios, les règles d'accès et la configuration.

### Bout en bout

```bash
npm run e2e
```

`playwright.config.ts` :

- prépare une base dédiée `prisma/e2e.db` (recréée sans `--force-reset`, seed idempotent) ;
- construit l'application et la sert sur `E2E_PORT` (3210 par défaut) en mode `AUTH_DEV_MODE=true` ;
- se connecte en « Services généraux » (fichier de session `e2e/.auth/`, ignoré par git) ;
- n'utilise jamais `prisma/dev.db` ;
- lance Chromium avec `--enable-unsafe-swiftshader` : sans GPU, WebGL passe en rendu logiciel et la vue 3D monte son canvas.

Le Chromium préinstallé est détecté dans `PLAYWRIGHT_BROWSERS_PATH`, ou pris dans `PW_CHROMIUM_PATH`. Ne pas lancer `playwright install` dans l'environnement d'intégration. Le parcours vérifie sur « Situation 7 (classeur) » les quotas de référence, les changements de direction et les niveaux après proposition.

`e2e/vue3d.spec.ts` couvre la vue 3D en services généraux : titre, lien actif de la navigation, tableau « Positions par niveau et par direction » avec les totaux de référence (Ammar 251 → 204, Zeineb 259 → 294, Béji 184 → 217, 1153 positions), présence du canvas et des étiquettes de niveau, changement de niveau. Il calcule la proposition si elle manque, pour rester exécutable seul (`npx playwright test e2e/vue3d.spec.ts`). Aucune assertion ne porte sur le contenu du canvas (rendu logiciel en headless).

## Comptes de développement

En mode `AUTH_DEV_MODE=true`, la page `/connexion` propose un sélecteur de rôle sans mot de passe :

| Rôle | Accès |
| --- | --- |
| Services généraux (`SERVICES_GENERAUX`) | Tout, y compris l'import et la gestion des scénarios |
| Directeur (`DIRECTEUR`) | Sa direction, avec choix de la direction |
| Manager (`MANAGER`) | Son équipe, avec choix de la direction |
| Lecture seule (`LECTURE`) | Consultation, sans modification |

Les comptes de développement ont des adresses synthétiques de la forme `dev-<rôle>-<direction>@prestigeplaces.local`. Ils ne correspondent à aucune personne réelle. Le mode est ignoré en production hors `localhost`.

En SSO, les rôles viennent de la table `UserRole`. Les e-mails y sont enregistrés en minuscules. Un compte absent prend le rôle `AUTH_DEFAULT_ROLE`.

## Structure des dossiers

```
app/
├── prisma/            schema.prisma (provider réécrit par db:provider), seed.ts
├── scripts/           set-db-provider.mjs
├── e2e/               tests Playwright (auth.setup.ts, parcours, import, vue3d)
├── tests/             tests Vitest : auth, engine, import, services
├── src/
│   ├── app/           pages et routes (App Router)
│   │   ├── api/       routes REST : scénarios, positions, plans, auth next-auth
│   │   ├── connexion/ connexion (SSO et sélecteur de développement)
│   │   ├── import/    import des fichiers RH et SIRH (server actions)
│   │   ├── parametres/, scenarios/, plans/, proposition/, vue-3d/
│   ├── components/    Nav, plans SVG (plan/), vue 3D (plan3d/), paramètres, comparaison, propositions
│   └── lib/
│       ├── auth/      session, permissions, env, dev login
│       ├── engine/    quotas (plus fort reste), flot à coût minimal, îlots, propose()
│       ├── import/    lecture des fichiers, groupes, hachage, comparaison
│       ├── services/  logique métier partagée par les routes et les actions
│       ├── directions.ts, islands.ts, config.ts, db.ts
│   └── proxy.ts       protection des routes
└── .env.example
```

Le moteur (`lib/engine/`) reproduit la logique du prototype (`prototype/template.html`) et doit rester conforme aux résultats de référence de l'étude.

## Vue 3D (`/vue-3d`)

Page distincte de `/plans` (lien « Vue 3D » dans la navigation), lisible par tous les rôles (droit `lire`). Elle charge les mêmes données que `/plans` (`app/plans/load.ts` : plan de chaque niveau du scénario et de sa proposition par les services) et accepte les paramètres `scenario`, `niveau` (absent = tous les niveaux) et `vue` (`situation`, `proposition`, `changements`).

- `components/plan3d/model3d.ts` : fonctions pures, testées sans WebGL (`model3d.test.ts`) : instances des positions (hauteur 1, postes fixes 1,9, changements surélevés de 0,9 et autres positions atténuées en vue changements), niveaux empilés (écart 13 en vue éclatée, 2,6 en vue compacte), décor, comptes par niveau et par direction, open spaces avant → après, ancres d'étiquettes, projection à l'écran, orbite.
- `components/plan3d/Plan3D.tsx` : rendu Three.js (chargé par `next/dynamic` avec `ssr: false`) : un seul `InstancedMesh` coloré par instance pour les positions, couleurs lues dans les variables CSS du thème (clair ou sombre, repeint au changement), étiquettes HTML projetées, orbite à la souris et au doigt, zoom à la molette et au pincement, flèches et +/− au clavier, ressources libérées au démontage. Sans WebGL, un message remplace la scène ; les tableaux restent affichés.
- `components/plan3d/View3D.tsx` : sélecteur de scénario, vues, tableau « Positions par niveau et par direction » et liste des open spaces (îlots numérotés de 1 à n par niveau, comme le moteur et la liste des mouvements).

Lisibilité :

- Cadrage : sur un cadre plus haut que large (mobile), la caméra recule (`cameraDistance`, au plus ×2) pour que les plans ne soient pas rognés sur les côtés ; le rayon logique, qui décide de l'affichage des étiquettes d'îlots, ne change pas.
- Étiquettes : leur position est bornée au cadre (`clampLabel`), l'étiquette du niveau le plus haut ne sort donc plus par le haut de la scène.
- Vue « Changements » : les positions inchangées sont mélangées à la couleur du fond dans l'espace sRGB (équivalent de l'opacité 0,25 du plan 2D), lisibles en thème clair comme en thème sombre.
- Tableau : sur mobile il défile dans son cadre, la colonne des niveaux reste figée. La page elle-même ne défile jamais en largeur (vérifié à 1280 et 400 px, thèmes clair et sombre).

## Limites connues

Ce lot ne couvre pas tout le périmètre de l'étude. Les points ouverts sont :

- Numérotation des îlots : la base (`Island.index`, de 0 à n−1, zone FORMATION incluse) diffère encore du moteur (1 à n par niveau). Il faut aligner le seed sur `islands()` ou renseigner `Seat.island` depuis la base.
- Gestion des rôles : pas encore d'écran pour `UserRole` (action `utilisateurs.gerer`).
- Taux de présence par équipe (`presence.modifier`) et contraintes par personne : non implémentés.
- Zones à libérer d'un scénario : l'API existe (`PUT zones`), mais l'interface les liste seulement. Il manque la sélection sur le plan.
- La page `/scenarios` n'est pas couverte par les tests e2e (création, duplication, transitions, comparaison A/B), ni la validation d'une proposition.
- Couleurs des directions : `Direction.color` est fixe. La vue 3D lit les variables du thème (`--c-ammar`…) et suit le thème sombre ; les plans 2D utilisent encore la couleur en base.
- Vue 3D : pas de test automatisé du rendu WebGL (seuls la présence du canvas, les étiquettes HTML et les tableaux sont vérifiés). En vue compacte avec tous les niveaux, les étiquettes de niveau se chevauchent, comme dans le prototype. La liste des open spaces s'arrête aux 40 plus grands.
- Migrations Prisma non versionnées (`db:push`). À prévoir avant la production PostgreSQL. `package.json#prisma` est déprécié au profit de `prisma.config.ts` avant Prisma 7.
- Chromium : la révision installée ne correspond pas à celle attendue par `@playwright/test`. En CI, aligner Playwright sur le navigateur préinstallé ou définir `PW_CHROMIUM_PATH`.
- La limite de 10 Mo des server actions pour l'import n'a pas été vérifiée avec un fichier volumineux réel.
- Recrutements « client par mail » datés dans le passé : ils sont comptés (date ≤ fin de fenêtre). Faut-il exiger une date ≥ aujourd'hui ? À trancher avec les services généraux.

## Prochaines étapes (lot 2)

Le lot 2 couvre les points restants ci-dessus, avec en priorité le taux de présence par équipe et les jours de télétravail par personne, puis la sélection des zones à libérer sur le plan, les tests des scénarios et les écrans de gestion des rôles.

---

# Référence : modèle create-next-app

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Déploiement sur Vercel

1. **Projet Vercel** : importer le dépôt `MBeji/PrestigePlaces`, puis dans *Settings → Build and Deployment*, régler **Root Directory = `app`**. Le framework Next.js est détecté. Vercel lance automatiquement le script `vercel-build` (`scripts/vercel-build.mjs`).
2. **Branche de production** : `main` (*Settings → Git → Production Branch*). Chaque pull request obtient un déploiement de prévisualisation.
3. **Base de données**, au choix :
   - *Démonstration, sans configuration* : aucune variable de base. Le build crée et ensemence une base SQLite embarquée (`prisma/demo.db`), copiée dans `/tmp` à l'exécution. Les modifications ne sont pas conservées, un bandeau le signale.
   - *Production* : ajouter une base PostgreSQL (onglet *Storage* de Vercel, par exemple Neon) ; les variables `POSTGRES_PRISMA_URL` / `POSTGRES_URL` posées par l'intégration sont reconnues, tout comme `DATABASE_URL`. Le build pousse le schéma et n'ensemence que si la base est vide.
4. **Authentification** : l'application est **ouverte par défaut**, sans connexion, avec les droits complets pour chaque visiteur. Pour exiger une connexion plus tard, définir `AUTH_REQUIRED=true` et l'une des méthodes ci-dessous. Pour restreindre l'accès sans toucher au code, la protection de déploiement de Vercel (*Settings → Deployment Protection*) reste disponible.
5. **Variables d'environnement** (*Settings → Environment Variables*), utiles seulement avec `AUTH_REQUIRED=true` :

| Variable | Usage |
| --- | --- |
| `AUTH_DEMO_PASSWORD` | Mot de passe partagé de l'accès de démonstration (sélecteur de rôle). Sans elle et sans Entra ID, personne ne peut se connecter |
| `NEXTAUTH_SECRET` | Clé de signature des sessions (`openssl rand -base64 32`). Recommandée ; en démonstration, une clé est dérivée du mot de passe si elle manque |
| `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` | SSO Entra ID (production). URL de redirection : `https://<domaine>/api/auth/callback/azure-ad` |
| `NEXTAUTH_URL` | Facultative sur Vercel (déduite du domaine) ; à fixer sur le domaine définitif quand Entra ID est utilisé |

Simulation locale d'un build Vercel : `VERCEL=1 npm run vercel-build`, puis `VERCEL=1 AUTH_DEMO_PASSWORD=… npm start`.
