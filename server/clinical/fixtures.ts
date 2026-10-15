import type { PatientCandidate, SourceRecord } from "../../shared/types";

export const SYNTHETIC_PATIENT = {
  id: "ravi", name: "Ravi Kumar", initials: "RK", birthDate: "1990-04-18",
  sex: "Male", identifiers: [{ hospital: "Aster General", value: "A-102" }, { hospital: "Meridian Medical", value: "B-507" }],
};

export const PATIENT_CANDIDATES: PatientCandidate[] = [
  { id: "candidate-ravi-b", hospitalId: "B", localId: "B-507", name: "Ravi Kumar", birthDate: "1990-04-18", phoneLast4: "0142", matchScore: 98, status: "confirmed", reasons: ["Date of birth matches", "Verified contact token matches", "Confirmed by demonstration staff"] },
  { id: "candidate-other-ravi", hospitalId: "B", localId: "B-811", name: "Ravi Kumar", birthDate: "1981-11-02", phoneLast4: "0909", matchScore: 32, status: "review-required", reasons: ["Name matches", "Date of birth differs", "Verified contact token differs; kept separate"] },
];

export const HOSPITALS = [
  { id: "A" as const, name: "Aster General", format: "Legacy laboratory JSON" },
  { id: "B" as const, name: "Meridian Medical", format: "Clinical records JSON" },
];

export const PATIENTS = [
  { ...SYNTHETIC_PATIENT, identifier: "B-507", reason: "Cross-hospital record review", lastActivity: "2026-10-14T11:00:00+05:30" },
  { id: "meera", name: "Meera Nair", initials: "MN", birthDate: "1985-08-21", sex: "Female", identifiers: [{ hospital: "Aster General", value: "A-209" }, { hospital: "Meridian Medical", value: "B-612" }], identifier: "B-612", reason: "Recent investigation review", lastActivity: "2026-10-14T09:00:00+05:30" },
  { id: "arjun", name: "Arjun Rao", initials: "AR", birthDate: "1974-02-07", sex: "Male", identifiers: [{ hospital: "Aster General", value: "A-311" }, { hospital: "Meridian Medical", value: "B-734" }], identifier: "B-734", reason: "Medication history review", lastActivity: "2026-10-13T14:00:00+05:30" },
];

export function sourcesForPatient(patientId: string): SourceRecord[] {
  if (patientId === "ravi") return structuredClone(SOURCE_RECORDS);
  const patient = PATIENTS.find((item) => item.id === patientId);
  if (!patient) return [];
  return SOURCE_RECORDS.filter((item) => item.payload.kind === "lab" || item.payload.category === "lab" || item.payload.kind === "medication")
    .filter((item) => !item.id.includes("unmapped"))
    .map((item) => ({ ...structuredClone(item), id: `${patientId}-${item.id}`, patientLocalId: patient.identifiers[item.hospitalId === "A" ? 0 : 1].value }));
}

export const TERMINOLOGY_MAPPINGS = [
  { source: "S.CREAT / CREAT_SER", canonical: "Creatinine, serum", code: "2160-0", system: "LOINC" },
  { source: "Hb / HGB", canonical: "Hemoglobin", code: "718-7", system: "LOINC" },
  { source: "PEN_ALLERGY / allergy:penicillin", canonical: "Penicillin allergy", code: "91936005", system: "SNOMED CT" },
];

export const SOURCE_RECORDS: SourceRecord[] = [
  { id: "a-creatinine-01", hospitalId: "A", patientLocalId: "A-102", version: 1, payload: { kind: "lab", test: "S.CREAT", result: 1.1, unit: "mg/dL", sampled_at: "2026-10-10T08:30:00+05:30", report_status: "final" } },
  { id: "a-hb-01", hospitalId: "A", patientLocalId: "A-102", version: 1, payload: { kind: "lab", test: "Hb", result: 13.8, unit: "g/dL", sampled_at: "2026-10-10T08:30:00+05:30", report_status: "final" } },
  { id: "a-allergy-01", hospitalId: "A", patientLocalId: "A-102", version: 1, payload: { kind: "allergy", code: "PEN_ALLERGY", description: "Penicillin allergy documented. Reaction: rash. Verification requires clinician review.", recorded_at: "2026-10-10T09:00:00+05:30" } },
  { id: "a-medication-01", hospitalId: "A", patientLocalId: "A-102", version: 1, payload: { kind: "medication", drug: "Metformin", dose: "500 mg", instruction: "Twice daily", medicine_status: "active", recorded_at: "2026-10-10T09:10:00+05:30" } },
  { id: "b-creatinine-02", hospitalId: "B", patientLocalId: "B-507", version: 1, payload: { category: "lab", analyte_code: "CREAT_SER", measured_value: 1.3, measurement_unit: "mg/dL", collectedAt: "2026-10-14T10:00:00+05:30", resultState: "final" } },
  { id: "b-allergy-02", hospitalId: "B", patientLocalId: "B-507", version: 1, payload: { category: "allergy", assertion: "none-known", statement: "No known allergies recorded at this encounter.", authoredAt: "2026-10-14T10:15:00+05:30" } },
  { id: "b-note-02", hospitalId: "B", patientLocalId: "B-507", version: 1, payload: { category: "note", heading: "Outpatient review", body: "Patient attended for follow-up. Please review the attached renal ultrasound report. No medication change is documented in this note.", missingAttachment: "Renal ultrasound report", authoredAt: "2026-10-14T11:00:00+05:30" } },
  { id: "b-unmapped-03", hospitalId: "B", patientLocalId: "B-507", version: 1, payload: { category: "lab", analyte_code: "LOCAL-X17", measured_value: 7.2, measurement_unit: "index", collectedAt: "2026-10-14T10:00:00+05:30", resultState: "final" } },
];
