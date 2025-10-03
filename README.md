# Digitale Postkarte – Monorepo

Dieses Monorepo enthält die drei Anwendungen für das Projekt "Digitale Postkarte" der HTW Dresden:

- `frontend/` – Öffentliche Single Page Application für Outgoing-Studierende
- `admin/` – Passwortgeschützte Admin-Oberfläche
- `backend/` – Node.js API für Uploads, Speicherung und Administration

Die Anwendungen sind als npm-Workspaces konfiguriert. Abhängigkeiten werden offline in den einzelnen `package.json`-Dateien deklariert und können lokal mit `npm install` im jeweiligen Workspace installiert werden.

Weitere Projektdetails, Architekturvorgaben und Akzeptanzkriterien siehe Projektspezifikation.
