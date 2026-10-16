import { supabaseAdmin } from "../server/auth";
import { SOURCE_RECORDS } from "../server/clinical/fixtures";
import { normalizeSource } from "../server/clinical/engine";

if (process.env.ZUMA_DEMO_SEED !== "true") throw new Error("Set ZUMA_DEMO_SEED=true to explicitly seed fictional hospital reports.");
const db = supabaseAdmin();
for (const hospitalId of ["A", "B"] as const) {
  const localId = hospitalId === "A" ? "A-102" : "B-507";
  const existing = await db.from("hospital_patients").select("full_name,birth_date").eq("hospital_id", hospitalId).eq("local_patient_id", localId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data && (existing.data.full_name !== "Ravi Kumar" || existing.data.birth_date !== "1990-04-18")) throw new Error("Existing hospital identity differs; seed stopped.");
  if (!existing.data) {
    const insert = await db.from("hospital_patients").insert({ hospital_id: hospitalId, local_patient_id: localId, full_name: "Ravi Kumar", birth_date: "1990-04-18", sex: "male", match_status: "pending" });
    if (insert.error) throw insert.error;
  }
}
for (const source of SOURCE_RECORDS) {
  const { record } = normalizeSource(source);
  const result = await db.from("medical_reports").upsert({ report_code: "zuma-demo-" + source.id, hospital_id: source.hospitalId, local_patient_id: source.patientLocalId, category: source.payload.kind ?? source.payload.category, title: record?.title ?? "Unmapped source requires review", clinical_at: source.payload.sampled_at ?? source.payload.collectedAt ?? source.payload.recorded_at ?? source.payload.authoredAt, native_payload: source.payload, fhir_resource: record?.fhir ?? null, mapping_status: record ? "mapped" : "review_required", version: source.version }, { onConflict: "hospital_id,report_code,version" });
  if (result.error) throw result.error;
}
console.log(JSON.stringify({ seededFictionalReports: SOURCE_RECORDS.length, database: "Supabase", livePatientData: false }));
