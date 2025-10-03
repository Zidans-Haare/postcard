const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!backendUrl) {
  console.warn("NEXT_PUBLIC_BACKEND_URL ist nicht gesetzt. Admin-API-Aufrufe schlagen vermutlich fehl.");
}

interface ApiFetchOptions extends RequestInit {
  parseJson?: boolean;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  if (!backendUrl) {
    throw new ApiError(500, "Backend-URL ist nicht konfiguriert.");
  }
  const url = `${backendUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const shouldParseJson = options.parseJson ?? contentType.includes("application/json");
  const data = shouldParseJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message = data?.message ?? `Fehler ${response.status}`;
    throw new ApiError(response.status, message);
  }

  return (data ?? ({} as unknown)) as T;
}

export async function login(username: string, password: string) {
  return apiFetch<{ ok: boolean }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logout() {
  return apiFetch<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
  });
}

export interface EntryListItem {
  ref: string;
  receivedAt: string;
  status: "approved" | "received" | "deleted";
  consent: boolean;
  fields: {
    fullName: string;
    email: string;
    faculty?: string;
    location?: string;
    term?: string;
    message?: string;
  };
  counts: {
    images: number;
    nFiles: number;
  };
  hasPdf: boolean;
}

export interface EntryListResponse {
  ok: boolean;
  items: EntryListItem[];
  total: number;
  page: number;
  pages: number;
}

export async function fetchEntries(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      search.append(key, String(value));
    }
  });
  const query = search.size > 0 ? `?${search.toString()}` : "";
  return apiFetch<EntryListResponse>(`/api/admin/entries${query}`);
}

export interface EntryDetailResponse {
  ok: boolean;
  meta: {
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
  };
  files: {
    postcard: string;
    images: string[];
  };
}

export async function fetchEntry(ref: string) {
  return apiFetch<EntryDetailResponse>(`/api/admin/entries/${ref}`);
}

export async function updateEntryStatus(ref: string, status: "approved" | "received" | "deleted") {
  return apiFetch<{ ok: boolean }>(`/api/admin/entries/${ref}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export { ApiError };
