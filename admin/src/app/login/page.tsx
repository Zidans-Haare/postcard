"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./page.module.css";
import { login, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "error" | "success"; message: string }>({
    type: "idle",
    message: "",
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });
    try {
      await login(username.trim(), password);
      setStatus({ type: "success", message: "Erfolgreich eingeloggt." });
      router.replace("/dashboard");
    } catch (error) {
      if (error instanceof ApiError) {
        setStatus({ type: "error", message: error.message });
      } else {
        setStatus({ type: "error", message: "Login fehlgeschlagen." });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.wrapper}>
      <section className={styles.card}>
        <h1 className={styles.title}>Digitale Postkarte – Admin</h1>
        <p className={styles.subtitle}>
          Bitte melde dich mit deinem Admin-Zugang an. Nach 10 Fehlversuchen wird der Login für 15 Minuten gesperrt.
        </p>

        <form onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="username">
            Benutzername
          </label>
          <input
            id="username"
            name="username"
            className={styles.input}
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />

          <label className={styles.label} htmlFor="password">
            Passwort
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className={styles.input}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "Wird geprüft…" : "Anmelden"}
          </button>

          {status.type !== "idle" && (
            <div
              className={`${styles.status} ${
                status.type === "error" ? styles.statusError : styles.statusSuccess
              }`}
              role="status"
              aria-live="assertive"
            >
              {status.message}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
