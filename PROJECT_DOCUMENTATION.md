# Projekt Dokumentation: Postkarte

**Stand:** 8. Dezember 2025

## Übersicht
Das Projekt "Postkarte" ist eine Webanwendung, die aus drei Hauptkomponenten besteht: Frontend, Backend und Admin-Panel. Alle Komponenten werden als Node.js-Anwendungen ausgeführt und durch Nginx als Reverse Proxy bereitgestellt.

**Basisverzeichnis:** `/var/www/postcard`
**Domain:** `post.htw.stura-dresden.de`

## Komponenten

### 1. Frontend (Öffentlich)
Das öffentliche Interface für Benutzer.
*   **Name:** `postkarte-frontend`
*   **Technologie:** Next.js (Standalone Build)
*   **Interner Port:** 3100
*   **URL-Pfad:** `/`
*   **Ausführungspfad:** `/var/www/postcard/frontend/.next/standalone`
*   **Einstiegspunkt:** `frontend/server.js`
*   **Node Version:** 20.19.2
*   **Environment:** `production`

### 2. Admin Panel
Die Verwaltungsoberfläche.
*   **Name:** `postkarte-admin`
*   **Technologie:** Next.js (Standalone Build)
*   **Interner Port:** 3200
*   **URL-Pfad:** `/admin`
*   **Ausführungspfad:** `/var/www/postcard/admin/.next/standalone`
*   **Einstiegspunkt:** `admin/server.js`
*   **Node Version:** 20.19.2
*   **Environment:** `production`

### 3. Backend (API)
Die zentrale API für Frontend und Admin.
*   **Name:** `postkarte-backend`
*   **Technologie:** Node.js / Express (vermutet)
*   **Interner Port:** 4000
*   **URL-Pfad:** `/api/`
*   **Ausführungspfad:** `/var/www/postcard/backend`
*   **Einstiegspunkt:** `dist/server.js`
*   **Node Version:** 20.19.2
*   **Environment:** `production`
*   **Besonderheiten:** Startet mit Source Maps (`--enable-source-maps`).

## Infrastruktur & Konfiguration

### Prozessmanagement (PM2)
Alle Dienste werden durch PM2 verwaltet und überwacht.
*   PM2 Dump File: `/root/.pm2/dump.pm2`
*   Log-Dateien befinden sich unter `/root/.pm2/logs/`

### Web Server (Nginx)
Nginx fungiert als Reverse Proxy und liefert statische Dateien aus.
*   **Aktive Konfigurationsdatei:** `/etc/nginx/sites-available/postcard`
*   **Backup der alten Konfiguration:** `/root/postcard_nginx_backup_2025_12_04.conf`
*   **Vorlage (angepasst):** `/root/postcard_nginx_final.conf`

**Routing Regeln:**
*   **HTTPS Redirect:** HTTP Anfragen werden automatisch auf HTTPS umgeleitet.
*   **Frontend (`/`):** Proxy an Port 3100.
*   **Admin (`/admin`):** Proxy an Port 3200.
*   **API (`/api/`):** Proxy an Port 4000.
    *   **Besonderheit:** Enthält `proxy_set_header Origin "http://localhost:3100";` um CORS-Probleme im internen Netzwerk zu umgehen.
*   **Statische Assets:**
    *   `/_next/static`: Aus `/var/www/postcard/frontend/.next/static`
    *   `/admin/_next/static`: Aus `/var/www/postcard/admin/.next/static`
    *   `/postkarte-assets`: Aus `/var/www/postcard/frontend/public/postkarte-assets`
    *   `/vorlage.pdf`: Aus `/var/www/postcard/frontend/public/vorlage.pdf`

**Wichtige Konfigurationseinstellungen:**
*   `client_max_body_size`: 50M (für Uploads).
*   SSL Zertifikate werden via Certbot verwaltet (LetsEncrypt).

## Letzte Änderungen

### 09.12.2025: Sicherheitsupdate & Downgrade (Next.js 14)
Aufgrund von Inkompatibilitäten mit Version 16 wurde ein Downgrade auf die stabile Version 14 durchgeführt, jedoch unter Verwendung der aktuellsten Sicherheitspatches.
*   **Maßnahme:** Downgrade von `next` auf Version `14.2.23` (LTS mit Security Fixes) in allen Modulen.
*   **Security Override:** Erzwingen der `glob` Version `10.4.5` via `overrides` in `package.json`, um Schwachstellen in Entwickler-Abhängigkeiten zu beheben.
*   **Status:** System läuft stabil und sicher. Kritische Lücken (CVE-2024-46982 etc.) sind geschlossen.

### 08.12.2025: Sicherheitsupdate (Next.js/React) - VERALTET (Revidiert)
*Hinweis: Das Update auf Version 16.0.7 führte zu Build-Fehlern und wurde am 09.12.2025 revidiert (siehe oben).*
Aufgrund einer kritischen Sicherheitswarnung (CVE-2025-55182, CVE-2025-66478) wurden alle Komponenten überprüft und aktualisiert.
*   **Maßnahme:** Update von `next` auf Version `16.0.7` in `frontend`, `admin` und `backend`.
*   **Status:** Alle drei Module verwenden nun die gepatchte Version `16.0.7`.
*   **Neustart:** Alle PM2-Prozesse wurden neu gestartet, um die Änderungen wirksam zu machen.

### 4.12.2025: Nginx Konfiguration
Die Nginx-Konfiguration wurde aktualisiert, um Inkonsistenzen zu beheben:
1.  Domain auf `post.htw.stura-dresden.de` vereinheitlicht.
2.  CORS-Fix für die API hinzugefügt.
3.  Fehlende Pfade für statische Assets (`/postkarte-assets`, `/vorlage.pdf`) ergänzt.
4.  SSL-Konfiguration (Certbot) beibehalten.

## Entwicklungstools

### Snyk CLI
Snyk wurde installiert, um Sicherheitsüberprüfungen durchzuführen.
*   **Pfad:** `/root/bin/snyk`
*   **Version:** 1.1301.0 (Stand: 4.12.2025)
*   **Installation:** Manuell via Binary Download (wget).
*   **Auth:** Noch ausstehend (benötigt User-Interaktion via Browser).