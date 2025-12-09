export type EntryStatus = "received" | "approved" | "deleted";

export interface EntryFields {
  fullName: string;
  email: string;
  faculty?: string;
  role: "Outgoing";
  location?: string;
  term?: string;
  message?: string;
}

export interface EntryFiles {
  postcard: string;
  images: string[];
}

export interface EntryMeta {
  ref: string;
  receivedAt: string;
  status: EntryStatus;
  consent: boolean;
  raffle?: boolean;
  fields: EntryFields;
  files: EntryFiles;
  deletedAt?: string | null;
  approvedAt?: string | null;
}

export interface EntrySummary {
  ref: string;
  receivedAt: string;
  status: EntryStatus;
  consent: boolean;
  raffle?: boolean;
  fields: EntryFields;
  files: EntryFiles;
  path: string;
}
