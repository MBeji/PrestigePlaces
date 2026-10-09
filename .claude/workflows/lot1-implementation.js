export const meta = {
  name: 'prestigeplaces-lot1',
  description: 'Implémente le lot 1 de PrestigePlaces (app Next.js + Prisma + moteur de dispatching) avec routage du modèle par tâche',
  phases: [
    { title: 'Socle', detail: 'projet Next.js, schéma Prisma, seed depuis data/situation.json' },
    { title: 'Modules', detail: 'moteur de dispatching, import RH, authentification (en parallèle)' },
    { title: 'Données', detail: 'services et routes : scénarios, paramètres, proposition' },
    { title: 'Interface', detail: 'plans SVG, paramètres et résultats (en parallèle)' },
    { title: 'Qualité', detail: 'lint, typecheck, tests, build, parcours de bout en bout, corrections' },
    { title: 'Documentation', detail: 'README et guide de lancement' },
  ],
}

// ---------- routage du modèle par tâche ----------
// Règle : complexité haute ou risque élevé (sécurité, cœur métier) → opus / effort high ;
// tâche mécanique → haiku / effort low ; le reste → sonnet / effort medium.
const TASKS = {
  scaffold:   { complexity: 'medium', risk: 'low' },
  engine:     { complexity: 'high',   risk: 'high' },
  importRh:   { complexity: 'medium', risk: 'medium' },
  auth:       { complexity: 'medium', risk: 'high' },
  dataAccess: { complexity: 'medium', risk: 'medium' },
  uiPlan:     { complexity: 'high',   risk: 'low' },
  uiParams:   { complexity: 'medium', risk: 'low' },
  qa:         { complexity: 'high',   risk: 'high' },
  docs:       { complexity: 'low',    risk: 'low' },
}
const route = t => (t.complexity === 'high' || t.risk === 'high') ? { model: 'opus', effort: 'high' }
  : t.complexity === 'low' ? { model: 'haiku', effort: 'low' } : { model: 'sonnet', effort: 'medium' }

const RESULT = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'partial', 'blocked'] },
    summary: { type: 'string', description: 'ce qui a été fait, en français, 5 à 15 lignes' },
    files: { type: 'array', items: { type: 'string' }, description: 'fichiers créés ou modifiés' },
    checks: { type: 'string', description: 'commandes de vérification lancées et leur résultat' },
    api: { type: 'string', description: 'fonctions, routes ou composants exportés que les étapes suivantes doivent utiliser (signatures)' },
    notes: { type: 'string', description: 'dépendances ou champs de schéma demandés, problèmes restants' },
  },
  required: ['status', 'summary', 'files', 'checks'],
}

const run = (key, prompt, ph) => {
  const r = route(TASKS[key])
  log(`routage ${key} → ${r.model} (effort ${r.effort})`)
  return agent(prompt, { label: key, phase: ph, schema: RESULT, model: r.model, effort: r.effort })
}

const CTX = `
CONTEXTE COMMUN (à lire en entier)
Dépôt : /home/user/PrestigePlaces, branche claude/quirky-volta-30ojwb. Ne change pas de branche, ne fais aucun commit ni push : l'orchestrateur commite à la fin.
Référence fonctionnelle : docs/etude-dispatching.md (sections Règles d'équité, Algorithme, Architecture et Modèle de données, Besoins fonctionnels).
Logique de référence à porter : prototype/template.html (fonctions buildSeats, islands, largestRemainder, minCostFlow, solveFloors, propose). Résultats attendus sur data/situation.json : quotas AMMAR 204, BOUBAKER 137, ZEINEB 294, AMINE 195, BEJI 217 ; 69 positions changent de direction ; Zeineb passe des niveaux [2] à [2,3] ; Béji reste sur [RDC,4] ; Boubaker sur [1] ; Ammar sur [RDC,1,3] ; Amine sur [3,4].
Données : data/situation.json = { groups: { CODE: { label, direction, cdi:{d,m,c}, recrutements, externes } }, floors: { RDC|1|2|3|4: { label, cells:[{r,c,t,g?,k?}] } } } ; t ∈ seat|wall|office|room|green|free|free_m ; g = code de groupe (BLI, SN3, AMMAR AUTRES, AGAL, Z, AMINE, OMEA, PFS, BEJI AUTRES, SUP, V = vide) ; k ∈ d|m|c|e.
Correspondance groupe → direction : BLI, SN3, AMMAR AUTRES → AMMAR ; AGAL → BOUBAKER ; Z → ZEINEB ; AMINE → AMINE ; OMEA, PFS, BEJI AUTRES → BEJI ; SUP → SUPPORT (hors équation) ; V → VIDE.
Règles métier figées :
- site de Tunis, 5 directions ; les positions du groupe SUP sont hors équation et ne bougent jamais ;
- effectif cible d'une direction = CDI + consultants externes + recrutements (recrutements comptés = ouverts dans le SIRH ou déclarés officiellement par le client par mail sur une fenêtre de 3 mois ; chaque recrutement porte une source SIRH|MAIL_CLIENT et une date) ;
- quota(direction) = positions à répartir × effectif cible / somme des effectifs cibles, arrondi au plus fort reste, jamais inférieur aux postes fixes (directeur + managers) ;
- positions à répartir = toutes les positions hors SUP, moins la réserve (pourcentage paramétrable, 0 par défaut) ;
- le centre du RDC (cellules t='free' du RDC et la cellule t='free_m' de la ligne 20 du RDC, 39 positions) est une zone à libérer (future salle de formation) : jamais affectée, affichée comme telle ;
- postes fixes : k = d ou m ne changent jamais de direction ; même hypothèse de télétravail pour toutes les équipes ;
- répartition par niveau : flot à coût minimal, au plus un nouveau niveau par direction déficitaire, libération d'abord sur le niveau le moins occupé de la direction excédentaire ; puis choix des positions au bord des équipes qui cèdent et au plus près des équipes qui reprennent (voir propose() du prototype) ;
- toutes les valeurs (CDI, externes, recrutements, réserve, zones à libérer) sont paramétrables par scénario et modifiables dans l'interface.
Application : dossier app/ = Next.js (App Router, TypeScript strict), Prisma avec SQLite en développement (DATABASE_URL=file:./dev.db) et PostgreSQL en production (même schéma, provider via env), interface en français, aucune donnée nominative dans le dépôt (les fichiers RH et dev.db sont ignorés par git). Variables d'environnement : .env.example documenté.
Conventions pour tous : n'édite que les dossiers qui te sont attribués ; ne modifie ni app/package.json, ni app/prisma/schema.prisma, ni app/src/app/layout.tsx (si tu as besoin d'une dépendance, d'un champ ou d'un lien de navigation, écris-le dans le champ notes de ta réponse, l'étape suivante l'appliquera) ; n'exécute jamais 'playwright install' (Chromium est préinstallé, PLAYWRIGHT_BROWSERS_PATH est déjà défini) ; avant de répondre, lance dans app/ : npm run typecheck, npm run lint, npm test, et corrige ce qui relève de ton périmètre. Réponds avec le schéma demandé, en français.
`

// ---------- Phase 1 : socle ----------
phase('Socle')
const scaffold = await run('scaffold', `${CTX}
TA TÂCHE : créer le socle de l'application dans app/ (tu es le seul à écrire dans package.json, schema.prisma et layout.tsx).
1. Crée le projet : npx create-next-app@latest app --ts --app --eslint --src-dir --import-alias "@/*" --use-npm --yes (sans Tailwind, CSS modules ou CSS global) avec des versions stables (pas de release candidate). Installe et configure : prisma + @prisma/client (version stable), zod, vitest (+ @vitest/coverage facultatif), next-auth version stable 4.x, xlsx (SheetJS) pour l'import, @playwright/test (sans télécharger de navigateur).
2. Scripts npm : dev, build, start, lint, typecheck (tsc --noEmit), test (vitest run), db:push (prisma db push), db:seed (tsx ou ts-node du script prisma/seed.ts), e2e (playwright test). Ajoute tsx si nécessaire.
3. Schéma Prisma conforme à la section Modèle de données de l'étude : Site, Floor (code RDC|1|2|3|4, label, ordre), PlanCell (floorId, r, c, type wall|office|room|green|free|free_m|desk), Island (floorId, index), Position (floorId, islandId?, r, c, kind d|m|c|e, type POSTE|POSTE_MANAGER|BUREAU_DIRECTEUR, groupCode, reserved bool, zoneToFree bool), Direction (code, label, color, inEquation bool), Pole (groupCode unique, label, directionCode), Scenario (name, createdAt, status DRAFT|PROPOSED|VALIDATED|PUBLISHED, reservePct, recruitWindowMonths, notes), ScenarioDirectionParam (scenarioId, directionCode, cdi, externes, recrutements, fixedSeats), Recruitment (scenarioId, directionCode, poleCode?, count, source SIRH|MAIL_CLIENT, expectedDate, reference), ExternalConsultant (scenarioId, directionCode, count, endDate?), Assignment (scenarioId, positionId, directionCode, personRef?), Movement (scenarioId, positionId, fromDirection, toDirection), HeadcountSnapshot (importedAt, groupCode, kind, count, site), Person (optionnelle, matricule hashé, groupCode, kind, site, presenceRate?, constraints JSON ; vide par défaut), UserRole (email, role SERVICES_GENERAUX|DIRECTEUR|MANAGER|LECTURE, directionCode?), AuditLog (actor, action, entity, entityId, at, details JSON). Index utiles et contraintes d'unicité (Position: floorId+r+c ; Assignment: scenarioId+positionId).
4. prisma/seed.ts : lit ../data/situation.json (chemin relatif au dépôt), crée le site Tunis, les 5 niveaux, toutes les cellules de plan, les positions (t='seat' → Position avec kind et groupCode ; cellules 'free' du RDC et la cellule 'free_m' de la ligne 20 du RDC → Position zoneToFree=true, kind c ou m, groupCode 'FORMATION' ; les autres 'free_m' → PlanCell type desk), les directions (AMMAR Ammar, BOUBAKER Boubaker, ZEINEB Zeineb, AMINE Amine, BEJI Béji, SUPPORT Support hors équation inEquation=false) avec les couleurs du prototype (--c-ammar #2a78d6, --c-boubaker #eb6834, --c-zeineb #1baf7a, --c-amine #eda100, --c-beji #e87ba4, --c-support #6fa86f), les pôles (un par code de groupe), un scénario « Situation 7 (classeur) » avec ScenarioDirectionParam calculés depuis groups (cdi = d+m+c, fixedSeats = d+m, externes, recrutements) et les Recruitment/ExternalConsultant correspondants (source SIRH par défaut), un HeadcountSnapshot par groupe et catégorie, et les Assignment du scénario = direction actuelle de chaque position (V → aucune affectation, SUP → SUPPORT). Le seed doit être idempotent (upsert ou purge contrôlée).
5. src/app/layout.tsx : gabarit en français avec une navigation vers /plans, /parametres, /proposition, /scenarios, /import, /connexion (pages provisoires « à venir » créées comme placeholders que les autres agents remplaceront), thème clair/sombre par variables CSS (reprends les jetons du prototype), police système. Page d'accueil = résumé du scénario actif (compte des positions par direction) lu dans la base.
6. src/lib/db.ts (client Prisma singleton), src/lib/config.ts (lecture des variables d'env avec zod).
7. Vérifie : npm run db:push, npm run db:seed, npm run typecheck, npm run lint, npm run build passent. .gitignore de app/ ignore .env, dev.db*, node_modules, .next.
Dans api : décris les modèles Prisma (champs clés) et les helpers exportés. Dans notes : tout ce que les étapes suivantes doivent savoir (commandes, versions choisies).`, 'Socle')
if (!scaffold || scaffold.status === 'blocked') return { stoppedAt: 'scaffold', scaffold }

// ---------- Phase 2 : modules indépendants (dossiers disjoints) ----------
phase('Modules')
const soclePrompt = `\nSOCLE EXISTANT (résultat de l'étape précédente) :\n${scaffold.summary}\nAPI du socle : ${scaffold.api || ''}\nNotes du socle : ${scaffold.notes || ''}\n`
const [engine, importRh, auth] = await parallel([
  () => run('engine', `${CTX}${soclePrompt}
TA TÂCHE : le moteur de dispatching, pur TypeScript, dans app/src/lib/engine/ (ton seul dossier d'écriture avec app/tests/engine/).
- Porte fidèlement la logique de prototype/template.html : types Seat {id, floor, r, c, groupCode, kind, direction, fixed, zoneToFree}, islands() (composantes à distance de Tchebychev ≤ 2 par niveau, numérotées), largestRemainder(), computeQuotas({ directions:[{code, cdi, externes, recrutements, fixedSeats}], positionsToAllocate, reservePct }) → quotas, rate, alloc, reserve ; minCostFlow() ; solveFloors() ; proposeAllocation(seats, directionParams, options) → { quota, current, delta, proposed: Map<seatId, directionCode>, movements:[{seatId, floor, island, from, to}], kpis:{ positionsToAllocate, targetHeadcount, rate, changes, floorsBefore, floorsAfter } }.
- Les positions SUPPORT et les positions zoneToFree sont exclues du pool et jamais réaffectées ; les postes fixes (kind d|m) ne bougent pas ; quota ≥ postes fixes.
- Fournis aussi loadSeatsFromSituation(json) pour construire les Seat depuis data/situation.json (utile aux tests) et un adaptateur depuis les lignes Prisma (Position + Assignment) : seatsFromPositions(positions, assignments).
- Tests vitest dans app/tests/engine/ : sur data/situation.json, vérifie les quotas attendus (204/137/294/195/217), 69 changements, les niveaux avant/après par direction (voir contexte), qu'aucune position SUP ni zoneToFree ne change, que la somme des quotas vaut les positions à répartir, et un cas avec réserve 5 % (somme des quotas = alloc, positions libres restantes = réserve). Ajoute un test de performance : proposeAllocation < 1 s.
- Documente l'API en tête de fichier (JSDoc). npm test doit passer.`, 'Modules'),
  () => run('importRh', `${CTX}${soclePrompt}
TA TÂCHE : l'import de l'effectif RH, dans app/src/lib/import/ et app/src/app/import/ (tes seuls dossiers, plus app/tests/import/).
- Parseur serveur (xlsx ou csv) d'une extraction RH dont les colonnes attendues sont : Matricule, Nom, Prénom, BU, Grade (D|M|C), Directeur Split, Site, et un code de groupe (colonne « code » ou calculée depuis Directeur Split et Grade : AMMAR BLI/CANOPE→BLI, AMMAR SN3→SN3, AMMAR Autres→AMMAR AUTRES, BOUBAKER→AGAL, ZEINEB→Z, AMINE→AMINE, BEJI OMEA→OMEA, BEJI PFS→PFS, BEJI Autres→BEJI AUTRES, tout le reste→SUP). Ne garde que le site Tunis.
- Agrège par groupe et catégorie (d, m, c), compare au dernier HeadcountSnapshot (entrées, sorties, écarts par groupe), enregistre un nouveau HeadcountSnapshot et met à jour les ScenarioDirectionParam (cdi, fixedSeats) du scénario choisi après confirmation. Les personnes ne sont stockées (table Person, matricule hashé SHA-256 avec sel d'env) que si STORE_PERSONS=true ; par défaut aucune donnée nominative n'est conservée.
- Page /import : formulaire d'upload (fichier + choix du scénario), prévisualisation des écarts, bouton de confirmation ; messages en français ; journalise dans AuditLog.
- Tests vitest avec un petit CSV synthétique (noms fictifs) dans app/tests/import/.`, 'Modules'),
  () => run('auth', `${CTX}${soclePrompt}
TA TÂCHE : authentification et droits, dans app/src/lib/auth/, app/src/app/api/auth/, app/src/app/connexion/ et app/src/middleware.ts (tes seuls fichiers, plus app/tests/auth/).
- next-auth 4.x : fournisseur Azure AD (Entra ID) configuré par AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID ; fournisseur Credentials de développement actif seulement si AUTH_DEV_MODE=true, qui propose un sélecteur de rôle (SERVICES_GENERAUX, DIRECTEUR + direction, MANAGER + direction, LECTURE) sans mot de passe.
- Rôle résolu depuis la table UserRole (email → rôle, direction) ; en dev mode, depuis le sélecteur. Session JWT enrichie (role, directionCode).
- Helpers exportés : getSession(), requireRole(...roles) pour les server actions et routes, can(session, action) avec la matrice : SERVICES_GENERAUX tout ; DIRECTEUR lecture globale + édition des paramètres de sa direction + validation ; MANAGER lecture + taux de présence de ses équipes ; LECTURE lecture.
- middleware.ts : protège toutes les pages sauf /connexion et /api/auth ; en AUTH_DEV_MODE sans session, redirige vers /connexion.
- Page /connexion en français. Tests unitaires de can() dans app/tests/auth/. Documente les variables dans notes (le socle les ajoutera à .env.example si absentes).`, 'Modules'),
])
const modules = { engine, importRh, auth }
const modulesNotes = Object.entries(modules).map(([k, v]) => `${k} : ${v ? v.status + ' — ' + v.summary + '\nAPI : ' + (v.api || '') + '\nNotes : ' + (v.notes || '') : 'ÉCHEC (agent absent)'}`).join('\n\n')

// ---------- Phase 3 : couche données et services ----------
phase('Données')
const dataAccess = await run('dataAccess', `${CTX}${soclePrompt}
RÉSULTATS DES MODULES :\n${modulesNotes}
TA TÂCHE : la couche données et services dans app/src/lib/services/ et app/src/app/api/ (hors api/auth), plus app/tests/services/. Tu peux aussi appliquer les demandes de dépendances, de champs de schéma, de navigation ou de variables d'env notées par les modules (tu es autorisé pour cette étape à éditer package.json, schema.prisma, layout.tsx et .env.example, puis relance db:push et le seed).
- Services typés (zod en entrée) : scenarios (liste, création, duplication, changement de statut avec journal), directionParams (lecture et mise à jour par direction : cdi, externes, recrutements, avec la liste des Recruitment et ExternalConsultant et leur source), scenarioParams (reservePct, recruitWindowMonths, zones à libérer), plans (niveaux, cellules, positions, affectations du scénario), proposal.run(scenarioId) qui charge positions + affectations, appelle proposeAllocation du moteur, enregistre Assignment proposés (sur un scénario dérivé « Proposition de <nom> » ou en tables de proposition, à toi de choisir mais documente-le), Movement et les KPI, et proposal.get(scenarioId).
- Chaque écriture vérifie les droits avec requireRole/can du module auth et écrit un AuditLog.
- Routes API JSON correspondantes sous app/src/app/api/ (GET/POST) utilisables par l'interface, avec codes d'erreur propres.
- Tests vitest sur une base SQLite temporaire seedée : proposal.run sur « Situation 7 (classeur) » donne les quotas 204/137/294/195/217 et 69 mouvements.
Dans api : signatures des services et routes pour les agents d'interface.`, 'Données')

// ---------- Phase 4 : interface ----------
phase('Interface')
const dataNotes = dataAccess ? `\nSERVICES DISPONIBLES :\n${dataAccess.summary}\nAPI : ${dataAccess.api || ''}\nNotes : ${dataAccess.notes || ''}\n` : '\nSERVICES : étape en échec, utilise directement Prisma et le moteur.\n'
const [uiPlan, uiParams] = await parallel([
  () => run('uiPlan', `${CTX}${soclePrompt}${dataNotes}
TA TÂCHE : les plans dynamiques, dans app/src/components/plan/ et app/src/app/plans/ (tes seuls dossiers).
- Composant client PlanSvg : reprend le rendu du prototype (prototype/template.html, fonction renderPlan) en React : grille de cellules (murs, salles, bureaux de direction, extensions de bureau manager), positions colorées par direction (couleurs des directions depuis la base), postes fixes marqués D ou M, positions SUPPORT hachurées, zone à libérer du RDC hachurée avec le libellé « Salle de formation, 39 positions libérées (ex-BLI) », trois vues (situation, proposition, changements) avec contour épais des positions qui changent, légende, info-bulle ou panneau de détail au survol et au clic (niveau, ligne, colonne, îlot, groupe, direction, catégorie, proposition), résumé par direction du niveau (avant → après).
- Page /plans : onglets par niveau, sélecteur de scénario, sélecteur de vue, chargement des données par les services ou routes ; responsive (pas de défilement horizontal de la page, le plan dans un conteneur overflow-x:auto), thèmes clair et sombre via les variables CSS du socle, accessible au clavier.
- Tests : au moins un test de rendu (vitest + @testing-library/react si disponible, sinon test de la fonction de construction des cellules).`, 'Interface'),
  () => run('uiParams', `${CTX}${soclePrompt}${dataNotes}
TA TÂCHE : paramètres, proposition et scénarios, dans app/src/components/params/, app/src/app/parametres/, app/src/app/proposition/ et app/src/app/scenarios/ (tes seuls dossiers).
- /parametres : tableau par direction (CDI, externes, recrutements → effectif cible calculé), édition inline avec validation et enregistrement par les services ; sous-listes des recrutements (nombre, source SIRH ou MAIL_CLIENT, date, référence) et des externes (nombre, date de fin) ; paramètres du scénario (réserve %, fenêtre des recrutements en mois, zones à libérer listées en lecture) ; bouton « Revenir aux valeurs du classeur » (recharge les valeurs du scénario d'origine) ; indicateurs en tête : positions à répartir, effectif cible, taux commun.
- /proposition : bouton « Calculer la proposition », tableau par direction (positions actuelles, quota, écart coloré, niveaux avant → après, postes fixes, postes partagés, taux de présence moyen maximal = postes partagés / effectif flexible), liste des mouvements par niveau et par îlot, nombre de positions qui changent de direction ; bouton « Valider » (changement de statut avec droits) ; lien vers /plans en vue changements.
- /scenarios : liste, création, duplication, statut ; comparaison simple de deux scénarios (quotas et écarts côte à côte).
- Tout en français, cohérent avec le gabarit du socle ; tests vitest des fonctions de calcul d'affichage (taux, écarts) et au moins un test de rendu si @testing-library/react est disponible.`, 'Interface'),
])

// ---------- Phase 5 : qualité ----------
phase('Qualité')
const all = { scaffold, engine, importRh, auth, dataAccess, uiPlan, uiParams }
const allNotes = Object.entries(all).map(([k, v]) => `${k} : ${v ? v.status + ' — ' + v.summary + '\nNotes : ' + (v.notes || '') : 'ÉCHEC'}`).join('\n\n')
const qa = await run('qa', `${CTX}
BILAN DES ÉTAPES :\n${allNotes}
TA TÂCHE : qualité et intégration de l'application app/ (tu peux éditer tout fichier de app/, mais aucun commit).
1. Lance npm run lint, npm run typecheck, npm test, npm run db:push, npm run db:seed, npm run build ; corrige toute erreur.
2. Démarre le serveur (npm run dev ou npm run start après build) avec AUTH_DEV_MODE=true et exécute un parcours de bout en bout avec Playwright (@playwright/test, Chromium préinstallé, jamais 'playwright install') : connexion en SERVICES_GENERAUX, /plans affiche les 5 niveaux, /parametres modifie un paramètre et l'enregistre, /proposition calcule la proposition et affiche les quotas 204/137/294/195/217 et 69 mouvements sur le scénario « Situation 7 (classeur) », /plans en vue changements montre des positions marquées, /import refuse un fichier invalide. Écris ces tests dans app/e2e/ et fais passer npm run e2e.
3. Relis le code vis-à-vis des règles métier du contexte (support hors équation, zone à libérer jamais affectée, postes fixes immobiles, quota ≥ postes fixes, recrutements avec source, réserve) et corrige les écarts.
4. Vérifie qu'aucune donnée nominative ni fichier RH n'est versionnable (gitignore) et que .env.example documente toutes les variables.
Dans summary : état final, bugs trouvés et corrigés ; dans notes : ce qui reste à faire pour le lot 2.`, 'Qualité')

// ---------- Phase 6 : documentation ----------
phase('Documentation')
const docs = await run('docs', `${CTX}
ÉTAT FINAL (QA) : ${qa ? qa.status + ' — ' + qa.summary + '\nNotes : ' + (qa.notes || '') : 'QA en échec'}
TA TÂCHE : documentation, dans app/README.md et le README.md racine (section « Application (lot 1) » à ajouter sans retirer le contenu existant).
- app/README.md : prérequis, installation, variables d'environnement (.env.example), base de données (SQLite dev, PostgreSQL prod), seed, lancement, tests (unitaires, e2e), structure des dossiers, comptes de développement (AUTH_DEV_MODE), limites connues et prochaines étapes (lot 2 : taux de présence et jours).
- README racine : ajoute la section « Application (lot 1) » qui renvoie vers app/README.md et résume les commandes.
Vérifie que les commandes documentées existent dans app/package.json. Pas de commit.`, 'Documentation')

return { scaffold, engine, importRh, auth, dataAccess, uiPlan, uiParams, qa, docs }