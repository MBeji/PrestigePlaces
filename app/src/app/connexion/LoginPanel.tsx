"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import styles from "./connexion.module.css";

interface Option {
  code: string;
  label: string;
}

interface Props {
  signedIn: boolean;
  callbackUrl: string;
  azure: boolean;
  devMode: boolean;
  roles: Option[];
  directions: Option[];
}

const NEEDS_DIRECTION = ["DIRECTEUR", "MANAGER"];

export default function LoginPanel({ signedIn, callbackUrl, azure, devMode, roles, directions }: Props) {
  const [role, setRole] = useState("SERVICES_GENERAUX");
  const [directionCode, setDirectionCode] = useState(directions[0]?.code ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsDirection = NEEDS_DIRECTION.includes(role);

  async function devSignIn(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await signIn("dev", {
      role,
      directionCode: needsDirection ? directionCode : "",
      redirect: false,
      callbackUrl,
    });
    if (res?.ok && !res.error) {
      window.location.assign(callbackUrl);
      return;
    }
    setPending(false);
    setError("Connexion refusée : vérifiez le rôle et la direction.");
  }

  return (
    <div className={styles.panels}>
      {signedIn && (
        <div className={styles.actions}>
          <a className={styles.button} href={callbackUrl}>
            Continuer
          </a>
          <button type="button" className={styles.secondary} onClick={() => signOut({ callbackUrl: "/connexion" })}>
            Se déconnecter
          </button>
        </div>
      )}

      {azure && (
        <div className={styles.block}>
          <h2>Compte de l&apos;entreprise</h2>
          <button type="button" className={styles.button} onClick={() => signIn("azure-ad", { callbackUrl })}>
            Se connecter avec Microsoft Entra ID
          </button>
        </div>
      )}

      {devMode && (
        <form className={styles.block} onSubmit={devSignIn} aria-labelledby="dev-title">
          <h2 id="dev-title">Mode développement</h2>
          <p className={styles.hint}>Connexion sans mot de passe : choisissez un rôle pour tester les droits.</p>
          <fieldset className={styles.roles}>
            <legend>Rôle</legend>
            {roles.map((r) => (
              <label key={r.code} className={styles.radio}>
                <input
                  type="radio"
                  name="role"
                  value={r.code}
                  checked={role === r.code}
                  onChange={() => setRole(r.code)}
                />
                {r.label}
              </label>
            ))}
          </fieldset>
          {needsDirection && (
            <label className={styles.field}>
              Direction
              <select name="directionCode" value={directionCode} onChange={(e) => setDirectionCode(e.target.value)}>
                {directions.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <button type="submit" className={styles.button} disabled={pending}>
            {pending ? "Connexion…" : signedIn ? "Changer de rôle" : "Se connecter"}
          </button>
        </form>
      )}
    </div>
  );
}
