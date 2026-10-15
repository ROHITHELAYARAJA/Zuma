import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { HospitalId, RecordKind, SourceRecord } from "../shared/types";
import { HOSPITALS, PATIENTS } from "../server/clinical/fixtures";
import { hospitalEnvelopeSchema, isLoopback, LOCAL_HOSPITAL_KEYS, MAX_HOSPITAL_RESPONSE_BYTES, recordKindSchema, safeRequestId } from "../hospitals/contracts";

export class HospitalConnectorError extends Error {
  constructor(public code: string, public hospitalId: HospitalId) {
    super(`${code}: Hospital ${hospitalId} did not release verified source records.`);
  }
}

interface HospitalConfiguration {
  baseUrl: URL;
  key: string;
  explicitCredential: boolean;
  localDefault: boolean;
}

export interface HospitalDelivery {
  hospitalId: HospitalId;
  requestId: string;
  receivedAt: string;
  recordCount: number;
  source: "api";
  revision: string;
}

function configuration(hospitalId: HospitalId): HospitalConfiguration {
  let baseUrl: URL;
  try { baseUrl = new URL(process.env[`HOSPITAL_${hospitalId}_API_URL`]?.trim() || `http://127.0.0.1:${hospitalId === "A" ? "8791" : "8792"}/`); }
  catch { throw new HospitalConnectorError("HOSPITAL_URL_INVALID", hospitalId); }
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash || !["https:", "http:"].includes(baseUrl.protocol)) throw new HospitalConnectorError("HOSPITAL_URL_INVALID", hospitalId);
  const local = isLoopback(baseUrl.hostname) && process.env.NODE_ENV !== "production";
  if (baseUrl.protocol !== "https:" && !(local && baseUrl.protocol === "http:")) throw new HospitalConnectorError("HOSPITAL_HTTPS_REQUIRED", hospitalId);
  const configuredKey = process.env[`HOSPITAL_${hospitalId}_API_KEY`]?.trim();
  const key = configuredKey || (local ? LOCAL_HOSPITAL_KEYS[hospitalId] : "");
  if (!key || key.length < 16 || (!local && (Object.values(LOCAL_HOSPITAL_KEYS) as string[]).includes(key))) throw new HospitalConnectorError("HOSPITAL_CREDENTIAL_REQUIRED", hospitalId);
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, "")}/`;
  return { baseUrl, key, explicitCredential: Boolean(configuredKey), localDefault: key === LOCAL_HOSPITAL_KEYS[hospitalId] };
}

export function connectionConfiguration() {
  return Object.fromEntries((["A", "B"] as HospitalId[]).map(hospitalId => {
    try {
      const config = configuration(hospitalId);
      return [hospitalId, { source: "api" as const, baseUrl: config.baseUrl.toString(), configured: true, credentialConfigured: config.explicitCredential, usesLocalDemoKey: config.localDefault, transport: config.baseUrl.protocol === "https:" ? "https" as const : "loopback-http" as const }];
    } catch (error) {
      return [hospitalId, { source: "api" as const, baseUrl: "", configured: false, credentialConfigured: false, usesLocalDemoKey: false, transport: "invalid" as const, error: error instanceof HospitalConnectorError ? error.code : "HOSPITAL_CONFIGURATION_INVALID" }];
    }
  })) as Record<HospitalId, { source: "api"; baseUrl: string; configured: boolean; credentialConfigured: boolean; usesLocalDemoKey: boolean; transport: "https" | "loopback-http" | "invalid"; error?: string }>;
}

async function responseJson(response: Response, hospitalId: HospitalId): Promise<unknown> {
  if (!response.ok) throw new HospitalConnectorError(response.status === 401 || response.status === 403 ? "HOSPITAL_AUTH_FAILED" : response.status === 503 ? "HOSPITAL_UNAVAILABLE" : "HOSPITAL_REQUEST_REJECTED", hospitalId);
  if (!/^application\/(?:[\w.+-]+\+)?json\b/i.test(response.headers.get("content-type") || "")) throw new HospitalConnectorError("HOSPITAL_RESPONSE_TYPE_INVALID", hospitalId);
  const length = Number(response.headers.get("content-length") || "0");
  if (length > MAX_HOSPITAL_RESPONSE_BYTES || !response.body) throw new HospitalConnectorError("HOSPITAL_RESPONSE_SIZE_INVALID", hospitalId);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > MAX_HOSPITAL_RESPONSE_BYTES) { await reader.cancel(); throw new HospitalConnectorError("HOSPITAL_RESPONSE_SIZE_INVALID", hospitalId); }
    chunks.push(result.value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new HospitalConnectorError("HOSPITAL_RESPONSE_JSON_INVALID", hospitalId); }
}

async function hospitalRequest(hospitalId: HospitalId, requestId: string, path: string, init: RequestInit = {}) {
  if (!safeRequestId(requestId)) throw new HospitalConnectorError("HOSPITAL_REQUEST_ID_INVALID", hospitalId);
  const config = configuration(hospitalId);
  const url = new URL(path, config.baseUrl);
  try {
    const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(8000), headers: { Authorization: `Bearer ${config.key}`, Accept: "application/json", "X-Request-Id": requestId, ...(init.body ? { "Content-Type": "application/json" } : {}) } });
    return await responseJson(response, hospitalId);
  } catch (error) {
    if (error instanceof HospitalConnectorError) throw error;
    throw new HospitalConnectorError(error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name) ? "HOSPITAL_TIMEOUT" : "HOSPITAL_CONNECTION_FAILED", hospitalId);
  }
}

export async function fetchHospitalRecords(hospitalId: HospitalId, patientId: string, requestId: string, options: { categories?: RecordKind[] } = {}): Promise<{ records: SourceRecord[]; delivery: HospitalDelivery }> {
  const patient = PATIENTS.find(candidate => candidate.id === patientId);
  const hospital = HOSPITALS.find(candidate => candidate.id === hospitalId);
  const localId = patient?.identifiers.find(identifier => identifier.hospital === hospital?.name)?.value;
  if (!patient || !localId) throw new HospitalConnectorError("HOSPITAL_PATIENT_MAPPING_REQUIRED", hospitalId);
  const categories = options.categories;
  if (categories && (!categories.length || categories.length > 4 || !categories.every(kind => recordKindSchema.safeParse(kind).success) || new Set(categories).size !== categories.length)) throw new HospitalConnectorError("HOSPITAL_CATEGORIES_INVALID", hospitalId);
  const path = `v1/patients/${encodeURIComponent(localId)}/records${categories ? `?categories=${categories.map(kind => encodeURIComponent(kind)).join(",")}` : ""}`;
  const result = await hospitalRequest(hospitalId, requestId, path);
  const parsed = hospitalEnvelopeSchema.safeParse(result);
  if (!parsed.success) throw new HospitalConnectorError("HOSPITAL_ENVELOPE_INVALID", hospitalId);
  const envelope = parsed.data;
  if (envelope.hospitalId !== hospitalId || envelope.requestId !== requestId || envelope.patient.localId !== localId || envelope.patient.name !== patient.name || envelope.patient.birthDate !== patient.birthDate || envelope.records.some(record => record.hospitalId !== hospitalId || record.patientLocalId !== localId)) throw new HospitalConnectorError("HOSPITAL_IDENTITY_MISMATCH", hospitalId);
  if (new Set(envelope.records.map(record => record.id)).size !== envelope.records.length) throw new HospitalConnectorError("HOSPITAL_DUPLICATE_SOURCE_ID", hospitalId);
  if (categories && envelope.records.some(record => !categories.includes(String(record.payload.kind ?? record.payload.category) as RecordKind))) throw new HospitalConnectorError("HOSPITAL_CATEGORY_SCOPE_MISMATCH", hospitalId);
  return { records: envelope.records, delivery: { hospitalId, requestId, receivedAt: new Date().toISOString(), recordCount: envelope.records.length, source: "api", revision: envelope.revision } };
}

export async function setHospitalAvailability(hospitalId: HospitalId, available: boolean, requestId = randomUUID()): Promise<{ hospitalId: HospitalId; available: boolean; requestId: string }> {
  const result = await hospitalRequest(hospitalId, requestId, "v1/demo/status", { method: "POST", body: JSON.stringify({ available }) });
  const parsed = z.object({ hospitalId: z.enum(["A", "B"]), available: z.boolean(), requestId: z.string() }).strict().safeParse(result);
  if (!parsed.success || parsed.data.hospitalId !== hospitalId || parsed.data.available !== available || parsed.data.requestId !== requestId) throw new HospitalConnectorError("HOSPITAL_STATUS_RESPONSE_INVALID", hospitalId);
  return parsed.data;
}
