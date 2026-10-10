/**
 * Couche services (données). Chaque fonction vérifie les droits (requirePermission), valide l'entrée avec zod,
 * journalise les écritures dans AuditLog et lève ServiceError / AuthError.
 */
export * from "./errors";
export * from "./scenarios";
export * from "./directionParams";
export * from "./scenarioParams";
export * from "./plans";
export * from "./proposal";
export * from "./overview";
export { handle, readJson } from "./http";
