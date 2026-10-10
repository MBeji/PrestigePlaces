import { DIRECTIONS } from "@/lib/directions";
import { safeCallbackPath } from "@/lib/auth/access";
import { readAuthEnv } from "@/lib/auth/env";
import { ROLE_LABELS, ROLES } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import LoginPanel from "./LoginPanel";
import styles from "./connexion.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connexion – PrestigePlaces" };

const ERRORS: Record<string, string> = {
  AccessDenied: "Accès refusé : votre compte n'a pas de rôle dans PrestigePlaces. Contactez les services généraux.",
  CredentialsSignin: "Connexion de développement refusée : vérifiez le rôle et la direction.",
  Configuration: "L'authentification est mal configurée sur le serveur.",
  OAuthSignin: "Impossible de joindre le fournisseur d'identité.",
  OAuthCallback: "Le retour du fournisseur d'identité a échoué.",
  SessionRequired: "Veuillez vous connecter pour accéder à cette page.",
};

export default async function Page({ searchParams }: PageProps<"/connexion">) {
  const params = await searchParams;
  const callbackUrl = safeCallbackPath(params.callbackUrl);
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const env = readAuthEnv();
  const session = await getSession();
  const directions = DIRECTIONS.filter((d) => d.inEquation).map((d) => ({ code: d.code, label: d.label }));
  const directionLabel = session?.user.directionCode
    ? (DIRECTIONS.find((d) => d.code === session.user.directionCode)?.label ?? session.user.directionCode)
    : null;

  return (
    <section className={`panel ${styles.wrap}`}>
      <h1>Connexion</h1>
      <p className="sub">Accès réservé aux équipes du site de Tunis.</p>

      {errorCode && (
        <p role="alert" className={styles.error}>
          {ERRORS[errorCode] ?? "La connexion a échoué. Réessayez."}
        </p>
      )}

      {!env.secret && (
        <p role="alert" className={styles.error}>
          Aucune clé de session n&apos;est configurée : définissez AUTH_DEMO_PASSWORD (accès de démonstration) ou NEXTAUTH_SECRET dans les variables d&apos;environnement du serveur.
        </p>
      )}

      {session && (
        <div className={styles.current} data-testid="session-courante">
          <p>
            Connecté en tant que <strong>{session.user.name ?? session.user.email}</strong>
            {session.user.email && session.user.name ? ` (${session.user.email})` : ""}.
          </p>
          <p>
            Rôle : <strong>{ROLE_LABELS[session.user.role]}</strong>
            {directionLabel ? (
              <>
                {" "}
                – direction <strong>{directionLabel}</strong>
              </>
            ) : null}
          </p>
        </div>
      )}

      <LoginPanel
        signedIn={!!session}
        callbackUrl={callbackUrl}
        azure={!!env.azure}
        devMode={env.devMode}
        passwordRequired={!!env.demoPassword}
        roles={ROLES.map((r) => ({ code: r, label: ROLE_LABELS[r] }))}
        directions={directions}
      />

      {!env.azure && !env.devMode && (
        <p className={styles.error}>
          Aucun fournisseur d&apos;authentification n&apos;est configuré (AZURE_AD_*, AUTH_DEMO_PASSWORD ou AUTH_DEV_MODE).
        </p>
      )}
    </section>
  );
}
