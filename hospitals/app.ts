import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { HospitalId, SourceRecord } from "../shared/types";
import { HOSPITALS, PATIENTS, PATIENT_CANDIDATES, sourcesForPatient } from "../server/clinical/fixtures";
import { isLoopback, LOCAL_HOSPITAL_KEYS, MAX_HOSPITAL_RESPONSE_BYTES, recordKindSchema, safeRequestId, sourceRecordSchema } from "./contracts";

interface HospitalOptions {
  hospitalId: HospitalId;
  host?: string;
  apiKey?: string;
  dbPath?: string;
  env?: NodeJS.ProcessEnv;
}

class HospitalError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

async function readS3Records(hospitalId: HospitalId, localId: string, env: NodeJS.ProcessEnv): Promise<SourceRecord[]> {
  const { requireAwsConfiguration } = await import("../integrations/aws-config");
  const { region } = requireAwsConfiguration(env);
  const bucket = env.HOSPITAL_S3_BUCKET?.trim() || env.S3_REPORT_BUCKET?.trim();
  const prefix = env.HOSPITAL_S3_PREFIX?.trim() || `synthetic/hospital-${hospitalId.toLowerCase()}/`;
  if (!bucket || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || !/^[A-Za-z0-9_/-]+\/$/.test(prefix) || prefix.includes("..")) throw new HospitalError(503, "STORAGE_NOT_CONFIGURED");
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({ region, maxAttempts: 1 });
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: `${prefix}patients/${localId}/records.json` }), { abortSignal: AbortSignal.timeout(8000) });
    if (!object.Body || !object.ContentLength || object.ContentLength > MAX_HOSPITAL_RESPONSE_BYTES || !/^application\/(?:[\w.+-]+\+)?json\b/i.test(object.ContentType || "")) throw new HospitalError(503, "STORAGE_OBJECT_REJECTED");
    const bytes = await object.Body.transformToByteArray();
    if (bytes.byteLength > MAX_HOSPITAL_RESPONSE_BYTES) throw new HospitalError(503, "STORAGE_OBJECT_REJECTED");
    const objectValue: unknown = JSON.parse(Buffer.from(bytes).toString("utf8"));
    const raw = Array.isArray(objectValue) ? objectValue : (objectValue as { records?: unknown })?.records;
    const records = z.array(sourceRecordSchema).max(500).parse(raw);
    if (records.some(record => record.hospitalId !== hospitalId || record.patientLocalId !== localId)) throw new HospitalError(503, "STORAGE_IDENTITY_MISMATCH");
    return records;
  } catch (error) {
    if (error instanceof HospitalError) throw error;
    throw new HospitalError(503, "STORAGE_UNAVAILABLE");
  } finally { client.destroy(); }
}

export function createHospitalApp(options: HospitalOptions) {
  const env = options.env ?? process.env;
  const hospitalId = options.hospitalId;
  const hospital = HOSPITALS.find(item => item.id === hospitalId);
  if (!hospital) throw new Error("HOSPITAL_ID_INVALID");
  const host = options.host ?? env.HOST ?? "127.0.0.1";
  const localDefaultsAllowed = isLoopback(host) && env.NODE_ENV !== "production";
  const apiKey = options.apiKey ?? env.HOSPITAL_API_KEY?.trim() ?? env[`HOSPITAL_${hospitalId}_API_KEY`]?.trim() ?? (localDefaultsAllowed ? LOCAL_HOSPITAL_KEYS[hospitalId] : "");
  if (!apiKey || apiKey.length < 16 || (!localDefaultsAllowed && Object.values(LOCAL_HOSPITAL_KEYS).includes(apiKey as typeof LOCAL_HOSPITAL_KEYS.A))) throw new Error("HOSPITAL_API_KEY_REQUIRED");
  const provider = env.HOSPITAL_STORAGE_PROVIDER ?? "sqlite";
  if (!["sqlite", "s3"].includes(provider)) throw new Error("HOSPITAL_STORAGE_PROVIDER_INVALID");
  const dbPath = options.dbPath ?? env.HOSPITAL_DB_PATH ?? resolve(process.cwd(), ".data", `hospital-${hospitalId.toLowerCase()}.sqlite`);
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS patients(local_id TEXT PRIMARY KEY,name TEXT NOT NULL,birth_date TEXT NOT NULL); CREATE TABLE IF NOT EXISTS source_records(id TEXT PRIMARY KEY,patient_local_id TEXT NOT NULL,version INTEGER NOT NULL,payload_json TEXT NOT NULL,FOREIGN KEY(patient_local_id) REFERENCES patients(local_id)); CREATE TABLE IF NOT EXISTS hospital_state(id INTEGER PRIMARY KEY CHECK(id=1),available INTEGER NOT NULL); INSERT OR IGNORE INTO hospital_state(id,available) VALUES(1,1)");
  const insertPatient = db.prepare("INSERT OR IGNORE INTO patients(local_id,name,birth_date) VALUES(?,?,?)");
  const insertRecord = db.prepare("INSERT OR IGNORE INTO source_records(id,patient_local_id,version,payload_json) VALUES(?,?,?,?)");
  for (const patient of PATIENTS) {
    const localId = patient.identifiers.find(identifier => identifier.hospital === hospital.name)?.value;
    if (!localId) continue;
    insertPatient.run(localId, patient.name, patient.birthDate);
    for (const record of sourcesForPatient(patient.id).filter(record => record.hospitalId === hospitalId && record.patientLocalId === localId)) insertRecord.run(record.id, localId, record.version, JSON.stringify(record.payload));
  }
  if (hospitalId === "B") {
    const candidate = PATIENT_CANDIDATES.find(item => item.localId === "B-811")!;
    insertPatient.run(candidate.localId, candidate.name, candidate.birthDate);
    insertRecord.run("other-ravi-b-creatinine", candidate.localId, 1, JSON.stringify({ category: "lab", analyte_code: "CREAT_SER", measured_value: 0.9, measurement_unit: "mg/dL", collectedAt: "2026-10-14T08:00:00+05:30", resultState: "final" }));
  }
  const available = () => Boolean((db.prepare("SELECT available FROM hospital_state WHERE id=1").get() as { available: number }).available);
  const app = new Hono<{ Variables: { requestId: string } }>();
  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
    const supplied = c.req.header("X-Request-Id");
    const requestId = supplied && safeRequestId(supplied) ? supplied : randomUUID();
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    await next();
  });
  app.get("/health", c => c.json({ ok: true, hospitalId, hospital: hospital.name, mode: "synthetic-hospital-api", storage: provider, available: available() }));
  app.use("/v1/*", bodyLimit({ maxSize: 1024, onError: c => c.json({ error: "BODY_TOO_LARGE" }, 413) }));
  app.use("/v1/*", async (c, next) => {
    const provided = c.req.header("Authorization") ?? "";
    const actual = Buffer.from(provided);
    const expected = Buffer.from(`Bearer ${apiKey}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return c.json({ error: "UNAUTHORIZED" }, 401);
    await next();
  });
  app.post("/v1/demo/status", async c => {
    let value: unknown;
    try { value = await c.req.json(); } catch { throw new HospitalError(400, "INVALID_JSON"); }
    const input = z.object({ available: z.boolean() }).strict().safeParse(value);
    if (!input.success) throw new HospitalError(400, "INVALID_STATUS");
    db.prepare("UPDATE hospital_state SET available=? WHERE id=1").run(input.data.available ? 1 : 0);
    return c.json({ hospitalId, available: input.data.available, requestId: c.get("requestId") });
  });
  app.get("/v1/patients/:localId/records", async c => {
    if (!available()) throw new HospitalError(503, "HOSPITAL_UNAVAILABLE");
    const localId = c.req.param("localId");
    if (!/^[AB]-\d{1,12}$/.test(localId)) throw new HospitalError(404, "PATIENT_NOT_FOUND");
    const patient = db.prepare("SELECT local_id,name,birth_date FROM patients WHERE local_id=?").get(localId) as { local_id: string; name: string; birth_date: string } | undefined;
    if (!patient) throw new HospitalError(404, "PATIENT_NOT_FOUND");
    const categoriesParam = c.req.query("categories");
    const categories = categoriesParam === undefined ? recordKindSchema.options : categoriesParam.split(",");
    if (!categories.length || categories.length > 4 || !categories.every(kind => recordKindSchema.safeParse(kind).success) || new Set(categories).size !== categories.length) throw new HospitalError(400, "INVALID_CATEGORIES");
    let records: SourceRecord[];
    if (provider === "s3") records = await readS3Records(hospitalId, localId, env);
    else records = (db.prepare("SELECT id,patient_local_id,version,payload_json FROM source_records WHERE patient_local_id=? ORDER BY id").all(localId) as { id: string; patient_local_id: string; version: number; payload_json: string }[]).map(row => ({ id: row.id, hospitalId, patientLocalId: row.patient_local_id, version: row.version, payload: JSON.parse(row.payload_json) as Record<string, unknown> }));
    records = records.filter(record => categories.includes(String(record.payload.kind ?? record.payload.category) as typeof categories[number]));
    const revision = createHash("sha256").update(JSON.stringify(records)).digest("hex").slice(0, 24);
    const envelope = { hospitalId, patient: { localId, name: patient.name, birthDate: patient.birth_date }, records, revision, requestId: c.get("requestId"), sentAt: new Date().toISOString() };
    if (Buffer.byteLength(JSON.stringify(envelope)) > MAX_HOSPITAL_RESPONSE_BYTES) throw new HospitalError(503, "RESPONSE_TOO_LARGE");
    return c.json(envelope);
  });
  app.notFound(c => c.json({ error: "NOT_FOUND" }, 404));
  app.onError((error, c) => c.json({ error: error instanceof HospitalError ? error.code : "HOSPITAL_REQUEST_FAILED", requestId: c.get("requestId") }, (error instanceof HospitalError ? error.status : 500) as 400));
  return { app, close: () => db.close() };
}
