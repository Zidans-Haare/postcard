"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { createPostcardPdf, type PostcardFormData } from "@/lib/pdf";

const FACULTIES = [
  "Informatik/Mathematik",
  "Wirtschaftswissenschaften",
  "Maschinenbau/Verfahrenstechnik",
  "Elektrotechnik",
  "Design",
  "Andere",
] as const;

const MAX_MESSAGE_LENGTH = 140;
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

export default function Page() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [faculty, setFaculty] = useState<string | "">("");
  const [location, setLocation] = useState("");
  const [term, setTerm] = useState("");
  const [message, setMessage] = useState("");
  const [agree, setAgree] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "error" | "success"; message: string; ref?: string }>(
    { type: "idle", message: "" }
  );
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
  const emailValid = EMAIL_REGEX.test(email.trim());
  const trimmedLocation = location.trim();
  const trimmedMessage = message.trim();
  const trimmedName = fullName.trim();
  const trimmedTerm = term.trim();

  const totalBytes = useMemo(() => {
    const imagesBytes = images.reduce((sum, item) => sum + item.file.size, 0);
    return (pdfFile?.size ?? 0) + imagesBytes;
  }, [images, pdfFile]);

  const totalSizeDisplay = useMemo(() => {
    const megabytes = totalBytes / (1024 * 1024);
    return `${megabytes.toFixed(1)} MB`;
  }, [totalBytes]);

  const exceedsTotalLimit = totalBytes > MAX_TOTAL_BYTES;

  const formValid =
    fullName.trim().length > 0 &&
    emailValid &&
    agree &&
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

  const buildPdfPayload = (): PostcardFormData => ({
    fullName: fullName.trim() || "",
    faculty: faculty || undefined,
    location: location.trim() || undefined,
    term: term.trim() || undefined,
    message: message.trim() || undefined,
  });

  const handleGeneratePdf = async () => {
    if (!fullName.trim()) {
      setStatus({ type: "error", message: "Bitte zuerst den Namen ausfüllen." });
      return;
    }
    setPdfGenerating(true);
    setStatus({ type: "idle", message: "" });
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
      setStatus({ type: "success", message: "PDF wurde erfolgreich erzeugt." });
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "PDF konnte nicht erzeugt werden." });
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!backendUrl) {
      setStatus({ type: "error", message: "Backend-URL ist nicht konfiguriert." });
      return;
    }

    if (!pdfFile) {
      setStatus({ type: "error", message: "Bitte erzeugen Sie zuerst die Postkarte als PDF." });
      return;
    }

    if (pdfFile.size > MAX_PDF_BYTES) {
      setStatus({ type: "error", message: "PDF darf maximal 10 MB groß sein." });
      return;
    }

    if (!emailValid) {
      setStatus({ type: "error", message: "Bitte eine gültige E-Mail-Adresse angeben." });
      return;
    }

    if (exceedsTotalLimit) {
      setStatus({ type: "error", message: "Gesamtgröße überschreitet 30 MB." });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: "idle", message: "" });

    try {
      const formData = new FormData();
      formData.append("fullName", fullName.trim());
      formData.append("email", email.trim());
      if (faculty) {
        formData.append("faculty", faculty);
      }
      formData.append("role", "Outgoing");
      if (location.trim()) {
        formData.append("location", location.trim());
      }
      if (term.trim()) {
        formData.append("term", term.trim());
      }
      if (message.trim()) {
        formData.append("message", message.trim());
      }
      formData.append("agree", agree ? "true" : "false");
      formData.append("postcard", pdfFile, pdfFile.name);
      images.forEach((item, index) => {
        formData.append("images", item.file, item.file.name || `bild_${index + 1}.jpg`);
      });

      const response = await fetch(`${backendUrl.replace(/\/$/, "")}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const serverMessage = payload?.message || "Upload fehlgeschlagen.";
        setStatus({ type: "error", message: serverMessage });
        return;
      }

      const payload = (await response.json()) as { ok: boolean; ref: string };
      setStatus({
        type: "success",
        message: "Postkarte erfolgreich eingereicht!",
        ref: payload.ref,
      });
    } catch (error) {
      console.error(error);
      setStatus({ type: "error", message: "Upload fehlgeschlagen. Bitte erneut versuchen." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusClass = useMemo(() => {
    if (status.type === "error") return `${styles.status} ${styles.statusError}`;
    if (status.type === "success") return `${styles.status} ${styles.statusSuccess}`;
    return styles.status;
  }, [status.type]);

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Digitale Postkarte – Erstellen &amp; Einreichen</h1>
        <p className={styles.lead}>
          Fülle das Formular aus, erstelle deine Postkarte als PDF und reiche sie zusammen mit optionalen Bildern ein.
          Alle Felder, Hinweise und Schaltflächen sind auf Deutsch und barrierearm gestaltet.
        </p>
      </header>

      <div className={styles.contentGrid}>
        <section className={styles.formCard}>
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.formSection}>
              <h2 className={styles.sectionTitle}>Persönliche Angaben</h2>
              <label className={styles.label} htmlFor="fullName">
                Voller Name*
              </label>
              <input
                id="fullName"
                name="fullName"
                className={styles.input}
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
              />

              <label className={styles.label} htmlFor="email">
                E-Mail*
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className={styles.input}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setEmailTouched(true)}
                autoComplete="email"
                aria-invalid={emailTouched && !emailValid}
              />
              {emailTouched && !emailValid && (
                <p className={styles.hint} style={{ color: "#b91c1c" }}>
                  Bitte eine gültige E-Mail-Adresse angeben.
                </p>
              )}

              <label className={styles.label} htmlFor="faculty">
                Fakultät
              </label>
              <select
                id="faculty"
                name="faculty"
                className={styles.select}
                value={faculty}
                onChange={(event) => setFaculty(event.target.value)}
              >
                <option value="">Bitte auswählen</option>
                {FACULTIES.map((fac) => (
                  <option key={fac} value={fac}>
                    {fac}
                  </option>
                ))}
              </select>

              <label className={styles.label} htmlFor="location">
                Ort/Uni
              </label>
              <input
                id="location"
                name="location"
                className={styles.input}
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />

              <label className={styles.label} htmlFor="term">
                Zeitraum
              </label>
              <input
                id="term"
                name="term"
                className={styles.input}
                value={term}
                onChange={(event) => setTerm(event.target.value)}
              />
            </div>

            <div className={styles.formSection}>
              <h2 className={styles.sectionTitle}>Kurztext</h2>
              <label className={styles.label} htmlFor="message">
                Kurztext (max. 140 Zeichen)
              </label>
              <textarea
                id="message"
                name="message"
                className={styles.textarea}
                maxLength={MAX_MESSAGE_LENGTH}
                value={message}
                onChange={(event) => handleMessageChange(event.target.value)}
                aria-describedby="message-counter"
              />
              <div id="message-counter" className={styles.counter} aria-live="polite">
                {charCount}/{MAX_MESSAGE_LENGTH}
              </div>
            </div>

            <div className={styles.formSection}>
              <h2 className={styles.sectionTitle}>Uploads</h2>
              <p className={styles.hint}>
                Lade optional bis zu 5 Bilder (je bis 8&nbsp;MB) hoch. Die Postkarte im PDF-Format
                (max. 10&nbsp;MB) ist Pflicht.
              </p>

              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleGeneratePdf}
                  disabled={pdfGenerating}
                >
                  {pdfGenerating ? "Postkarte wird erzeugt…" : "Postkarte erzeugen (PDF)"}
                </button>
                {pdfUrl && (
                  <a className={styles.secondaryButton} href={pdfUrl} download>
                    PDF herunterladen
                  </a>
                )}
              </div>

              <label className={styles.label} htmlFor="images">
                Zusatzbilder (optional)
              </label>
              <input
                id="images"
                name="images"
                type="file"
                multiple
                accept="image/*"
                className={styles.fileInput}
                onChange={(event) => handleImageSelection(event.target.files)}
              />
              {images.length > 0 && (
                <div className={styles.fileList}>
                  {images.map((item) => (
                    <div key={item.id} className={styles.fileItem}>
                      <span>
                        {item.file.name} ({(item.file.size / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                      <button type="button" onClick={() => removeImage(item.id)}>
                        Entfernen
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <ul className={styles.summaryList}>
                <li>
                  <strong>Gesamtgröße:</strong> {totalSizeDisplay} (max. 30 MB)
                </li>
                {exceedsTotalLimit && <li style={{ color: "#b91c1c" }}>Gesamtgröße überschritten!</li>}
                {pdfFile && (
                  <li>
                    <strong>PDF:</strong> {pdfFile.name} ({(pdfFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </li>
                )}
              </ul>
            </div>

            <div className={styles.formSection}>
              <h2 className={styles.sectionTitle}>Einwilligung</h2>
              <div className={styles.checkboxRow}>
                <input
                  id="agree"
                  name="agree"
                  type="checkbox"
                  required
                  checked={agree}
                  onChange={(event) => setAgree(event.target.checked)}
                />
                <label htmlFor="agree">
                  Ich bin einverstanden, dass meine Postkarte und Bilder für HTW-Kommunikation (Web, Social Media, Print) verwendet werden. Ich habe die Datenschutzhinweise gelesen.
                </label>
              </div>
            </div>

            <div className={styles.buttonRow}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={!formValid || isSubmitting || exceedsTotalLimit}
              >
                {isSubmitting ? "Wird übermittelt…" : "Jetzt einreichen"}
              </button>
            </div>

            {status.type !== "idle" && (
              <div
                ref={statusRef}
                className={statusClass}
                role="status"
                tabIndex={-1}
                aria-live="assertive"
              >
                <p>{status.message}</p>
                {status.type === "success" && status.ref && (
                  <p>Referenz-ID: {status.ref}</p>
                )}
              </div>
            )}
          </form>
        </section>

        <aside className={styles.previewCard} aria-live="polite">
          <div className={styles.previewSurface}>
            <div className={styles.livePostcard}>
              <div className={styles.postcardLeft}>
                <div className={styles.postcardLogo}>
                  <span>STURA</span>
                  <span>HTWD</span>
                </div>
                <div className={styles.postcardHeading}>Liebe Kommiliton:innen</div>
                <div className={styles.postcardGreeting}>
                  Liebe Grüße aus {trimmedLocation || "…"}
                </div>
                <div className={styles.postcardMessage}>
                  {trimmedMessage || "Hier steht dein Kurztext."}
                </div>
                <div className={styles.postcardSignature}>
                  <strong>{trimmedName || "Deine Unterschrift"}</strong>
                  {trimmedTerm && <span>{trimmedTerm}</span>}
                  {faculty && <span>{faculty}</span>}
                </div>
              </div>
              <div className={styles.postcardRight}>
                <div className={styles.postcardStamp} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className={styles.postcardAddress}>
                  <span>HTW Dresden</span>
                  <span>Stabstelle Internationales</span>
                  <span>Friedrich-List Platz 1</span>
                  <span>01069 Dresden</span>
                </div>
              </div>
            </div>

            <div>
              <h2 className={styles.sectionTitle}>PDF-Vorschau</h2>
              {pdfUrl ? (
                <object className={styles.pdfPreview} data={pdfUrl} type="application/pdf">
                  <p>Dein Browser kann die Vorschau nicht anzeigen. Bitte nutze den Download.</p>
                </object>
              ) : (
                <div
                  className={styles.pdfPreview}
                  style={{ display: "grid", placeItems: "center", color: "#6b7280" }}
                >
                  <span>PDF wird nach der Erzeugung angezeigt.</span>
                </div>
              )}
            </div>

            <div>
              <h2 className={styles.sectionTitle}>Hilfreiche Links</h2>
              <div className={styles.resourceLinks}>
                <a href="https://www.canva.com/" target="_blank" rel="noreferrer">
                  Canva-Vorlage öffnen
                </a>
                <a href="/vorlage.pdf" download>
                  PDF-Vorlage herunterladen
                </a>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
