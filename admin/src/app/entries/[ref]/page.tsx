"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { ApiError, fetchEntry, updateEntryStatus } from "@/lib/api";

interface EntryMeta {
  ref: string;
  receivedAt: string;
  status: "approved" | "received" | "deleted" | "winner";
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
  const [mediaPreview, setMediaPreview] = useState<{
    pdf?: string;
    images: Record<string, string>;
  }>({ images: {} });

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

  useEffect(() => {
    if (!entry || !backendUrl) {
      setMediaPreview({ images: {} });
      return;
    }

    let cancelled = false;
    const objectUrls: string[] = [];

    const buildUrl = (fileName: string) =>
      `${backendUrl}/api/admin/entries/${entry.ref}/files/${encodeURIComponent(fileName)}`;

    const fetchBlobUrl = async (fileName: string) => {
      const response = await fetch(buildUrl(fileName), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Datei konnte nicht geladen werden.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      objectUrls.push(url);
      return url;
    };

    const run = async () => {
      try {
        const nextPreview: { pdf?: string; images: Record<string, string> } = { images: {} };
        if (entry.files.postcard) {
          nextPreview.pdf = await fetchBlobUrl(entry.files.postcard);
        }
        for (const image of entry.files.images) {
          try {
            nextPreview.images[image] = await fetchBlobUrl(image);
          } catch (error) {
            console.warn(`Bild ${image} konnte nicht geladen werden.`, error);
          }
        }
        if (!cancelled) {
          setMediaPreview(nextPreview);
        }
      } catch (error) {
        console.warn("Medien konnten nicht geladen werden.", error);
        if (!cancelled) {
          setMediaPreview({ images: {} });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [entry, backendUrl]);

  const statusLabel = useMemo(() => {
    switch (entry?.status) {
      case "approved":
        return "Freigegeben";
      case "deleted":
        return "Gelöscht";
      case "winner":
        return "Gewinner";
      default:
        return "Eingegangen";
    }
  }, [entry]);

  const statusClass = useMemo(() => {
    if (entry?.status === "approved") return `${styles.statusBadge} ${styles.statusApproved}`;
    if (entry?.status === "deleted") return `${styles.statusBadge} ${styles.statusDeleted}`;
    if (entry?.status === "winner") return `${styles.statusBadge} ${styles.statusWinner}`; // Need to add style
    return styles.statusBadge;
  }, [entry]);

  const handleStatusUpdate = async (status: "approved" | "received" | "deleted" | "winner") => {
    if (status === "deleted") {
      if (!window.confirm("Möchtest du diesen Eintrag wirklich in den Papierkorb verschieben?")) {
        return;
      }
    }
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

  const pdfUrl = mediaPreview.pdf ?? null;
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

      {loading && <p style={{ color: "#475569" }}>Lade Eintrag…</p>}

      {entry && (
        <>
          <header className={styles.header}>
            <span className={styles.brandBadge}>StuRa HTW Dresden</span>
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
                  <strong>Kurztext:</strong> <span className={styles.metaValue}>{entry.fields.message ?? "—"}</span>
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
                  {entry.files.images.map((image) => {
                    const previewUrl = mediaPreview.images[image];
                    const downloadUrl = backendUrl
                      ? `${backendUrl}/api/admin/entries/${entry.ref}/files/${encodeURIComponent(image)}`
                      : undefined;
                    return (
                      <a key={image} href={downloadUrl} target="_blank" rel="noreferrer">
                        {previewUrl ? (
                          <img className={styles.thumbnail} src={previewUrl} alt={`Bild ${image}`} />
                        ) : (
                          <div className={styles.thumbnailFallback}>Vorschau nicht verfügbar</div>
                        )}
                      </a>
                    );
                  })}
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </main>
  );
}
