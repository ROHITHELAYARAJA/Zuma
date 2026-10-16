import { createHash, randomUUID } from "node:crypto";
import type { AuditEvent, ChatAnswer, Citation, ClinicalRecord, ClinicalState, ClinicalSummary, FhirResource, Finding, HospitalId, MappingIssue, RecordKind, SourceRecord, ValidationResult, Workspace } from "../../shared/types";
import { HOSPITALS, PATIENT_CANDIDATES, PATIENTS, TERMINOLOGY_MAPPINGS, sourcesForPatient } from "./fixtures";

const TERMINOLOGY: Record<string, { title: string; code: string; unit: string }> = {
  GLU_FAST: { title: "Glucose, fasting, serum/plasma", code: "1558-6", unit: "mg/dL" },
  FAST_GLUCOSE: { title: "Glucose, fasting, serum/plasma", code: "1558-6", unit: "mg/dL" },
  "S.CREAT": { title: "Creatinine, serum", code: "2160-0", unit: "mg/dL" },
  CREAT_SER: { title: "Creatinine, serum", code: "2160-0", unit: "mg/dL" },
  Hb: { title: "Hemoglobin", code: "718-7", unit: "g/dL" },
  HGB: { title: "Hemoglobin", code: "718-7", unit: "g/dL" },
};
export const DEMO_DOCTOR = { id: "doctor-ananya", name: "Dr. Ananya Iyer", role: "doctor" as const, hospitalId: "B" as const, hospital: "Nisanth Hospital" };
const now = () => new Date().toISOString();
const hospitalName = (id: HospitalId) => HOSPITALS.find((item) => item.id === id)!.name;
export class ClinicalError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function addAudit(state: ClinicalState, action: string, outcome: AuditEvent["outcome"], detail: string) {
  state.audit.unshift({ id: randomUUID(), timestamp: now(), action, actor: (state.clinician ?? DEMO_DOCTOR).name, outcome, detail });
  state.audit = state.audit.slice(0, 150);
}
export function createState(patientId: string): ClinicalState {
  if (!PATIENTS.some((item) => item.id === patientId)) throw new ClinicalError(404, "PATIENT_NOT_FOUND", "Patient does not exist in this synthetic workspace.");
  const state: ClinicalState = {
    patientId, role: "doctor", consent: { id: `consent-${patientId}`, status: "active", recipient: "Hospital B", purpose: "treatment", categories: ["lab", "allergy", "medication", "note"], sourceHospitals: ["A"], expiresAt: new Date(Date.now() + 86400_000).toISOString(), updatedAt: now(), version: 1 },
    linkedPatientId: "candidate-ravi-b", connectorStatus: { A: "connected", B: "connected" }, sources: sourcesForPatient(patientId), approvedFingerprint: null, summaryNotes: "", approvedText: "", rejectedMatches: [], audit: [], revision: 1,
  };
  addAudit(state, "DEMO_INITIALIZED", "recorded", "Synthetic records loaded. Primary identity link was confirmed by demonstration staff; alternate Ravi remains separate.");
  return state;
}

export function canReadForeign(state: ClinicalState): { allowed: boolean; reason: string } {
  if (state.role !== "doctor") return { allowed: false, reason: "Payer role is not permitted to access this treatment-only consent." };
  if (!state.linkedPatientId) return { allowed: false, reason: "Patient identity has not been confirmed across hospitals." };
  if (state.consent.status !== "active") return { allowed: false, reason: "Cross-hospital consent was revoked. Only local Hospital B records are available." };
  if (Date.parse(state.consent.expiresAt) <= Date.now()) return { allowed: false, reason: "Cross-hospital consent has expired. Only local Hospital B records are available." };
  if (state.consent.recipient !== "Hospital B" || state.consent.purpose !== "treatment") return { allowed: false, reason: "Consent recipient or purpose does not permit this request." };
  return { allowed: true, reason: "Treatment access permitted for the selected categories. This is a synthetic demonstration consent." };
}

function mappingIssue(source: SourceRecord, field: string, value: unknown, message: string): MappingIssue {
  return { id: `issue-${source.id}`, hospitalId: source.hospitalId, sourceId: source.id, field, suppliedValue: String(value ?? "missing"), message, severity: "error" };
}

export function normalizeSource(source: SourceRecord, retrievedAt = now()): { record?: ClinicalRecord; issue?: MappingIssue } {
  const p = source.payload;
  const kind = String(p.kind ?? p.category ?? "") as RecordKind;
  const clinicalDate = String(p.sampled_at ?? p.collectedAt ?? p.recorded_at ?? p.authoredAt ?? "");
  if (!clinicalDate || !Number.isFinite(Date.parse(clinicalDate))) return { issue: mappingIssue(source, "clinicalDate", clinicalDate, "A valid clinical date is required. Record withheld from the clinical summary.") };
  const id = `record-${source.id}`;
  const base: ClinicalRecord = { id, sourceId: source.id, version: source.version, hospitalId: source.hospitalId, hospital: hospitalName(source.hospitalId), patientLocalId: source.patientLocalId, kind, title: "", text: "", clinicalDate, retrievedAt, fhir: { resourceType: "Basic", id }, citationId: `cite-${source.id}` };
  const subject = { reference: `Patient/${source.patientLocalId}` };
  if (kind === "lab") {
    const localCode = String(p.test ?? p.analyte_code ?? "");
    const mapping = TERMINOLOGY[localCode];
    if (!mapping) return { issue: mappingIssue(source, "testCode", localCode, "No reviewed terminology mapping exists. Human review required; the model cannot invent a code.") };
    const value = Number(p.result ?? p.measured_value);
    const unit = String(p.unit ?? p.measurement_unit ?? "");
    if (!Number.isFinite(value)) return { issue: mappingIssue(source, "value", p.result ?? p.measured_value, "Result must be a finite number.") };
    if (unit !== mapping.unit) return { issue: mappingIssue(source, "unit", unit, `Unsupported unit for ${mapping.title}. Expected ${mapping.unit}; no unverified conversion performed.`) };
    const status = String(p.report_status ?? p.resultState ?? "");
    if (!["final", "amended", "corrected", "preliminary"].includes(status)) return { issue: mappingIssue(source, "status", status, "Unsupported result status.") };
    return { record: { ...base, title: mapping.title, code: mapping.code, codeSystem: "http://loinc.org", value, unit, status, text: `${mapping.title}: ${value} ${unit}. ${status} result.`, fhir: { resourceType: "Observation", id, status, code: { coding: [{ system: "http://loinc.org", code: mapping.code, display: mapping.title }], text: mapping.title }, subject, effectiveDateTime: clinicalDate, valueQuantity: { value, unit, system: "http://unitsofmeasure.org", code: unit }, specimen: { display: "Blood specimen (source laboratory)" } } } };
  }
  if (kind === "allergy") {
    const negative = p.assertion === "none-known";
    if (!negative && p.code !== "PEN_ALLERGY") return { issue: mappingIssue(source, "allergyCode", p.code, "Unsupported allergy terminology. Clinician review required.") };
    const code = negative ? "716186003" : "91936005";
    const title = negative ? "No known allergies recorded" : "Penicillin allergy documented";
    return { record: { ...base, title, text: String(p.description ?? p.statement), code, codeSystem: "http://snomed.info/sct", assertion: negative ? "none-known" : "present", fhir: { resourceType: "AllergyIntolerance", id, clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }] }, verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", code: "unconfirmed" }] }, code: { coding: [{ system: "http://snomed.info/sct", code, display: title }], text: title }, patient: subject, recordedDate: clinicalDate, note: [{ text: String(p.description ?? p.statement) }] } } };
  }
  if (kind === "medication") {
    const title = `${String(p.drug)} ${String(p.dose)}`;
    const text = `${title}, ${String(p.instruction)}. Source status: ${String(p.medicine_status)}. Current use requires reconciliation.`;
    return { record: { ...base, title, text, status: String(p.medicine_status), fhir: { resourceType: "MedicationStatement", id, status: "active", medicationCodeableConcept: { text: String(p.drug) }, subject, dateAsserted: clinicalDate, dosage: [{ text: `${String(p.dose)} ${String(p.instruction)}` }], note: [{ text: "Historical source statement; current use requires clinician reconciliation." }] } } };
  }
  if (kind === "note") {
    return { record: { ...base, title: String(p.heading), text: String(p.body), fhir: { resourceType: "DocumentReference", id, status: "current", subject, date: clinicalDate, description: String(p.heading), content: [{ attachment: { contentType: "text/plain", title: String(p.heading), data: Buffer.from(String(p.body)).toString("base64") } }] } } };
  }
  return { issue: mappingIssue(source, "kind", kind, "Unsupported source record type.") };
}

export function retrieve(state: ClinicalState) {
  if (state.role !== "doctor") throw new ClinicalError(403, "ROLE_DENIED", "Payer access is not authorized by a treatment consent.");
  const permission = canReadForeign(state);
  const eligible = state.sources.filter((source) => state.connectorStatus[source.hospitalId] === "connected")
    .filter((source) => source.hospitalId === "B" || (permission.allowed && state.consent.sourceHospitals.includes(source.hospitalId)))
    .filter((source) => source.hospitalId === "B" || state.consent.categories.includes(String(source.payload.kind ?? source.payload.category) as RecordKind));
  // Deduplicate exact source IDs; when a correction arrives only the latest source version is used.
  const latest = new Map<string, SourceRecord>();
  for (const source of eligible) if ((latest.get(source.id)?.version ?? 0) < source.version) latest.set(source.id, source);
  const results = [...latest.values()].map((source) => normalizeSource(source));
  return { records: results.flatMap((item) => item.record ? [item.record] : []).sort((a, b) => Date.parse(b.clinicalDate) - Date.parse(a.clinicalDate)), issues: results.flatMap((item) => item.issue ? [item.issue] : []), permission };
}

export function citationsFor(records: ClinicalRecord[]): Citation[] {
  return records.map((record) => ({ id: record.citationId, recordId: record.id, title: record.title, hospital: record.hospital, date: record.clinicalDate, quote: record.text }));
}

export function findingsFor(state: ClinicalState, records: ClinicalRecord[]): Finding[] {
  const findings: Finding[] = [];
  const medications = records.filter(record => record.kind === "medication" && record.title === "Metformin 500 mg");
  if (new Set(medications.map(record => record.hospitalId)).size > 1 && new Set(medications.map(record => record.text)).size > 1) findings.push({ id: "finding-medication-difference", category: "conflict", severity: "medium", title: "Metformin instructions differ", description: "The sources document different dosing instructions. This may reflect a documented change or a discrepancy; the treating doctor must verify. No dose change is recommended.", citationIds: medications.map(record => record.citationId), status: "review-required" });
  const glucose = records.filter(record => record.code === "1558-6").sort((a, b) => Date.parse(a.clinicalDate) - Date.parse(b.clinicalDate));
  if (new Set(glucose.map(record => record.hospitalId)).size > 1) findings.push({ id: "finding-glucose-change", category: "change", severity: "info", title: "Fasting glucose results differ across dates", description: `Recorded results: ${glucose.map(record => `${record.value} ${record.unit} (${record.clinicalDate.slice(0, 10)})`).join("; ")}. A numerical difference alone does not establish an error, diagnosis, or cause. Review test conditions and original reports.`, citationIds: glucose.map(record => record.citationId), status: "documented" });
  const allergies = records.filter((record) => record.kind === "allergy");
  if (allergies.some((record) => record.assertion === "present") && allergies.some((record) => record.assertion === "none-known")) findings.push({ id: "finding-allergy", category: "conflict", severity: "high", title: "Allergy records disagree", description: "Hospital A documents a penicillin allergy; Hospital B records no known allergies. Neither entry supersedes the other automatically. Clinician reconciliation required.", citationIds: allergies.map((record) => record.citationId), status: "review-required" });
  for (const note of records.filter((record) => record.kind === "note")) {
    const raw = state.sources.find((source) => source.id === note.sourceId && source.version === note.version);
    if (raw?.payload.missingAttachment) findings.push({ id: `finding-missing-${note.id}`, category: "missing", severity: "medium", title: `${String(raw.payload.missingAttachment)} not retrieved`, description: "The outpatient note refers to this attachment, but it is absent from the retrieved record set. This does not establish that the examination was never performed.", citationIds: [note.citationId], status: "review-required" });
  }
  const creatinine = records.filter((record) => record.code === "2160-0").sort((a, b) => Date.parse(a.clinicalDate) - Date.parse(b.clinicalDate));
  if (creatinine.length >= 2) {
    const first = creatinine[0], last = creatinine[creatinine.length - 1];
    if (first.unit === last.unit) findings.push({ id: "finding-creatinine-change", category: "change", severity: "info", title: "Comparable creatinine results available", description: `Documented value changed from ${first.value} to ${last.value} ${last.unit}. Same mapped analyte and unit; review original laboratory method and reference ranges before clinical interpretation. No cause is inferred.`, citationIds: [first.citationId, last.citationId], status: "documented" });
  }
  for (const hospital of HOSPITALS) if (state.connectorStatus[hospital.id] === "unavailable") findings.push({ id: `finding-unavailable-${hospital.id}`, category: "coverage", severity: "medium", title: `${hospital.name} is unavailable`, description: "Its records are excluded from this view. This is an incomplete retrieved history; retry the connector before relying on coverage.", citationIds: [], status: "review-required" });
  if (!canReadForeign(state).allowed) findings.push({ id: "finding-consent", category: "coverage", severity: "medium", title: "Hospital A records excluded", description: canReadForeign(state).reason, citationIds: [], status: "review-required" });
  return findings;
}

export function sourceVersion(state: ClinicalState): string {
  const { records } = retrieve(state);
  return createHash("sha256").update(JSON.stringify({ patient: state.patientId, consent: state.consent.version, categories: state.consent.categories, expires: state.consent.expiresAt, records: records.map((record) => ({ id: record.id, version: record.version, text: record.text, date: record.clinicalDate, fhir: record.fhir })), links: state.linkedPatientId, connections: state.connectorStatus })).digest("hex").slice(0, 20);
}

export function makeSummary(state: ClinicalState, records: ClinicalRecord[], findings: Finding[]): ClinicalSummary {
  const patient = PATIENTS.find((item) => item.id === state.patientId)!;
  const sections = [
    { title: "Allergy documentation", items: records.filter((r) => r.kind === "allergy").map((r) => ({ text: `${r.hospital} (${r.clinicalDate.slice(0, 10)}): ${r.text}`, citationIds: [r.citationId] })) },
    { title: "Documented medication", items: records.filter((r) => r.kind === "medication").map((r) => ({ text: r.text, citationIds: [r.citationId] })) },
    { title: "Recent investigations", items: records.filter((r) => r.kind === "lab").map((r) => ({ text: `${r.title}: ${r.value} ${r.unit} (${r.hospital}; ${r.clinicalDate.slice(0, 10)}).`, citationIds: [r.citationId] })) },
    { title: "Unresolved evidence", items: findings.filter((f) => f.category !== "change").map((f) => ({ text: f.description, citationIds: f.citationIds })) },
  ].filter((section) => section.items.length > 0);
  const sources = [...new Set(records.map((record) => record.hospital))];
  const coverage = `Includes ${records.length} mapped records from ${sources.join(" and ") || "no available source"}. Unmapped records and unavailable or unauthorized sources are excluded. This is not a complete lifetime history.`;
  const text = `${patient.name} · cross-hospital review\n\n${coverage}\n\n${sections.map((section) => `${section.title}\n${section.items.map((item) => `• ${item.text} ${item.citationIds.map((id) => `[${id}]`).join(" ")}`).join("\n")}`).join("\n\n")}`;
  const fingerprint = sourceVersion(state);
  const approved = state.approvedFingerprint === fingerprint;
  return { id: `summary-${state.patientId}-${fingerprint}`, status: approved ? "approved" : "draft", generatedAt: now(), title: `${patient.name} · clinical summary`, sections, coverage, recordCount: records.length, disclaimer: "Deterministic evidence-based demonstration. No live LLM, vector RAG, diagnosis, or treatment recommendation. Clinician review required.", notes: state.summaryNotes, sourceVersion: fingerprint, text: approved && state.approvedText ? state.approvedText : text };
}

export function buildWorkspace(state: ClinicalState): Workspace {
  const { records, issues, permission } = retrieve(state);
  const patient = PATIENTS.find((item) => item.id === state.patientId)!;
  const findings = findingsFor(state, records);
  const summary = makeSummary(state, records, findings);
  const age = Math.floor((Date.now() - Date.parse(patient.birthDate)) / 31557600000);
  const candidates = state.patientId === "ravi" ? PATIENT_CANDIDATES.map((candidate) => ({ ...candidate, status: state.rejectedMatches.includes(candidate.id) ? "not-a-match" as const : candidate.id === state.linkedPatientId ? "confirmed" as const : "review-required" as const })) : [];
  const bundle = buildFhirBundle(state, records, summary);
  return { mode: "synthetic-demo", provider: "local-evidence", role: state.role, patient: { ...patient, age }, candidates, consent: state.consent, access: permission, hospitals: HOSPITALS.map((hospital) => ({ ...hospital, status: state.connectorStatus[hospital.id], lastChecked: now(), recordCount: records.filter((record) => record.hospitalId === hospital.id).length })), records, citations: citationsFor(records), findings, summary, timeline: records, mappings: TERMINOLOGY_MAPPINGS, mappingIssues: issues, validation: validateBundle(bundle), audit: state.audit, graph: { nodes: [{ id: patient.id, label: patient.name, type: "patient" }, ...HOSPITALS.filter((h) => records.some((record) => record.hospitalId === h.id)).map((h) => ({ id: h.id, label: h.name, type: "hospital" })), ...records.map((r) => ({ id: r.id, label: r.title, type: r.kind }))], edges: records.flatMap((r) => [{ source: patient.id, target: r.id, label: "documented" }, { source: r.id, target: r.hospitalId, label: "source" }]) }, metrics: { records: records.length, hospitals: new Set(records.map((r) => r.hospitalId)).size, conflicts: findings.filter((f) => f.category === "conflict").length, mapped: records.length }, revision: state.revision };
}

export function answerQuestion(state: ClinicalState, question: string): ChatAnswer {
  const { records } = retrieve(state);
  const q = question.toLowerCase().trim();
  if (!q) throw new ClinicalError(400, "QUESTION_REQUIRED", "Please enter a question about the selected patient's records.");
  const patient = PATIENTS.find((item) => item.id === state.patientId)!;
  const another = PATIENTS.find((item) => item.id !== state.patientId && q.includes(item.name.split(" ")[0].toLowerCase()));
  if (another) throw new ClinicalError(409, "PATIENT_CONTEXT_MISMATCH", `This conversation is scoped to ${patient.name}. Select the other patient first.`);
  let relevant: ClinicalRecord[] = [], answer = "";
  if (/kidney|renal|creatinine|trend/.test(q) || (/change/.test(q) && !/medicine|medication|metformin|drug|allerg/.test(q))) {
    relevant = records.filter((r) => r.code === "2160-0").sort((a, b) => Date.parse(a.clinicalDate) - Date.parse(b.clinicalDate));
    answer = relevant.length ? `${relevant.map((r) => `${r.hospital} recorded creatinine ${r.value} ${r.unit} on ${r.clinicalDate.slice(0, 10)} [${r.citationId}].`).join("\n\n")}\n\n${relevant.length > 1 ? "These mapped results use the same unit. Review method and laboratory reference ranges before interpreting the change. The records do not establish its cause." : "Only one permitted result is available; a trend cannot be established."}` : "No permitted, mapped creatinine result is available. Missing data does not mean the test was never performed.";
  } else if (/allerg|penicillin/.test(q)) {
    relevant = records.filter((r) => r.kind === "allergy");
    answer = relevant.length ? `${relevant.map((r) => `${r.hospital}: ${r.text} [${r.citationId}]`).join("\n\n")}\n\n${relevant.length > 1 ? "These statements conflict. Neither is silently chosen as correct. Clinician verification is required." : "This is the available source statement; unavailable records must not be interpreted as a negative allergy history."}` : "No authorized allergy evidence is available. I cannot say the patient has no allergies.";
  } else if (/medicine|medication|metformin|drug/.test(q)) {
    relevant = records.filter((r) => r.kind === "medication");
    answer = relevant.length ? relevant.map((r) => `${r.hospital} documented ${r.text} on ${r.clinicalDate.slice(0, 10)} [${r.citationId}].`).join("\n\n") + "\n\nThe retrieved records do not establish a later medication change or the reason for one." : "No permitted medication statement was retrieved. This does not mean the patient takes no medicines.";
  } else if (/missing|ultrasound|attachment|conflict/.test(q)) {
    const findings = findingsFor(state, records).filter((f) => f.category === "missing" || f.category === "conflict");
    const ids = new Set(findings.flatMap((f) => f.citationIds));
    relevant = records.filter((r) => ids.has(r.citationId));
    answer = findings.length ? findings.map((f) => `${f.title}: ${f.description} ${f.citationIds.map((id) => `[${id}]`).join(" ")}`).join("\n\n") : "No conflict or referenced missing attachment was detected in the permitted record set. This is not a guarantee that all records are complete.";
  } else if (/summary|summar|history|overview|report/.test(q)) {
    relevant = records;
    answer = makeSummary(state, records, findingsFor(state, records)).text;
  } else {
    answer = "I do not have enough supported evidence to answer that question in this prototype. Ask about documented kidney results, allergies, medicines, missing reports, or the clinical summary. I do not provide diagnosis or treatment advice.";
  }
  if (!canReadForeign(state).allowed) answer += `\n\nCoverage notice: ${canReadForeign(state).reason}`;
  const unavailable = HOSPITALS.filter((h) => state.connectorStatus[h.id] === "unavailable");
  if (unavailable.length) answer += `\n\nUnavailable source: ${unavailable.map((h) => h.name).join(", ")}. Its records are not included.`;
  addAudit(state, "CHAT_QUERY", "allowed", `Evidence query executed against ${relevant.length} authorized source records. Clinical question text is not logged.`);
  return { id: randomUUID(), answer, citations: citationsFor(relevant), suggestions: ["Compare kidney results", "Explain the allergy conflict", "Which evidence is missing?"], mode: "local-evidence", warning: "Synthetic demo · deterministic answers grounded in retrieved records · clinician review required" };
}

export function updateConsent(state: ClinicalState, action: "grant" | "revoke", categories?: RecordKind[]) {
  state.consent.status = action === "grant" ? "active" : "revoked";
  if (categories) state.consent.categories = categories;
  if (action === "grant") state.consent.expiresAt = new Date(Date.now() + 86400_000).toISOString();
  state.consent.version += 1; state.consent.updatedAt = now(); state.approvedFingerprint = null; state.approvedText = ""; state.revision += 1;
  addAudit(state, action === "grant" ? "CONSENT_GRANTED" : "CONSENT_REVOKED", "recorded", `${action === "grant" ? "Granted" : "Blocked"} subsequent foreign record retrieval. Prior disclosures cannot be erased.`);
}

export function confirmMatch(state: ClinicalState, id: string, action: "confirm" | "reject") {
  const candidate = PATIENT_CANDIDATES.find((item) => item.id === id);
  if (!candidate || state.patientId !== "ravi") throw new ClinicalError(404, "MATCH_NOT_FOUND", "Patient candidate does not exist.");
  if (action === "confirm" && (candidate.birthDate !== PATIENTS[0].birthDate || candidate.matchScore < 90)) {
    addAudit(state, "IDENTITY_LINK_BLOCKED", "denied", "Identity mismatch: name alone cannot establish a cross-hospital link.");
    throw new ClinicalError(409, "IDENTITY_MISMATCH", "Date of birth and verified contact token differ. These records must remain separate; matching names are insufficient.");
  }
  if (action === "reject") { state.rejectedMatches.push(id); if (state.linkedPatientId === id) state.linkedPatientId = null; }
  else { state.linkedPatientId = id; state.rejectedMatches = state.rejectedMatches.filter((item) => item !== id); }
  state.revision += 1; state.approvedFingerprint = null;
  addAudit(state, action === "confirm" ? "IDENTITY_CONFIRMED" : "IDENTITY_REJECTED", "recorded", "Patient identity candidate reviewed by demonstration doctor.");
}

export function approveSummary(state: ClinicalState, text: string, version: string) {
  if (!canReadForeign(state).allowed) throw new ClinicalError(403, "CONSENT_REQUIRED", "Renew valid consent before approving a cross-hospital summary.");
  if (sourceVersion(state) !== version) throw new ClinicalError(409, "STALE_SUMMARY", "The source records, connectivity, or consent changed. Regenerate and review the latest summary.");
  if (!text.trim()) throw new ClinicalError(400, "EMPTY_SUMMARY", "An empty summary cannot be approved.");
  state.approvedFingerprint = version; state.approvedText = text.trim(); state.revision += 1;
  addAudit(state, "SUMMARY_APPROVED", "recorded", "Demonstration doctor approved this source version. Any subsequent source or permission change invalidates approval.");
}

export function buildFhirBundle(state: ClinicalState, records: ClinicalRecord[], summary: ClinicalSummary): FhirResource {
  const patient = PATIENTS.find((item) => item.id === state.patientId)!;
  const patientUrl = `https://prototype.example/fhir/Patient/patient-${state.patientId}`;
  const clinician = state.clinician ?? DEMO_DOCTOR;
  const clinicianUrl = `https://prototype.example/fhir/Practitioner/${clinician.id}`;
  const resources = records.map((record) => {
    const resource = structuredClone(record.fhir);
    if (resource.resourceType === "AllergyIntolerance") resource.patient = { reference: patientUrl };
    else resource.subject = { reference: patientUrl };
    return { fullUrl: `https://prototype.example/fhir/${resource.resourceType}/${record.id}`, resource };
  });
  const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const composition = { resourceType: "Composition", id: `composition-${state.patientId}`, status: summary.status === "approved" ? "final" : "preliminary", type: { coding: [{ system: "http://loinc.org", code: "34133-9", display: "Summary of episode note" }] }, subject: { reference: patientUrl }, date: summary.generatedAt, author: [{ reference: clinicianUrl }], title: summary.title, confidentiality: "R", text: { status: "generated", div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>SYNTHETIC DEMONSTRATION ONLY</p><pre>${escape(summary.text)}</pre></div>` }, section: [{ title: "Source records", entry: resources.map((entry) => ({ reference: entry.fullUrl })) }] };
  return { resourceType: "Bundle", id: `bundle-${state.patientId}-${summary.sourceVersion}`, identifier: { system: "https://prototype.example/synthetic-documents", value: summary.id }, type: "document", timestamp: summary.generatedAt, entry: [ { fullUrl: `https://prototype.example/fhir/Composition/composition-${state.patientId}`, resource: composition }, { fullUrl: patientUrl, resource: { resourceType: "Patient", id: `patient-${state.patientId}`, identifier: patient.identifiers.map((identifier) => ({ system: identifier.hospital === "Rohit Hospital" ? "https://hospital-a.example/patients" : "https://hospital-b.example/patients", value: identifier.value })), name: [{ text: patient.name }], gender: patient.sex.toLowerCase(), birthDate: patient.birthDate } }, { fullUrl: clinicianUrl, resource: { resourceType: "Practitioner", id: clinician.id, name: [{ text: clinician.name }] } }, ...resources ] };
}

export function validateBundle(bundle: unknown): ValidationResult {
  const b = bundle as Record<string, unknown> | null;
  const entries = Array.isArray(b?.entry) ? b.entry as { fullUrl?: string; resource?: Record<string, unknown> }[] : [];
  const composition = entries[0]?.resource;
  const urls = entries.map((entry) => entry.fullUrl).filter(Boolean);
  const references: string[] = [];
  const walk = (value: unknown) => { if (!value || typeof value !== "object") return; if (Array.isArray(value)) return value.forEach(walk); for (const [key, item] of Object.entries(value)) if (key === "reference" && typeof item === "string") references.push(item); else walk(item); };
  walk(entries);
  const checks = [
    { label: "FHIR Bundle with document type", passed: b?.resourceType === "Bundle" && b.type === "document" },
    { label: "Bundle identifier and timestamp present", passed: Boolean(b?.identifier && b?.timestamp) },
    { label: "Composition is the first resource", passed: composition?.resourceType === "Composition" },
    { label: "Composition required fields present", passed: Boolean(composition?.status && composition?.type && composition?.date && composition?.title && composition?.author && composition?.subject) },
    { label: "Document contains patient and author", passed: entries.some((entry) => entry.resource?.resourceType === "Patient") && entries.some((entry) => entry.resource?.resourceType === "Practitioner") },
    { label: "Every entry has a unique fullUrl", passed: entries.length > 0 && urls.length === entries.length && new Set(urls).size === urls.length },
    { label: "All document references resolve internally", passed: references.length > 0 && references.every((reference) => urls.includes(reference)) },
    { label: "Observation quantities have code and units", passed: entries.filter((entry) => entry.resource?.resourceType === "Observation").every((entry) => { const r = entry.resource!; const q = r.valueQuantity as Record<string, unknown> | undefined; return Boolean(r.status && r.code && r.subject && r.effectiveDateTime && q && typeof q.value === "number" && q.system === "http://unitsofmeasure.org" && q.code); }) },
  ];
  return { valid: checks.every((check) => check.passed), errors: checks.filter((check) => !check.passed).map((check) => check.label), checks, level: "local-structural-checks", notice: "Local structural checks only. Full HL7 FHIR R4 and version-pinned ABDM profile validation require an external HL7 validator before real exchange. This prototype does not claim ABDM conformance." };
}

export function exportSummary(state: ClinicalState, format: "fhir" | "html" | "markdown") {
  if (!canReadForeign(state).allowed) throw new ClinicalError(403, "CONSENT_REQUIRED", "Cross-hospital export is blocked because consent is no longer valid.");
  if (state.approvedFingerprint !== sourceVersion(state)) throw new ClinicalError(409, "APPROVAL_REQUIRED", "Review and approve the current summary before exporting. Old approval cannot be reused after records or permissions change.");
  const { records } = retrieve(state);
  const summary = makeSummary(state, records, findingsFor(state, records));
  const bundle = buildFhirBundle(state, records, summary);
  const validation = validateBundle(bundle);
  if (!validation.valid) throw new ClinicalError(422, "LOCAL_FHIR_VALIDATION_FAILED", validation.errors.join("; "));
  addAudit(state, "SUMMARY_EXPORTED", "allowed", `Authorized ${format} export generated for current approved source version. Synthetic demonstration only.`);
  if (format === "fhir") return bundle;
  const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(summary.title)}</title><style>body{max-width:850px;margin:48px auto;padding:24px;font:16px/1.65 system-ui;color:#111}h1{border-bottom:4px solid #ff5b3e;padding-bottom:18px}pre{white-space:pre-wrap;font:inherit}footer{border-top:1px solid #ddd;margin-top:32px;padding-top:16px;font-size:13px}</style><h1>${escape(summary.title)}</h1><p>Synthetic demonstration · Clinician approved</p><pre>${escape(summary.text)}</pre><footer>Approved by ${escape((state.clinician ?? DEMO_DOCTOR).name)}. Source version: ${escape(summary.sourceVersion)}.<p>${escape(validation.notice)}</p></footer></html>`;

}
