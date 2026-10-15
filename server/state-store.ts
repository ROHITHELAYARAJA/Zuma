import { DatabaseSync } from "node:sqlite";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import type { ClinicalState } from "../shared/types";
import { ClinicalError } from "./clinical/engine";
import { authProvider, supabaseAdmin } from "./auth";

export interface StoredSession { states: Record<string, ClinicalState>; createdAt: string; }
export interface StateSession { id: string; data: StoredSession; version: number; userId: string | null; expiresAt: number; }
export interface StateStore {
  load(id: string, userId: string | null): Promise<StateSession | null>;
  create(session: StateSession): Promise<void>;
  save(session: StateSession): Promise<void>;
  remove(id: string, userId: string | null): Promise<void>;
  close(): void;
  database?: DatabaseSync;
  provider: "sqlite" | "supabase";
}

export function createStateStore(options: { dbPath?: string } = {}): StateStore {
  if (authProvider() === "supabase") {
    return {
      provider: "supabase",
      async load(id, userId) {
        if (!userId) return null;
        const { data, error } = await supabaseAdmin().from("clinical_state_sessions").select("id,user_id,state,expires_at,version").eq("id", id).eq("user_id", userId).maybeSingle();
        if (error) throw new ClinicalError(503, "STATE_STORE_UNAVAILABLE", "Clinical state storage is unavailable. No local fallback is permitted in Supabase mode.");
        if (!data || Date.parse(data.expires_at) <= Date.now()) return null;
        return { id: data.id, userId: data.user_id, data: data.state as StoredSession, expiresAt: Date.parse(data.expires_at), version: data.version };
      },
      async create(session) {
        if (!session.userId) throw new ClinicalError(403, "STATE_OWNER_REQUIRED", "A verified clinician must own clinical state.");
        const { error } = await supabaseAdmin().from("clinical_state_sessions").insert({ id: session.id, user_id: session.userId, state: session.data, expires_at: new Date(session.expiresAt).toISOString(), version: 1 });
        if (error) throw new ClinicalError(503, "STATE_STORE_UNAVAILABLE", "The clinical session could not be created in Supabase.");
        session.version = 1;
      },
      async save(session) {
        const { data, error } = await supabaseAdmin().from("clinical_state_sessions").update({ state: session.data, version: session.version + 1, updated_at: new Date().toISOString() }).eq("id", session.id).eq("user_id", session.userId!).eq("version", session.version).gt("expires_at", new Date().toISOString()).select("version").maybeSingle();
        if (error) throw new ClinicalError(503, "STATE_STORE_UNAVAILABLE", "Clinical state could not be persisted.");
        if (!data) throw new ClinicalError(409, "STATE_CHANGED", "Another request changed this clinical session. Reload before retrying.");
        session.version = data.version;
      },
      async remove(id, userId) {
        const { error } = await supabaseAdmin().from("clinical_state_sessions").delete().eq("id", id).eq("user_id", userId!);
        if (error) throw new ClinicalError(503, "STATE_STORE_UNAVAILABLE", "Clinical session revocation could not be persisted.");
      },
      close() {},
    };
  }
  const path = options.dbPath ?? process.env.DB_PATH ?? resolve(process.cwd(), ".data", "clinical-demo.sqlite");
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, state TEXT NOT NULL, expires_at INTEGER NOT NULL)");
  const columns = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "version")) db.exec("ALTER TABLE sessions ADD COLUMN version INTEGER NOT NULL DEFAULT 1");
  return {
    provider: "sqlite", database: db,
    async load(id) {
      const row = db.prepare("SELECT state,expires_at,version FROM sessions WHERE id=?").get(id) as { state: string; expires_at: number; version: number } | undefined;
      return !row || row.expires_at <= Date.now() ? null : { id, userId: null, data: JSON.parse(row.state), expiresAt: row.expires_at, version: row.version };
    },
    async create(session) { db.prepare("INSERT INTO sessions(id,state,expires_at,version) VALUES(?,?,?,1)").run(session.id, JSON.stringify(session.data), session.expiresAt); session.version = 1; },
    async save(session) {
      const changed = db.prepare("UPDATE sessions SET state=?,version=version+1 WHERE id=? AND version=? AND expires_at>?").run(JSON.stringify(session.data), session.id, session.version, Date.now());
      if (Number(changed.changes) !== 1) throw new ClinicalError(409, "STATE_CHANGED", "Another request changed this clinical session. Reload before retrying.");
      session.version += 1;
    },
    async remove(id) { db.prepare("DELETE FROM sessions WHERE id=?").run(id); },
    close() { db.close(); },
  };
}
