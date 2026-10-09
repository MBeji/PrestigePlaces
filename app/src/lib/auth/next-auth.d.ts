import type { DefaultSession } from "next-auth";
import type { AppRole } from "./permissions";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      role: AppRole;
      directionCode: string | null;
    };
  }
  interface User {
    role?: AppRole;
    directionCode?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    directionCode?: string | null;
    provider?: string;
    /** Horodatage (ms) de la dernière lecture de UserRole. */
    roleCheckedAt?: number;
  }
}
