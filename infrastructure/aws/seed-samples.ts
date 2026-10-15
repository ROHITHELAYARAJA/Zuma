import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { PATIENTS, sourcesForPatient } from "../../server/clinical/fixtures";
import { normalizeSource } from "../../server/clinical/engine";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { assertSyntheticRecords, evidenceObjects, syncPatientEvidence, storageConfiguration } from "../../integrations/ingestion";
import type { ClinicalRecord } from "../../shared/types";

export async function seedSyntheticSamples() {
  const base = resolve(process.cwd(), "data", "sample");
  const saved: string[] = [];
  const save = async (key: string, body: unknown, raw = false) => {
    const path = resolve(base, key);
    const within = relative(base, path);
    if (within.startsWith("..") || isAbsolute(within)) throw new Error("SAMPLE_PATH_OUTSIDE_WORKSPACE");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, raw ? String(body) : JSON.stringify(body, null, 2), "utf8");
    saved.push(key);
  };
  const upload = process.argv.includes("--upload");
  if (upload && !process.argv.includes("--apply")) throw new Error("UPLOAD_REQUIRES_APPLY_FLAG");
  let uploadedDocuments = 0;
  const fixedTime = "2026-10-15T00:00:00.000Z";
  for (const patient of PATIENTS) {
    const records: ClinicalRecord[] = [];
    for (const source of sourcesForPatient(patient.id)) {
      await save(`raw/hospital-${source.hospitalId}/${patient.id}/${source.id}.json`, { synthetic: true, patientId: patient.id, source });
      const { record, issue } = normalizeSource(source, fixedTime);
      if (!record) {
        if (issue) await save(`validation/hospital-${source.hospitalId}/${patient.id}/${source.id}.json`, { synthetic: true, withheld: true, issue });
        continue;
      }
      records.push(record);
      await save(`fhir/hospital-${source.hospitalId}/${patient.id}/${record.id}/v${record.version}.json`, record.fhir);
      const evidence = evidenceObjects(patient.id, record);
      await save(evidence.key, evidence.html, true);
      await save(evidence.metadataKey, evidence.metadata, true);
    }
    assertSyntheticRecords({ patientId: patient.id, records });
    if (upload) uploadedDocuments += (await syncPatientEvidence({ patientId: patient.id, records })).documents;
  }
  let uploadedSnapshots = 0;
  if (upload) {
    const { region, bucket, encryption } = storageConfiguration();
    const sdk = new S3Client({ region, maxAttempts: 1 });
    try {
      for (const key of saved.filter((item) => /^(raw|fhir)\//.test(item))) {
        await sdk.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: await readFile(resolve(base, key)), ContentType: "application/json", CacheControl: "no-store", ...encryption }), { abortSignal: AbortSignal.timeout(30000) });
        uploadedSnapshots += 1;
      }
    } finally { sdk.destroy(); }
  }
  return { directory: base, savedFiles: saved.length, uploadedDocuments, uploadedSnapshots, containsRealPatients: false, ingestionStarted: false, next: upload ? "Raw and FHIR snapshots are outside the KB prefix. Start an explicit ingestion job and wait for COMPLETE." : "Local samples only. --upload --apply explicitly uploads separated raw/FHIR snapshots plus normalized evidence HTML and metadata." };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) seedSyntheticSamples().then((result) => process.stdout.write(JSON.stringify(result, null, 2) + "\n")).catch((error: unknown) => { process.stderr.write((error instanceof Error ? error.message : "SAMPLE_GENERATION_FAILED") + "\n"); process.exitCode = 1; });
