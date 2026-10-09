import type { Prisma } from "@prisma/client";
import type { AppSession } from "@/lib/auth";

export type Tx = Prisma.TransactionClient;

/** Identité de l'auteur pour le journal d'audit. */
export function actorOf(session: AppSession): string {
  return session.user.email ?? session.user.name ?? session.user.role;
}

/** Écrit une ligne AuditLog (dans la transaction de l'écriture). */
export async function audit(tx: Tx, actor: string, action: string, entity: string, entityId?: string | null, details?: unknown) {
  await tx.auditLog.create({ data: { actor, action, entity, entityId: entityId ?? null, details: (details ?? undefined) as Prisma.InputJsonValue | undefined } });
}

/** Un scénario validé ou publié n'est plus modifiable. */
export const LOCKED_STATUSES = ["VALIDATED", "PUBLISHED"] as const;
