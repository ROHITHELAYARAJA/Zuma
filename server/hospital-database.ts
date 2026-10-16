import { isDeepStrictEqual } from "node:util";
import { supabaseAdmin } from "./auth";
import { ClinicalError, normalizeSource } from "./clinical/engine";
import { sourceRecordSchema } from "../hospitals/contracts";
import type { HospitalId, RecordKind, SourceRecord } from "../shared/types";

export async function readHospitalDatabase(hospitalId: HospitalId, categories?: RecordKind[]): Promise<SourceRecord[]> {
  const db = supabaseAdmin(), localId = hospitalId === "A" ? "A-102" : "B-507";
  const identity = await db.from("hospital_patients").select("full_name,birth_date").eq("hospital_id", hospitalId).eq("local_patient_id", localId).single();
  if (identity.error || identity.data?.full_name !== "Ravi Kumar" || identity.data?.birth_date !== "1990-04-18") throw new ClinicalError(409, "HOSPITAL_IDENTITY_MISMATCH", "The hospital database identity could not be verified. No records were linked.");
  let query = db.from("medical_reports").select("report_code,native_payload,fhir_resource,version").eq("hospital_id", hospitalId).eq("local_patient_id", localId).like("report_code", "zuma-demo-%").order("version", { ascending: false }).limit(80);
  if (categories) query = query.in("category", categories);
  const result = await query;
  if (result.error) throw new ClinicalError(503, "HOSPITAL_DATABASE_UNAVAILABLE", "The hospital database could not provide its records. No fixture fallback was used.");
  if (!result.data?.length) throw new ClinicalError(404, "HOSPITAL_REPORTS_UNAVAILABLE", "No matching demonstration reports exist in the hospital database.");
  const latest = new Map<string, SourceRecord>();
  for (const row of result.data) {
    const source = sourceRecordSchema.parse({ id: row.report_code.slice("zuma-demo-".length), hospitalId, patientLocalId: localId, version: row.version, payload: row.native_payload });
    const normalized = normalizeSource(source);
    if (normalized.record && !isDeepStrictEqual(normalized.record.fhir, row.fhir_resource)) throw new ClinicalError(409, "FHIR_SOURCE_CHANGED", "Stored FHIR differs from the hospital source. Review the mapping before exchange.");
    if (!latest.has(source.id)) latest.set(source.id, source);
  }
  return [...latest.values()];
}
