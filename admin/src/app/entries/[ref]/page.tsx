"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { ApiError, fetchEntry, updateEntryStatus } from "@/lib/api";

interface EntryMeta {
  ref: string;
  receivedAt: string;
  status: "approved" | "received" | "deleted";
  consent: boolean;
  fields: {
    fullName: string;
    email: string;
    faculty?: string;
    role: string;
    location?: string;
    term?: string;
    message?: string;
  };
  files: {
    postcard: string;
    images: string[];
  };
  approvedAt?: string;
  deletedAt?: string;
}

export default function EntryDetailPage() {
  const { ref } = useParams<{ ref: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<EntryMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusBox, setStatusBox] = useState<{ type: "info" | "error"; message: string } | null>(
    null
  );

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchEntry(ref);
      setEntry(data.meta);
      setStatusBox(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace("/login");
        return;
      }
      setStatusBox({
        type: "error",
        message: error instanceof ApiError ? error.message : "Eintrag konnte nicht geladen werden.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  const statusLabel = useMemo(() => {
    switch (entry?.status) {
      case "approved":
        return "Freigegeben";
      case "deleted":
        return "Gelöscht";
      default:
        return "Eingegangen";
    }
  }, [entry]);

  const statusClass = useMemo(() => {
    if (entry?.status === "approved") return `${styles.statusBadge} ${styles.statusApproved}`;
    if (entry?.status === "deleted") return `${styles.statusBadge} ${styles.statusDeleted}`;
    return styles.statusBadge;
  }, [entry]);

  const handleStatusUpdate = async (status: "approved" | "received" | "deleted") => {
    try {
      await updateEntryStatus(ref, status);
      setStatusBox({ type: "info", message: "Status wurde aktualisiert." });
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace("/login");
        return;
      }
      setStatusBox({
        type: "error",
        message: error instanceof ApiError ? error.message : "Status konnte nicht geändert werden.",
      });
    }
  };

  const pdfUrl = entry && backendUrl ? `${backendUrl}/api/admin/entries/${entry.ref}/files/${encodeURIComponent(entry.files.postcard)}` : null;
  const zipUrl = entry && backendUrl ? `${backendUrl}/api/admin/entries/${entry.ref}/download/zip` : null;

  return (
    <main className={styles.container}>
      <Link className={styles.backLink} href="/dashboard">
        ← Zurück zur Übersicht
      </Link>

      {statusBox && (
        <div
          className={`${styles.statusBox} ${statusBox.type === "error" ? styles.statusError : ""}`}
          role="status"
          aria-live="polite"
        >
          {statusBox.message}
        </div>
      )}

      {loading && <p style={{ color: "#e2e8f0" }}>Lade Eintrag…</p>}

      {entry && (
        <>
          <header className={styles.header}>
            <h1>Eintrag {entry.ref}</h1>
            <span className={statusClass}>{statusLabel}</span>
            <p>Empfangen am {new Date(entry.receivedAt).toLocaleString("de-DE")}</p>
          </header>

          <section className={styles.grid}>
            <article className={styles.card}>
              <h2>Metadaten</h2>
              <ul className={styles.metaList}>
                <li>
                  <strong>Name:</strong> {entry.fields.fullName}
                </li>
                <li>
                  <strong>E-Mail:</strong> {entry.fields.email}
                </li>
                <li>
                  <strong>Fakultät:</strong> {entry.fields.faculty ?? "—"}
                </li>
                <li>
                  <strong>Rolle:</strong> {entry.fields.role}
                </li>
                <li>
                  <strong>Ort/Uni:</strong> {entry.fields.location ?? "—"}
                </li>
                <li>
                  <strong>Zeitraum:</strong> {entry.fields.term ?? "—"}
                </li>
                <li>
                  <strong>Kurztext:</strong> {entry.fields.message ?? "—"}
                </li>
                <li>
                  <strong>Einwilligung:</strong> {entry.consent ? "Ja" : "Nein"}
                </li>
                {entry.approvedAt && (
                  <li>
                    <strong>Freigegeben am:</strong> {new Date(entry.approvedAt).toLocaleString("de-DE")}
                  </li>
                )}
                {entry.deletedAt && (
                  <li>
                    <strong>Gelöscht am:</strong> {new Date(entry.deletedAt).toLocaleString("de-DE")}
                  </li>
                )}
              </ul>

              <div className={styles.actionRow}>
                <button className={styles.actionButton} onClick={() => handleStatusUpdate("approved")}>
                  Als freigegeben markieren
                </button>
                <button className={styles.actionButton} onClick={() => handleStatusUpdate("received")}>
                  Als eingegangen markieren
                </button>
                <button
                  className={`${styles.actionButton} ${styles.actionButtonWarning}`}
                  onClick={() => handleStatusUpdate("deleted")}
                >
                  Soft Delete
                </button>
                {zipUrl && (
                  <a className={styles.actionButton} href={zipUrl} target="_blank" rel="noreferrer">
                    ZIP-Export
                  </a>
                )}
              </div>
            </article>

            <article className={styles.card}>
              <h2>PDF-Preview</h2>
              {pdfUrl ? (
                <object data={pdfUrl} type="application/pdf" className={styles.pdfFrame}>
                  <p>PDF kann nicht angezeigt werden. Bitte herunterladen.</p>
                </object>
              ) : (
                <p>Keine PDF vorhanden.</p>
              )}
              {pdfUrl && (
                <div className={styles.actionRow}>
                  <a className={styles.actionButton} href={pdfUrl} target="_blank" rel="noreferrer">
                    PDF herunterladen
                  </a>
                </div>
              )}
            </article>

            <article className={styles.card}>
              <h2>Bilder</h2>
              {entry.files.images.length === 0 && <p>Keine Bilder hochgeladen.</p>}
              {entry.files.images.length > 0 && (
                <div className={styles.imagesGrid}>
                  {entry.files.images.map((image) => (
                    <a
                      key={image}
                      href={backendUrl ? `${backendUrl}/api/admin/entries/${entry.ref}/files/${encodeURIComponent(image)}` : "#"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        className={styles.thumbnail}
                        src={backendUrl ? `${backendUrl}/api/admin/entries/${entry.ref}/files/${encodeURIComponent(image)}` : undefined}
                        alt={`Bild ${image}`}
                      />
                    </a>
                  ))}
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </main>
  );
}
