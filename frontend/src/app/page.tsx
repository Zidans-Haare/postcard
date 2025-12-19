"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { createPostcardPdf, type PostcardFormData } from "@/lib/pdf";
import PineBranches from "../components/PineBranches";
import { COUNTRIES } from "@/lib/countries";

const FACULTIES = [
  "Bauingenieurwesen",
  "Elektrotechnik",
  "Informatik/Mathematik",
  "Landbau/Umwelt/Chemie",
  "Maschinenbau",
  "Geoinformation",
  "Design",
  "Wirtschaftswissenschaften",
] as const;

const MAX_MESSAGE_LENGTH = 1000;
const MAX_IMAGE_COUNT = 5;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const EMAIL_REGEX = /^(?:[a-zA-Z0-9_'^&+{}=\-](?:\.?[a-zA-Z0-9_'^&+{}=\-])*)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

interface ImageItem {
  id: string;
  file: File;
}

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

const Countdown = () => {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number } | null>(null);

  useEffect(() => {
    // Hardcoded deadline: January 31, 2026 23:59:59
    const deadline = new Date("2026-01-31T23:59:59");

    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = deadline.getTime() - now.getTime();

      if (difference > 0) {
        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
        };
      }
      return null;
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  if (!timeLeft) return null;

  return (
    <div style={{
      fontSize: "0.9rem",
      color: "#64748B",
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      backgroundColor: "#F1F5F9",
      padding: "0.5rem 1rem",
      borderRadius: "999px",
    }}>
      <span>⏳</span>
      <span>Einsendeschluss: {timeLeft.days}d {timeLeft.hours}h</span>
    </div>
  );
};

export default function Page() {
  const backendBase = backendUrl ? backendUrl.replace(/\/$/, "") : null;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [faculty, setFaculty] = useState<string | "">("");
  const [country, setCountry] = useState<string>("");
  const [university, setUniversity] = useState<string>("");
  const [term, setTerm] = useState("");
  const [message, setMessage] = useState("");
  const [agree, setAgree] = useState(false);
  const [raffle, setRaffle] = useState(false);
  const [isFreemover, setIsFreemover] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "error" | "success"; message: string; ref?: string }>(
    { type: "idle", message: "" }
  );
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Scroll to preview when it becomes visible
  useEffect(() => {
    if (showPreview) {
      const previewElement = document.getElementById("preview-section");
      if (previewElement) {
        previewElement.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [showPreview]);

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fullName.trim()) {
      setStatus({ type: "error", message: "Bitte zuerst den Namen ausfüllen." });
      return;
    }
    // Validation: if not a Freemover, both country and university must be selected.
    if (!isFreemover && (!country || !university)) {
      setStatus({ type: "error", message: "Bitte Land und Universität auswählen." });
      return;
    }

    setPdfGenerating(true);
    setPdfGenerating(true);
    setStatus({ type: "idle", message: "" });
    setIsSubmitted(false);

    try {
      const file = await createPostcardPdf(buildPdfPayload());
      if (file.size > MAX_PDF_BYTES) {
        setStatus({ type: "error", message: "PDF darf maximal 10 MB groß sein." });
        setPdfGenerating(false);
        return;
      }

      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }

      const objectUrl = URL.createObjectURL(file);
      setPdfFile(file);
      setPdfUrl(objectUrl);
      setShowPreview(true);
      setStatus({ type: "success", message: "Postkarte wurde erzeugt. Bitte überprüfe die Vorschau." });

    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "PDF konnte nicht erzeugt werden." });
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleFinalSubmit = async () => {
    if (!formValid || isSubmitting) return;
    setShowConfirmModal(true);
  };

  const confirmSubmit = async (participate: boolean) => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    setStatus({ type: "idle", message: "" });

    try {
      // 1. Upload
      const formData = new FormData();
      if (pdfFile) {
        formData.append("postcard", pdfFile);
      }

      images.forEach((item) => {
        formData.append("images", item.file);
      });

      // Meta data
      // Meta data - append individually for backend validation
      formData.append("fullName", fullName);
      const fullEmail = email.includes("@") ? email : `${email}@stud.htw-dresden.de`;
      formData.append("email", fullEmail.toLowerCase());

      const locationParts = [];
      if (university?.trim()) locationParts.push(university.trim());
      if (country?.trim()) locationParts.push(country.trim());
      const locationString = locationParts.join(", ");
      if (locationString) formData.append("location", locationString);

      if (faculty) formData.append("faculty", faculty);
      if (term.trim()) formData.append("term", term.trim());
      if (trimmedMessage) formData.append("message", trimmedMessage);
      formData.append("agree", String(agree));
      formData.append("raffle", String(participate));

      const response = await fetch(`${backendBase}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload fehlgeschlagen");
      }

      const result = await response.json();
      setStatus({
        type: "success",
        message: "Deine Postkarte wurde erfolgreich eingereicht!",
        ref: result.ref,
      });
      setIsSubmitted(true);

      // Reset form
      setShowPreview(false);
      setFullName("");
      setEmail("");
      setCountry("");
      setUniversity("");
      setFaculty("");
      setTerm("");
      setMessage("");
      setImages([]);
      setPdfFile(null);
      setPdfUrl(null);
      setAgree(false);
      setRaffle(false);
      setEmailTouched(false);

      // Refresh recent list
      mutateRecent();

    } catch (error: any) {
      console.error("Submission error:", error);
      setStatus({
        type: "error",
        message: error.message || "Ein Fehler ist aufgetreten. Bitte versuche es erneut.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const [statusQuery, setStatusQuery] = useState("");
  const [statusLookup, setStatusLookup] = useState<{
    state: "idle" | "loading" | "success" | "error";
    payload?: {
      status: "approved" | "received" | "deleted";
      receivedAt: string;
      approvedAt: string | null;
      deletedAt: string | null;
    };
    message?: string;
  }>({ state: "idle" });
  const [recentEntries, setRecentEntries] = useState<Array<{
    ref: string;
    receivedAt: string;
    location: string | null;
    postcardAvailable: boolean;
  }>>([]);
  const [recentPreviews, setRecentPreviews] = useState<Record<string, string>>({});
  const [recentError, setRecentError] = useState<string | null>(null);
  const recentPreviewsRef = useRef<Record<string, string>>({});

  const loadRecentEntries = useCallback(() => {
    if (!backendBase) {
      setRecentEntries([]);
      if (Object.keys(recentPreviewsRef.current).length > 0) {
        Object.values(recentPreviewsRef.current).forEach((url) => URL.revokeObjectURL(url));
        recentPreviewsRef.current = {};
        setRecentPreviews({});
      }
      return () => { }; // Return an empty cleanup function
    }

    const controller = new AbortController();
    setRecentError(null);

    fetch(`${backendBase}/api/status/recent`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || "Einträge konnten nicht geladen werden.");
        }
        return response.json() as Promise<{
          ok: boolean;
          items: Array<{
            ref: string;
            receivedAt: string;
            location: string | null;
            postcardAvailable: boolean;
          }>;
        }>;
      })
      .then((data) => {
        setRecentEntries(data.items);
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        console.warn('Recent entries failed', error);
        setRecentError('Aktuelle Einreichungen konnten nicht geladen werden.');
      });

    return () => controller.abort();
  }, [backendBase]);

  useEffect(() => {
    const cleanup = loadRecentEntries();
    return cleanup;
  }, [loadRecentEntries]);

  const mutateRecent = () => {
    loadRecentEntries();
  };

  useEffect(() => {
    recentPreviewsRef.current = recentPreviews;
  }, [recentPreviews]);

  useEffect(() => {
    return () => {
      Object.values(recentPreviewsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (!backendBase || recentEntries.length === 0) {
      if (Object.keys(recentPreviewsRef.current).length > 0) {
        Object.values(recentPreviewsRef.current).forEach((url) => URL.revokeObjectURL(url));
        recentPreviewsRef.current = {};
        setRecentPreviews({});
      }
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadPreviews = async () => {
      const next: Record<string, string> = {};
      for (const entry of recentEntries) {
        if (!entry.postcardAvailable || cancelled) continue;
        try {
          const response = await fetch(
            `${backendBase}/api/status/${encodeURIComponent(entry.ref)}/postcard`,
            {
              credentials: "include",
              signal: controller.signal,
            }
          );
          if (!response.ok) {
            continue;
          }
          const blob = await response.blob();
          if (cancelled) {
            continue;
          }
          const objectUrl = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            continue;
          }
          next[entry.ref] = objectUrl;
        } catch (error) {
          if ((error as Error).name === "AbortError") {
            return;
          }
          console.warn("Postcard preview failed", error);
        }
      }
      if (cancelled) {
        Object.values(next).forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      Object.values(recentPreviewsRef.current).forEach((url) => URL.revokeObjectURL(url));
      recentPreviewsRef.current = next;
      setRecentPreviews(next);
    };

    loadPreviews();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [backendBase, recentEntries]);

  const statusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status.type !== "idle" && statusRef.current) {
      statusRef.current.focus();
    }
  }, [status]);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const charCount = message.length;
  // Now only checks if prefix is non-empty since we append @stud.htw-dresden.de
  const emailValid = email.trim().length > 0;

  const locationString = isFreemover
    ? "Freemover"
    : (university ? `${university}, ${country}` : country);

  const trimmedMessage = message.trim();
  const trimmedName = fullName.trim();

  const formatDate = (value: string) => {
    if (!value) return "";
    // Hardcoded deadline: January 31, 2026 23:59:59
    const deadline = new Date("2026-01-31T23:59:59");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const termDisplay = term;

  const statusLabelMap: Record<"approved" | "received" | "deleted", string> = {
    approved: "Freigegeben",
    received: "Eingegangen",
    deleted: "Soft Delete",
  };
  const formatDateTimeShort = (iso: string) => new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("de-DE");
  };

  const totalBytes = useMemo(() => {
    const imagesBytes = images.reduce((sum, item) => sum + item.file.size, 0);
    return (pdfFile?.size ?? 0) + imagesBytes;
  }, [images, pdfFile]);

  const totalSizeDisplay = useMemo(() => {
    const megabytes = totalBytes / (1024 * 1024);
    return `${megabytes.toFixed(1)} MB`;
  }, [totalBytes]);

  const exceedsTotalLimit = totalBytes > MAX_TOTAL_BYTES;

  const canGenerate =
    fullName.trim().length > 0 &&
    emailValid &&
    agree &&
    (isFreemover || (country && university));

  const formValid =
    canGenerate &&
    pdfFile !== null;

  const handleMessageChange = (value: string) => {
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setMessage(value);
    } else {
      setMessage(value.slice(0, MAX_MESSAGE_LENGTH));
    }
  };

  const handleImageSelection = (fileList: FileList | null) => {
    if (!fileList) return;

    const newImages: ImageItem[] = [];
    let currentCount = images.length;

    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith("image/")) {
        setStatus({ type: "error", message: "Nur Bilddateien sind erlaubt." });
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setStatus({ type: "error", message: "Jedes Bild darf höchstens 8 MB haben." });
        return;
      }
      if (currentCount >= MAX_IMAGE_COUNT) {
        setStatus({ type: "error", message: "Maximal 5 Bilder möglich." });
        break;
      }
      currentCount += 1;
      newImages.push({ id: `${file.name}-${file.lastModified}-${Math.random()}`, file });
    }

    if (newImages.length > 0) {
      setImages((prev) => [...prev, ...newImages]);
      setStatus({ type: "idle", message: "" });
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((image) => image.id !== id));
  };

  const buildPdfPayload = (): PostcardFormData & { isFreemover?: boolean } => {
    return {
      fullName,
      email,
      faculty,
      location: locationString,
      country, // Pass country separately for stamp logic
      term,
      message,
      isFreemover,
      image: images[0]?.file, // Pass the first uploaded image
    };
  };



  const handleStatusLookup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!backendBase) {
      setStatusLookup({ state: "error", message: "Backend-URL ist nicht konfiguriert." });
      return;
    }

    const trimmedRef = statusQuery.trim().toUpperCase();
    if (!trimmedRef) {
      setStatusLookup({ state: "error", message: "Bitte eine Referenz-ID eingeben." });
      return;
    }

    setStatusLookup({ state: "loading" });

    try {
      const response = await fetch(
        `${backendBase}/api/status/${encodeURIComponent(trimmedRef)}`
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.message || "Referenz wurde nicht gefunden.";
        setStatusLookup({ state: "error", message });
        return;
      }
      const payload = (await response.json()) as {
        ok: boolean;
        status: "approved" | "received" | "deleted";
        receivedAt: string;
        approvedAt: string | null;
        deletedAt: string | null;
      };
      setStatusLookup({
        state: "success",
        payload: {
          status: payload.status,
          receivedAt: payload.receivedAt,
          approvedAt: payload.approvedAt,
          deletedAt: payload.deletedAt,
        },
      });
    } catch (error) {
      console.error(error);
      setStatusLookup({ state: "error", message: "Status konnte nicht abgerufen werden." });
    }
  };



  return (
    <div className={styles.shell}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <img
            src="/postkarte-assets/StuRa Logo_Digitale Postkarte 2025.svg"
            alt="HTW Dresden"
            className={styles.headerLogo}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <Countdown />
            <div className={styles.headerTitle}>Digitale Postkarte</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Hero */}
        <div className={styles.hero}>
          <div className={styles.heroContainer}>
            <h1 className={styles.heroTitle}>Digitale Postkarte</h1>
            <p className={styles.intro}>
              Erstelle deine digitale Postkarte und sende Grüße aus deinem Auslandssemester an die HTW Dresden!
              Lade ein Foto hoch, schreibe einen Text und wir drucken die Karte für dich aus.
            </p>

            <div className={styles.previewContainer}>
              <p className={styles.heroLead}>
                Versende digitale Grüße aus deinem Auslandssemester – im offiziellen HTW-Design.
                <br />
                <strong>Gewinnspiel:</strong> Die besten 3 Postkarten gewinnen einen 10€ Mensa Gutschein!
              </p>
            </div>
          </div>

          <div className={styles.recentPanel} aria-live="polite">
            <div>
              <h2 className={styles.sectionTitle}>Gerade eingereichte Postkarten</h2>
              <p className={styles.recentLead}>
                Lass dich von den neuesten Einsendungen inspirieren. Jede Karte zeigt, wie das finale Layout wirkt.
              </p>
            </div>
            {recentError && <p className={styles.recentError}>{recentError}</p>}
            {!recentError && recentEntries.length === 0 && (
              <p className={styles.recentEmpty}>Noch keine Einreichungen – sei die erste Person, die ihre Postkarte teilt!</p>
            )}
            <div className={styles.recentGrid}>
              {recentEntries.map((entry) => {
                const previewUrl = backendBase
                  ? `${backendBase}/api/status/${encodeURIComponent(entry.ref)}/postcard`
                  : undefined;
                const previewBlobUrl = recentPreviews[entry.ref];
                return (
                  <article key={entry.ref} className={styles.recentCard}>
                    <div className={styles.recentPreview}>
                      {previewBlobUrl ? (
                        <object
                          className={styles.recentPreviewFrame}
                          data={previewBlobUrl}
                          type="application/pdf"
                        >
                          {previewUrl && (
                            <a href={previewUrl} target="_blank" rel="noreferrer">
                              Postkarte öffnen
                            </a>
                          )}
                        </object>
                      ) : (
                        <div className={styles.recentPreviewFallback}>
                          <span>
                            {entry.postcardAvailable
                              ? "Vorschau wird geladen…"
                              : "Vorschau nicht verfügbar"}
                          </span>
                          {previewUrl && (
                            <a href={previewUrl} target="_blank" rel="noreferrer">
                              Postkarte öffnen
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <div className={styles.recentDetails}>
                      <p className={styles.recentLocation}>
                        {entry.location || "Ort/Uni nicht angegeben"}
                      </p>
                      <p className={styles.recentDate}>
                        Eingereicht am {formatDateTimeShort(entry.receivedAt)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className={styles.contentGrid}>
            {isSubmitted ? (
              <div className={styles.successPanel}>
                <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎉</div>
                  <h2 className={styles.sectionTitle} style={{ borderBottom: "none", marginBottom: "1rem" }}>
                    Geschafft!
                  </h2>
                  <p style={{ fontSize: "1.2rem", color: "#475569", marginBottom: "2rem", lineHeight: "1.6" }}>
                    Deine Postkarte wurde erfolgreich eingereicht und wird nun geprüft.
                  </p>
                  {status.ref && (
                    <div style={{ background: "#F1F5F9", padding: "1.5rem", borderRadius: "12px", display: "inline-block", marginBottom: "2rem" }}>
                      <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>
                        Deine Referenz-ID
                      </p>
                      <p style={{ margin: 0, fontSize: "2rem", fontWeight: "700", color: "#0F172A", fontFamily: "monospace" }}>
                        {status.ref}
                      </p>
                    </div>
                  )}
                  <p style={{ color: "#64748B", marginBottom: "3rem" }}>
                    Speichere dir die ID, um den Status deiner Karte später abzurufen.
                  </p>
                  <button
                    onClick={() => {
                      setIsSubmitted(false);
                      setStatus({ type: "idle", message: "" });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={styles.primaryButton}
                  >
                    Neue Postkarte erstellen
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Form Panel */}
                <div className={styles.formPanel}>
                  <h2 className={styles.sectionTitle}>Karte erstellen</h2>

                  <form onSubmit={handleGenerate} className={styles.form}>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="image" className={styles.label}>
                        Dein Foto hochladen
                      </label>
                      <input
                        type="file"
                        id="image"
                        accept="image/*"
                        onChange={(e) => handleImageSelection(e.target.files)}
                        className={styles.fileInput}
                      />
                      {images.length > 0 && (
                        <div style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#475569" }}>
                          Ausgewählt: {images[0].file.name}
                        </div>
                      )}
                    </div>

                    <div className={styles.fieldGroup}>
                      <label htmlFor="fullName" className={styles.label}>
                        Dein Name
                      </label>
                      <input
                        type="text"
                        id="fullName"
                        name="fullName"
                        placeholder="Vorname Nachname"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={styles.input}
                        required
                      />
                    </div>

                    <div className={styles.checkboxRow} style={{ marginBottom: "1.5rem" }}>
                      <input
                        type="checkbox"
                        id="isFreemover"
                        checked={isFreemover}
                        onChange={(e) => {
                          setIsFreemover(e.target.checked);
                          if (e.target.checked) {
                            setCountry("");
                            setUniversity("");
                          }
                        }}
                      />
                      <label htmlFor="isFreemover" style={{ fontSize: "1rem", fontWeight: "600", color: "#475569" }}>
                        Ich bin Freemover (keine Partner-Uni)
                      </label>
                    </div>

                    {!isFreemover && (
                      <>
                        {/* Country Selection */}
                        <div className={styles.fieldGroup}>
                          <label htmlFor="country" className={styles.label}>
                            Land <span className={styles.required}>*</span>
                          </label>
                          <select
                            id="country"
                            className={styles.select}
                            value={country}
                            onChange={(e) => {
                              setCountry(e.target.value);
                              setUniversity(""); // Reset university when country changes
                            }}
                            required={!isFreemover}
                          >
                            <option value="">Bitte wählen...</option>
                            {Object.keys(COUNTRIES).sort().map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* University Selection (dependent on country) */}
                        <div className={styles.fieldGroup}>
                          <label htmlFor="university" className={styles.label}>
                            Universität / Hochschule <span className={styles.required}>*</span>
                          </label>
                          <select
                            id="university"
                            className={styles.select}
                            value={university}
                            onChange={(e) => setUniversity(e.target.value)}
                            disabled={!country}
                            required={!isFreemover}
                          >
                            <option value="">
                              {country ? "Bitte wählen..." : "Zuerst Land auswählen"}
                            </option>
                            {country &&
                              COUNTRIES[country]?.map((uni) => (
                                <option key={uni} value={uni}>
                                  {uni}
                                </option>
                              ))}
                          </select>
                        </div>
                      </>
                    )}
                    <div className={styles.fieldGroup}>
                      <div className={styles.dateInputs}>
                        <div>
                          <label htmlFor="faculty" className={styles.label}>
                            Fakultät
                          </label>
                          <select
                            id="faculty"
                            name="faculty"
                            value={faculty}
                            onChange={(e) => setFaculty(e.target.value)}
                            className={styles.select}
                          >
                            <option value="">Bitte wählen...</option>
                            {FACULTIES.map((fac) => (
                              <option key={fac} value={fac}>
                                {fac}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="term" className={styles.label}>
                            Zeitraum
                            <span style={{ fontWeight: "normal", fontSize: "0.85em", color: "#64748B", marginLeft: "0.5rem" }}>
                              (Aktuell: {(() => {
                                const now = new Date();
                                const month = now.getMonth(); // 0-11
                                const year = now.getFullYear();
                                const shortYear = year % 100;
                                if (month >= 3 && month <= 8) {
                                  return `SoSe 20${shortYear}`;
                                } else {
                                  const startYear = month >= 9 ? shortYear : shortYear - 1;
                                  const endYear = startYear + 1;
                                  return `WiSe 20${startYear}/${endYear}`;
                                }
                              })()})
                            </span>
                          </label>
                          <select
                            id="term"
                            name="term"
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            className={styles.select}
                          >
                            <option value="">Bitte wählen...</option>
                            <option value="WiSe 2024/25">WiSe 2024/25</option>
                            <option value="SoSe 2025">SoSe 2025</option>
                            <option value="WiSe 2025/26">WiSe 2025/26</option>
                            <option value="SoSe 2026">SoSe 2026</option>
                            <option value="WiSe 2026/27">WiSe 2026/27</option>
                            <option value="SoSe 2027">SoSe 2027</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className={styles.fieldGroup}>
                      <label htmlFor="message" className={styles.label}>
                        Deine Nachricht
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        placeholder="Schreibe hier deinen Text..."
                        maxLength={450}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className={styles.textarea}
                      />
                      <div className={styles.counter}>
                        {message.length} / 450 Zeichen
                      </div>
                    </div>

                    <div className={styles.fieldGroup}>
                      <label htmlFor="email" className={styles.label}>
                        Deine Studierenden-E-Mail (vorname.nachname)
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input
                          type="text"
                          id="email"
                          name="email"
                          placeholder="vorname.nachname"
                          value={email}
                          onChange={(e) => setEmail(e.target.value.split("@")[0])}
                          onBlur={() => setEmailTouched(true)}
                          className={styles.input}
                          style={emailTouched && !email.trim() ? { borderColor: "#EF4444" } : { flex: 1 }}
                          required
                        />
                        <span style={{ color: "#475569", fontWeight: "600", fontSize: "0.95rem", whiteSpace: "nowrap" }}>
                          @stud.htw-dresden.de
                        </span>
                      </div>
                      {emailTouched && !email.trim() && (
                        <p style={{ color: "#EF4444", fontSize: "0.85rem", marginTop: "0.25rem" }}>
                          Bitte gib dein E-Mail-Kürzel ein.
                        </p>
                      )}
                    </div>

                    <div className={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        id="consent"
                        checked={agree}
                        onChange={(e) => setAgree(e.target.checked)}
                        required
                      />
                      <label htmlFor="consent" style={{ fontSize: "0.9rem", lineHeight: "1.4" }}>
                        Ich stimme zu, dass meine Daten verarbeitet und die Postkarte veröffentlicht wird.
                        <br />
                        <a href="https://www.htw-dresden.de/datenschutz" target="_blank" className={styles.privacyLink}>
                          Datenschutzerklärung lesen
                        </a>
                      </label>
                    </div>

                    <div className={styles.buttonRow}>
                      <button
                        type="submit"
                        className={styles.primaryButton}
                        disabled={!canGenerate}
                      >
                        Postkarte erzeugen (PDF)
                      </button>
                    </div>
                  </form>
                </div>

                {/* Preview Section - Only visible after generation */}
                {showPreview && (
                  <div id="preview-section" className={styles.previewPanel} aria-live="polite">
                    <h2 className={styles.sectionTitle}>Vorschau & Einreichen</h2>
                    <div className={styles.previewSurface}>
                      <div className={styles.livePostcard}>
                        {/* Pine Branches Overlay (Always on top) */}
                        <PineBranches
                          src="/postkarte-assets/Tannenzweige_Digitale Postkarte 2025.svg"
                          className={styles.postcardPine}
                        />

                        <div className={styles.postcardContainer}>
                          {/* Left Column (White) */}
                          <div className={styles.postcardLeftCol}>
                            <img
                              src="/postkarte-assets/StuRa Logo_Digitale Postkarte 2025.svg"
                              alt="StuRa HTW Dresden"
                              className={styles.postcardLogo}
                            />

                            <div className={styles.postcardTextContent}>
                              <div className={styles.postcardHeading}>Liebe Kommiliton:innen</div>
                              <div className={styles.postcardMessage}>
                                {trimmedMessage || "Hier steht dein Kurztext."}
                              </div>
                              {/* Signature / Meta Info */}
                              <div className={styles.postcardSignature}>
                                {locationString && (
                                  <div className={styles.postcardMeta}>
                                    <span>{locationString}</span>
                                  </div>
                                )}
                                {(faculty || termDisplay) && (
                                  <div className={styles.postcardMeta}>
                                    {faculty && <span>{faculty}</span>}
                                    {faculty && termDisplay && <span> • </span>}
                                    {termDisplay && <span>{termDisplay}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Column (Orange) */}
                          <div className={styles.postcardRightCol}>
                            <div className={styles.postcardAddress}>
                              <span>HTW Dresden</span>
                              <span>Stabsstelle Internationales</span>
                              <span>Friedrich-List Platz 1</span>
                              <span>01069 Dresden</span>
                            </div>
                          </div>
                        </div>

                        {/* Stamp Overlay (Full Page) */}
                        <div className={styles.postcardStampArea}>
                          <img
                            src="/postkarte-assets/Poststempel_Digitale Postkarte 2025.svg"
                            alt=""
                            className={styles.postcardStamp}
                          />
                        </div>
                      </div>

                      <div className={styles.buttonRow} style={{ marginTop: "2rem", justifyContent: "center" }}>
                        <button
                          type="button"
                          onClick={handleFinalSubmit}
                          className={styles.primaryButton}
                          disabled={isSubmitting}
                          style={{ backgroundColor: "#16a34a" }} // Green for submit
                        >
                          {isSubmitting ? "Wird eingereicht..." : "Postkarte einreichen"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPreview(false)}
                          className={styles.secondaryButton}
                          style={{ marginLeft: "1rem", padding: "1.2rem 2rem", borderRadius: "2px", border: "1px solid #ccc", background: "white", cursor: "pointer", fontWeight: "600", textTransform: "uppercase" }}
                        >
                          Bearbeiten
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {status.type !== "idle" && !isSubmitted && (
                  <div className={`${styles.status} ${status.type === "error" ? styles.statusError : styles.statusSuccess}`}>
                    <p>{status.message}</p>
                    {status.type === "success" && status.ref && (
                      <p>Referenz-ID: {status.ref}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className={styles.statusPanel}>
            <div>
              <h2 className={styles.sectionTitle}>Status mit Referenz-ID prüfen</h2>
              <p className={styles.statusDescription}>
                Nach dem Einreichen erhältst du eine Referenz-ID. Trage sie hier ein, um den aktuellen Bearbeitungsstand
                deiner Postkarte nachzuverfolgen.
              </p>
            </div>
            <form className={styles.statusForm} onSubmit={handleStatusLookup}>
              <div className={styles.statusInputRow}>
                <input
                  className={styles.statusInput}
                  value={statusQuery}
                  onChange={(event) => setStatusQuery(event.target.value)}
                  placeholder="Referenz-ID (z. B. AB12CD34)"
                  aria-label="Referenz-ID"
                />
                <button className={styles.statusButton} type="submit">
                  Status abrufen
                </button>
              </div>
              <div className={styles.statusResult} aria-live="polite">
                {statusLookup.state === "idle" && (
                  <span>Gib deine Referenz-ID ein und bestätige.</span>
                )}
                {statusLookup.state === "loading" && <span>Status wird geladen…</span>}
                {statusLookup.state === "error" && <span className={styles.statusResultError}>{statusLookup.message}</span>}
                {statusLookup.state === "success" && statusLookup.payload && (
                  <ul>
                    <li>
                      <strong>Status:</strong> {statusLabelMap[statusLookup.payload.status]}
                    </li>
                    <li>
                      <strong>Eingegangen:</strong> {formatDateTime(statusLookup.payload.receivedAt)}
                    </li>
                    {statusLookup.payload.approvedAt && (
                      <li>
                        <strong>Freigegeben:</strong> {formatDateTime(statusLookup.payload.approvedAt)}
                      </li>
                    )}
                    {statusLookup.payload.deletedAt && (
                      <li>
                        <strong>Soft Delete:</strong> {formatDateTime(statusLookup.payload.deletedAt)}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </form>
          </div>

          {/* Confirmation Modal */}
          {
            showConfirmModal && (
              <div className={styles.modalOverlay}>
                <div className={styles.modalContent}>
                  <h3 className={styles.modalTitle}>Gewinnspiel Teilnahme</h3>
                  <p className={styles.modalText}>
                    Möchtest du mit deiner Postkarte am Gewinnspiel teilnehmen?
                    <br /><br />
                    Die besten 3 Einsendungen gewinnen einen <strong>10€ Mensa Gutschein</strong>.
                    Wenn du teilnimmst, dürfen wir dich im Gewinnfall per E-Mail kontaktieren.
                  </p>
                  <div className={styles.modalActions}>
                    <button
                      onClick={() => confirmSubmit(true)}
                      className={styles.modalButtonPrimary}
                    >
                      Ja, teilnehmen und absenden
                    </button>
                    <button
                      onClick={() => confirmSubmit(false)}
                      className={styles.modalButtonSecondary}
                    >
                      Nein, nur absenden
                    </button>
                  </div>
                </div>
              </div>
            )
          }
        </div>
      </main >

      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div className={styles.footerLinks}>
            <a href="https://www.htw-dresden.de/datenschutz" target="_blank" className={styles.footerLink}>
              Datenschutz
            </a>
            <a href="https://www.htw-dresden.de/impressum" target="_blank" className={styles.footerLink}>
              Impressum
            </a>
            <a
              href="mailto:internationales@stura.htw-dresden.de?subject=Supportanfrage%20Digitale%20Postkarte&body=Hallo%2C%0A%0Aich%20habe%20eine%20Frage%20zur%20digitalen%20Postkarte%3A%0A%0A%5BDeine%20Nachricht%20hier%5D%0A%0A"
              className={styles.footerLink}
            >
              Support
            </a>
          </div>
          <div>&copy; {new Date().getFullYear()} StuRa HTW Dresden</div>
        </div>
      </footer>
    </div >
  );
}
