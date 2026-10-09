/** Validation du formulaire de connexion de développement (sélecteur de rôle, sans mot de passe). */
import { z } from "zod";
import { DIRECTIONS } from "@/lib/directions";
import { ROLE_LABELS, ROLES, ROLES_WITH_DIRECTION, type AppRole } from "./permissions";

const DIRECTION_CODES = DIRECTIONS.map((d) => d.code) as string[];

const schema = z
  .object({
    role: z.enum(ROLES),
    directionCode: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : undefined)),
    name: z
      .string()
      .trim()
      .max(80)
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .superRefine((v, ctx) => {
    if (ROLES_WITH_DIRECTION.includes(v.role)) {
      if (!v.directionCode) {
        ctx.addIssue({ code: "custom", path: ["directionCode"], message: "Direction obligatoire pour ce rôle" });
      } else if (!DIRECTION_CODES.includes(v.directionCode)) {
        ctx.addIssue({ code: "custom", path: ["directionCode"], message: "Direction inconnue" });
      }
    }
  });

export interface DevUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  directionCode: string | null;
}

/** Transforme les champs du sélecteur en utilisateur de session, ou null si invalides. */
export function parseDevLogin(input: Record<string, unknown> | undefined): DevUser | null {
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) return null;
  const { role } = parsed.data;
  const directionCode = ROLES_WITH_DIRECTION.includes(role) ? (parsed.data.directionCode ?? null) : null;
  const slug = [role, directionCode].filter(Boolean).join("-").toLowerCase();
  const email = `dev-${slug}@prestigeplaces.local`;
  const label = DIRECTIONS.find((d) => d.code === directionCode)?.label;
  const name = parsed.data.name ?? `${ROLE_LABELS[role]} (dév.)${label ? ` – ${label}` : ""}`;
  return { id: email, email, name, role, directionCode };
}
