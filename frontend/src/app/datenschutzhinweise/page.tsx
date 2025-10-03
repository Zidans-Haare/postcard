import Link from "next/link";
import styles from "./page.module.css";

export const metadata = {
  title: "Datenschutzhinweise – Digitale Postkarte",
  description:
    "Informationen zur Verarbeitung personenbezogener Daten für die Digitale Postkarte des StuRa HTW Dresden.",
};

export default function DatenschutzhinweisePage() {
  return (
    <main className={styles.shell}>
      <Link className={styles.breadcrumb} href="/">
        ← Zurück zur Postkarte
      </Link>
      <header>
        <h1 className={styles.title}>Datenschutzhinweise</h1>
        <p className={styles.lead}>
          Nachfolgend informieren wir dich über die Verarbeitung deiner personenbezogenen Daten im Rahmen der digitalen
          Postkarte des StuRa der HTW Dresden.
        </p>
      </header>

      <section className={styles.section}>
        <h2>Verantwortliche Stelle</h2>
        <p>
          StuRa HTW Dresden – Stabstelle Internationales
          <br /> Friedrich-List Platz 1, 01069 Dresden
          <br /> internationale@stura.htw-dresden.de
        </p>
      </section>

      <section className={styles.section}>
        <h2>Welche Daten werden verarbeitet?</h2>
        <ul>
          <li>Stammdaten (Name, E-Mail-Adresse, Fakultät)</li>
          <li>Angaben zum Aufenthalt (Ort/Uni, Zeitraum, Kurztext)</li>
          <li>Hochgeladene Dateien (Postkarte-PDF, optionale Bilder)</li>
          <li>Meta-Informationen (Zeitstempel, Status, Consent)</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Zweck und Rechtsgrundlage</h2>
        <p>
          Die Daten werden genutzt, um deine Postkarte zu veröffentlichen und für Kommunikationszwecke des StuRa und der
          HTW Dresden einzusetzen (Web, Social Media, Print). Rechtsgrundlage ist deine Einwilligung nach Art. 6 Abs. 1
          lit. a DSGVO.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Speicherdauer</h2>
        <p>
          Die Inhalte werden entsprechend der vereinbarten Aufbewahrungsfrist (Standard: 24 Monate) aufbewahrt. Eine
          Löschung erfolgt spätestens nach Ablauf der Frist oder nach Widerruf deiner Einwilligung.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Deine Rechte</h2>
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit
          sowie Widerruf deiner Einwilligung mit Wirkung für die Zukunft. Wende dich dazu bitte an die unten genannten
          Kontaktmöglichkeiten.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Kontakt Datenschutz</h2>
        <div className={styles.contactCard}>
          <strong>StuRa HTW Dresden – Datenschutz</strong>
          <span>Friedrich-List Platz 1, 01069 Dresden</span>
          <span>
            E-Mail: <a href="mailto:datenschutz@stura.htw-dresden.de">datenschutz@stura.htw-dresden.de</a>
          </span>
        </div>
      </section>
    </main>
  );
}
