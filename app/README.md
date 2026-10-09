# PrestigePlaces : application (lot 1)

Application de dispatching des positions de travail du site Sofrecom de Tunis. Elle porte la règle d'équité décrite dans `../docs/etude-dispatching.md` : quotas par direction, répartition par niveau, plans interactifs, scénarios comparables, import des fichiers RH et SIRH.

Stack : Next.js (App Router, TypeScript strict), Prisma (SQLite en développement, PostgreSQL en production, même schéma), next-auth 4, interface en français.

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
- n'utilise jamais `prisma/dev.db`.

Le Chromium préinstallé est détecté dans `PLAYWRIGHT_BROWSERS_PATH`, ou pris dans `PW_CHROMIUM_PATH`. Ne pas lancer `playwright install` dans l'environnement d'intégration. Le parcours vérifie sur « Situation 7 (classeur) » les quotas de référence, les changements de direction et les niveaux après proposition.

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
├── e2e/               tests Playwright (auth.setup.ts, parcours, import)
├── tests/             tests Vitest : auth, engine, import, services
├── src/
│   ├── app/           pages et routes (App Router)
│   │   ├── api/       routes REST : scénarios, positions, plans, auth next-auth
│   │   ├── connexion/ connexion (SSO et sélecteur de développement)
│   │   ├── import/    import des fichiers RH et SIRH (server actions)
│   │   ├── parametres/, scenarios/, plans/, proposition/
│   ├── components/    Nav, plans SVG, paramètres, comparaison, propositions
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

## Limites connues

Ce lot ne couvre pas tout le périmètre de l'étude. Les points ouverts sont :

- Numérotation des îlots : la base (`Island.index`, de 0 à n−1, zone FORMATION incluse) diffère encore du moteur (1 à n par niveau). Il faut aligner le seed sur `islands()` ou renseigner `Seat.island` depuis la base.
- Gestion des rôles : pas encore d'écran pour `UserRole` (action `utilisateurs.gerer`).
- Taux de présence par équipe (`presence.modifier`) et contraintes par personne : non implémentés.
- Zones à libérer d'un scénario : l'API existe (`PUT zones`), mais l'interface les liste seulement. Il manque la sélection sur le plan.
- La page `/scenarios` n'est pas couverte par les tests e2e (création, duplication, transitions, comparaison A/B), ni la validation d'une proposition.
- Couleurs des directions : `Direction.color` est fixe et n'est pas adapté au thème sombre.
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
