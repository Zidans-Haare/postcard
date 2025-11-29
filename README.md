# Digitale Postkarte – Monorepo

Dieses Monorepo bündelt die drei Applikationen für das Projekt „Digitale Postkarte“ der HTW Dresden:

- `frontend/` – Öffentliche SPA für Outgoing-Studierende (Formular, PDF-Generierung, Upload)
- `admin/` – Passwortgeschützte Admin-Oberfläche (Suche, Filter, Detailansicht, Exporte)
- `backend/` – Node.js/Express API mit Dateispeicherung im Dateisystem

## Lokale Entwicklung

1. Abhängigkeiten pro Workspace installieren (offline vorbereitet, `package.json` bereits konfiguriert):
   ```bash
   npm install --workspace frontend
   npm install --workspace admin
   npm install --workspace backend
   ```
2. Backend-Umgebung konfigurieren (`backend/.env` anhand von `.env.example` anlegen):
   ```ini
   PORT=4000
   ALLOW_ORIGIN_FRONTEND=http://localhost:3000
   ALLOW_ORIGIN_ADMIN=http://localhost:3001
   UPLOAD_DIR=./uploads
   ADMIN_USER=admin
   ADMIN_PASS=bitte-ersetzen
   SESSION_SECRET=ein-langer-geheimer-wert
   RETENTION_MONTHS=24
   ```
3. Frontend & Admin benötigen die API-URL:
   ```bash
   cd frontend
   echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:4000" > .env.local
   
   cd ../admin
   echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:4000" > .env.local
   ```
4. Entwicklungs-Server starten (je Workspace):
   ```bash
   npm run dev --workspace backend
   npm run dev --workspace frontend
   npm run dev --workspace admin
   ```

## Backend – API Überblick

| Route | Beschreibung |
| --- | --- |
| `POST /api/upload` | Öffentlicher Upload, validiert Felder/Bild- & PDF-Limits, speichert in `uploads/YYYYMMDD/<ref>/` inkl. `meta.json` |
| `POST /api/auth/login` | Session-Login mit Rate-Limit und Lockout nach 10 Fehlversuchen |
| `POST /api/auth/logout` | Session invalidieren |
| `GET /api/admin/entries` | Paginierte Liste mit Suche, Filtern, Status |
| `GET /api/admin/entries/:ref` | Detaildaten + Datei-Infos |
| `GET /api/admin/entries/:ref/files/:file` | Einzeldatei (PDF/Bild) streamen |
| `GET /api/admin/entries/:ref/download/zip` | ZIP-Export (PDF + Bilder + `meta.json`) |
| `PATCH /api/admin/entries/:ref/status` | Statuswechsel (`received`, `approved`, `deleted`) |
| `GET /api/admin/export.csv/json` | Export der gefilterten Liste |

Alle Admin-Routen verlangen eine gültige Session (HTTP-only Cookie, SameSite=Lax, Secure in Production). CORS lässt ausschließlich die konfigurierten Frontend-/Admin-Origins zu. Upload- und Login-Endpunkte sind per `express-rate-limit` geschützt.

## Frontend – Outgoing

- Komplettes Formular mit Pflichtfeldern (Name, E-Mail, Zustimmung, PDF) und Live-Validierung.
- Clientseitige PDF-Erzeugung (A4 Querformat via `pdf-lib`), Download-Link & Vorschau.
- Upload mehrerer Bilder (max. 5, jeweils ≤8 MB) und Gesamtgrößenprüfung (≤30 MB).
- Erfolgsfeedback mit Referenz-ID nach erfolgreichem Upload.
- Barrierefreiheit: Labels, Tastaturfokus, `aria-live` für Statusmeldungen.

## Admin SPA

- Login-Formular mit Fehlerfeedback entsprechend Serverantworten.
- Dashboard mit Suche, Fakultäts-/Status-Filtern, Datumsfilter, Pagination (25/Seite), CSV/JSON-Export.
- Detailansicht mit PDF-Preview, Bild-Thumbnails, Statusaktionen (Freigeben, Eingegangen, Soft Delete), ZIP-Export.
- Direktdownloads delegieren an das Backend (Cookies werden automatisch mitgesendet).

## Tests & Checks

Automatisierte Tests sind noch nicht enthalten. Für manuellen Smoke-Test:

- **Frontend**: Pflichtfelder ausfüllen → PDF erzeugen → erfolgreich einreichen → Referenz-ID erscheint.
- **Backend**: Upload mit/ohne Einwilligung, falsche MIME, zu große Dateien, >5 Bilder, Statuswechsel prüfen.
- **Admin**: Login/Logout, Filter/Suchen, Detail-Downloads, Statuswechsel & Exporte verifizieren.

TypeScript/Linting:

```bash
npm run lint --workspace backend
npm run lint --workspace frontend
npm run lint --workspace admin
```

## Dateistruktur Uploads

```
uploads/
  20250130/
    AB12CD34/
      meta.json
      Postkarte_1738230000.pdf
      Bild_1738230001.jpg
```

Die `meta.json` enthält Consent, Stammdaten und Datei-Namen (siehe Projektspezifikation). Physisches Löschen ist nicht vorgesehen; „Soft Delete“ setzt nur den Status.

## Weiterentwicklung

Die Roadmap-Ideen aus der Spezifikation (S3-Storage, Mehrrollen, 2FA, Antivirus, Webhooks) können auf Basis dieser Struktur schrittweise ergänzt werden.
