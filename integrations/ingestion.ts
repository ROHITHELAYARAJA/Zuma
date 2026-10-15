import { createHash, randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, type PutObjectCommandInput } from "@aws-sdk/client-s3";
import { BedrockAgentClient, StartIngestionJobCommand, GetIngestionJobCommand } from "@aws-sdk/client-bedrock-agent";
import type { ClinicalRecord } from "../shared/types";
import { PATIENTS, sourcesForPatient } from "../server/clinical/fixtures";
import { requireAwsConfiguration } from "./aws-config";

export type EvidenceSyncInput = { patientId: string; records: ClinicalRecord[] };
export const evidenceDigest = (record: ClinicalRecord) => createHash("sha256").update(canonicalRecordText(record)).digest("hex");

export function canonicalRecordText(record: ClinicalRecord): string {
  return ["Synthetic clinical evidence. Not a real patient.", `Record: ${record.id}`, `Source: ${record.hospital}`, `Hospital: ${record.hospitalId}`, `Category: ${record.kind}`, `Clinical date: ${record.clinicalDate}`, `Version: ${record.version}`, `Title: ${record.title}`, record.text].join("\n");
}

export function assertSyntheticRecords({ patientId, records }: EvidenceSyncInput): void {
  const patient = PATIENTS.find((item) => item.id === patientId);
  if (!patient || records.length > 80) throw new Error("SYNTHETIC_PATIENT_REQUIRED");
  const knownSources = new Map(sourcesForPatient(patientId).map((source) => [source.id, source]));
  const expectedTypes = { lab: "Observation", allergy: "AllergyIntolerance", medication: "MedicationStatement", note: "DocumentReference" };
  const seen = new Set<string>();
  for (const record of records) {
    const known = knownSources.get(record.sourceId);
    const subject = (record.fhir.subject ?? record.fhir.patient) as { reference?: unknown } | undefined;
    if (!known || known.hospitalId !== record.hospitalId || known.patientLocalId !== record.patientLocalId ||
        record.id !== `record-${record.sourceId}` || record.citationId !== `cite-${record.sourceId}` ||
        !/^[A-Za-z0-9_-]{1,120}$/.test(record.id) || seen.has(record.id) ||
        !Number.isSafeInteger(record.version) || record.version < 1 ||
        !record.text?.trim() || record.text.length > 16000 || !record.title?.trim() ||
        !Number.isFinite(Date.parse(record.clinicalDate)) ||
        record.fhir.resourceType !== expectedTypes[record.kind] || record.fhir.id !== record.id ||
        subject?.reference !== `Patient/${record.patientLocalId}`) throw new Error("NORMALIZED_SYNTHETIC_RECORD_REQUIRED");
    seen.add(record.id);
  }
}

export function evidenceObjects(patientId: string, record: ClinicalRecord, mode = process.env.BEDROCK_KB_MODE ?? "managed") {
  const prefix = process.env.S3_EVIDENCE_PREFIX?.trim() || "evidence/";
  if (!/^evidence\/(?:[A-Za-z0-9_-]+\/)*$/.test(prefix)) throw new Error("S3_EVIDENCE_PREFIX_INVALID");
  if (!["managed", "customer"].includes(mode)) throw new Error("BEDROCK_KB_MODE_INVALID");
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
  const key = `${prefix}hospital-${record.hospitalId}/${patientId}/${record.id}/v${record.version}.html`;
  const attributes = { patient_id: patientId, hospital_id: record.hospitalId, record_id: record.id, version: record.version, category: record.kind, content_sha256: evidenceDigest(record), synthetic: true };
  const typed = Object.fromEntries(Object.entries(attributes).map(([name, value]) => [name, { value: typeof value === "number" ? { type: "NUMBER", numberValue: value } : typeof value === "boolean" ? { type: "BOOLEAN", booleanValue: value } : { type: "STRING", stringValue: value }, includeForEmbedding: false }]));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(record.title)} — synthetic evidence</title></head><body><article><h1>${escape(record.title)}</h1><pre>${escape(canonicalRecordText(record))}</pre></article></body></html>`;
  return { key, html, metadataKey: `${key}.metadata.json`, metadata: JSON.stringify({ metadataAttributes: mode === "managed" ? typed : attributes }) };
}

export function storageConfiguration() {
  const { region } = requireAwsConfiguration();
  const bucket = process.env.S3_REPORT_BUCKET?.trim();
  if (!bucket || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error("S3_REPORT_BUCKET_REQUIRED");
  const kmsKeyId = process.env.S3_KMS_KEY_ID?.trim();
  const encryption: Pick<PutObjectCommandInput, "ServerSideEncryption" | "SSEKMSKeyId"> = kmsKeyId ? { ServerSideEncryption: "aws:kms", SSEKMSKeyId: kmsKeyId } : process.env.S3_ENCRYPTION === "AES256" ? { ServerSideEncryption: "AES256" } : {};
  if (!encryption.ServerSideEncryption) throw new Error("S3_ENCRYPTION_REQUIRED: Configure S3_KMS_KEY_ID or explicitly select S3_ENCRYPTION=AES256.");
  return { region, bucket, encryption };
}

export async function syncPatientEvidence(input: EvidenceSyncInput) {
  assertSyntheticRecords(input);
  const { region, bucket, encryption } = storageConfiguration();
  const objects = input.records.map((record) => evidenceObjects(input.patientId, record));
  const client = new S3Client({ region, maxAttempts: 1 });
  const uploadedKeys: string[] = [];
  try {
    for (const object of objects) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: object.metadataKey, Body: object.metadata, ContentType: "application/json", CacheControl: "no-store", ...encryption }), { abortSignal: AbortSignal.timeout(30000) });
      uploadedKeys.push(object.metadataKey);
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: object.key, Body: object.html, ContentType: "text/html; charset=utf-8", CacheControl: "no-store", ...encryption }), { abortSignal: AbortSignal.timeout(30000) });
      uploadedKeys.push(object.key);
    }
    return { patientId: input.patientId, documents: objects.length, metadataFiles: objects.length, uploadedKeys, ingestionStarted: false, consentEnforcedBy: "live-backend-authorization" };
  } finally { client.destroy(); }
}

export function ingestionConfiguration() {
  const { region } = requireAwsConfiguration();
  const knowledgeBaseId = process.env.BEDROCK_KNOWLEDGE_BASE_ID?.trim();
  const dataSourceId = process.env.BEDROCK_DATA_SOURCE_ID?.trim();
  if (!knowledgeBaseId || !/^[A-Za-z0-9]{10}$/.test(knowledgeBaseId)) throw new Error("BEDROCK_KNOWLEDGE_BASE_ID_REQUIRED");
  if (!dataSourceId || !/^[A-Za-z0-9]{10}$/.test(dataSourceId)) throw new Error("BEDROCK_DATA_SOURCE_ID_REQUIRED");
  return { region, knowledgeBaseId, dataSourceId };
}

export async function startEvidenceIngestion() {
  const { region, ...ids } = ingestionConfiguration();
  const client = new BedrockAgentClient({ region, maxAttempts: 1 });
  try {
    const result = await client.send(new StartIngestionJobCommand({ ...ids, clientToken: randomUUID(), description: "Explicit synthetic clinical evidence synchronization" }), { abortSignal: AbortSignal.timeout(30000) });
    if (!result.ingestionJob?.ingestionJobId) throw new Error("BEDROCK_INGESTION_JOB_MISSING");
    return { jobId: result.ingestionJob.ingestionJobId, status: result.ingestionJob.status, startedAt: result.ingestionJob.startedAt?.toISOString() ?? null };
  } finally { client.destroy(); }
}

export async function getEvidenceIngestionStatus(jobId: string) {
  if (!/^[A-Za-z0-9]{10}$/.test(jobId)) throw new Error("BEDROCK_INGESTION_JOB_ID_INVALID");
  const { region, ...ids } = ingestionConfiguration();
  const client = new BedrockAgentClient({ region, maxAttempts: 1 });
  try {
    const result = await client.send(new GetIngestionJobCommand({ ...ids, ingestionJobId: jobId }), { abortSignal: AbortSignal.timeout(30000) });
    const job = result.ingestionJob;
    if (!job) throw new Error("BEDROCK_INGESTION_JOB_MISSING");
    return { jobId: job.ingestionJobId, status: job.status, statistics: job.statistics ?? {}, failureCount: job.failureReasons?.length ?? 0, startedAt: job.startedAt?.toISOString() ?? null, updatedAt: job.updatedAt?.toISOString() ?? null, ready: job.status === "COMPLETE" };
  } finally { client.destroy(); }
}
