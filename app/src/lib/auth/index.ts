/** Point d'entrée serveur de l'authentification. Le proxy importe ./env directement (pas Prisma). */
export { authOptions, buildAuthOptions, DEV_PROVIDER_ID, AZURE_PROVIDER_ID } from "./options";
export { getSession, requireRole, requirePermission, AuthError, authErrorResponse, type AppSession } from "./session";
export * from "./permissions";
export { readAuthEnv } from "./env";
