import { createHash } from "node:crypto";

/** Hache un matricule (SHA-256) avec le sel d'environnement PERSON_HASH_SALT. */
export function hashMatricule(matricule: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${matricule.trim()}`).digest("hex");
}

export function storePersonsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.STORE_PERSONS === "true";
}
