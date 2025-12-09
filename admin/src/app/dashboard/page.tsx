"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import {
  ApiError,
  EntryListItem,
  fetchEntries,
  logout,
} from "@/lib/api";

const FACULTIES = [
  "",
  "Bauingenieurwesen",
  "Elektrotechnik",
  "Informatik/Mathematik",
  "Landbau/Umwelt/Chemie",
  "Maschinenbau",
  "Geoinformation",
  "Design",
  "Wirtschaftswissenschaften",
];

const STATUSES = [
  { value: "all", label: "Alle" },
  { value: "received", label: "Eingegangen" },
  { value: "approved", label: "Freigegeben" },
  { value: "deleted", label: "Gelöscht" },
];

const PAGE_LIMIT = 25;

interface Filters {
  query: string;
  faculty: string;
  status: string;
  from: string;
  to: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>({
    query: "",
    faculty: "",
    status: "all",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<EntryListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusBox, setStatusBox] = useState<{ type: "info" | "error"; message: string } | null>(
    null
  );

  const load = async (currentFilters: Filters, currentPage: number) => {
    setLoading(true);
    try {
      const response = await fetchEntries({
        ...currentFilters,
        page: currentPage,
        limit: PAGE_LIMIT,
      });
      setItems(response.items);
      setTotal(response.total);
      setPages(response.pages);
      if (response.total === 0) {
        setStatusBox({ type: "info", message: "Keine Einträge für die aktuelle Auswahl." });
      } else {
        setStatusBox(null);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace("/login");
        return;
      }
      setStatusBox({
        type: "error",
        message: error instanceof ApiError ? error.message : "Daten konnten nicht geladen werden.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filters, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  const handleFilterInput = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setPage(1);
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({ query: "", faculty: "", status: "all", from: "", to: "" });
    setPage(1);
  };

  const goToDetail = (ref: string) => {
    router.push(`/entries/${ref}`);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  };

  const filterQueryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.append(key, value);
      }
    });
    return params.toString();
  }, [filters]);

  const currentRangeStart = (page - 1) * PAGE_LIMIT + 1;
  const currentRangeEnd = Math.min(page * PAGE_LIMIT, total);

  const statusSummary = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          acc[item.status] += 1;
          return acc;
        },
        { received: 0, approved: 0, deleted: 0 }
      ),
    [items]
  );

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <span className={styles.brandBadge}>StuRa HTW Dresden</span>
            <h1>Admin-Dashboard</h1>
            <p>Übersicht über alle eingereichten digitalen Postkarten und deren Bearbeitungsstatus.</p>
          </div>
          <div className={styles.toolbar}>
            <button className={styles.logoutButton} onClick={handleLogout}>
              Abmelden
            </button>
          </div>
        </div>
        <div className={styles.metricsRow}>
          <div className={styles.metricCard}>
            <span className={styles.metricValue}>{total}</span>
            <span className={styles.metricLabel}>Gesamt eingegangen</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricValue}>{statusSummary.received}</span>
            <span className={styles.metricLabel}>Auf dieser Seite: Eingegangen</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricValue}>{statusSummary.approved}</span>
            <span className={styles.metricLabel}>Auf dieser Seite: Freigegeben</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricValue}>{statusSummary.deleted}</span>
            <span className={styles.metricLabel}>Auf dieser Seite: Soft Delete</span>
          </div>
        </div>
      </header>

      <section className={styles.controlsCard}>
        <div className={styles.filters}>
          <input
            className={styles.input}
            name="query"
            placeholder="Suche (Name, E-Mail, Ort/Uni, Ref-ID, Kurztext)"
            value={filters.query}
            onChange={handleFilterInput}
            aria-label="Suche"
          />
          <select
            className={styles.select}
            name="faculty"
            value={filters.faculty}
            onChange={handleFilterInput}
            aria-label="Fakultät filtern"
          >
            {FACULTIES.map((faculty) => (
              <option key={faculty || "_"} value={faculty}>
                {faculty ? faculty : "Alle Fakultäten"}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            name="status"
            value={filters.status}
            onChange={handleFilterInput}
            aria-label="Status filtern"
          >
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <input
              className={styles.dateInput}
              type="date"
              name="from"
              value={filters.from}
              onChange={handleFilterInput}
              aria-label="Datum von"
            />
            <input
              className={styles.dateInput}
              type="date"
              name="to"
              value={filters.to}
              onChange={handleFilterInput}
              aria-label="Datum bis"
            />
          </div>
        </div>

        <div className={styles.actionsRow}>
          <button className={styles.actionButton} type="button" onClick={resetFilters}>
            Filter zurücksetzen
          </button>
          {backendUrl && (
            <>
              <a
                className={styles.actionButton}
                href={`${backendUrl}/api/admin/export.csv${filterQueryString ? `?${filterQueryString}` : ""}`}
                target="_blank"
                rel="noreferrer"
              >
                CSV-Export
              </a>
              <a
                className={styles.actionButton}
                href={`${backendUrl}/api/admin/export.json${filterQueryString ? `?${filterQueryString}` : ""}`}
                target="_blank"
                rel="noreferrer"
              >
                JSON-Export
              </a>
            </>
          )}
        </div>
      </section>

      {statusBox && (
        <div
          className={`${styles.statusBox} ${statusBox.type === "error" ? styles.statusError : ""}`}
          role="status"
          aria-live="polite"
        >
          {statusBox.message}
        </div>
      )}

      <section className={styles.tableWrapper} aria-busy={loading}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ref-ID</th>
              <th>Datum/Uhrzeit</th>
              <th>Name</th>
              <th>E-Mail</th>
              <th>Fakultät</th>
              <th>Ort/Uni</th>
              <th>Zeitraum</th>
              <th>Dateien</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: "2rem", textAlign: "center" }}>
                  Keine Einträge vorhanden.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.ref}>
                <td>{item.ref}</td>
                <td>{new Date(item.receivedAt).toLocaleString("de-DE")}</td>
                <td>{item.fields.fullName}</td>
                <td>{item.fields.email}</td>
                <td>{item.fields.faculty ?? "—"}</td>
                <td>{item.fields.location ?? "—"}</td>
                <td>{item.fields.term ?? "—"}</td>
                <td>
                  {item.hasPdf ? "PDF" : "—"} / {item.counts.images} Bilder
                </td>
                <td>
                  <span
                    className={`${styles.badge} ${item.status === "received"
                      ? styles.badgeReceived
                      : item.status === "approved"
                        ? styles.badgeApproved
                        : styles.badgeDeleted
                      }`}
                  >
                    {item.status === "received"
                      ? "Eingegangen"
                      : item.status === "approved"
                        ? "Freigegeben"
                        : "Gelöscht"}
                  </span>
                </td>
                <td>
                  <button className={styles.linkButton} onClick={() => goToDetail(item.ref)}>
                    Details öffnen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {total > 0 && (
        <div className={styles.pagination}>
          <span>
            {currentRangeStart}–{currentRangeEnd} von {total}
          </span>
          <button onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1}>
            Zurück
          </button>
          <span>
            Seite {page} / {pages}
          </span>
          <button onClick={() => setPage((prev) => Math.min(pages, prev + 1))} disabled={page === pages}>
            Weiter
          </button>
        </div>
      )}
    </main>
  );
}
