export type HospitalId = "A" | "B";
export type Role = "doctor" | "payer";
export type RecordKind = "lab" | "allergy" | "medication" | "note";
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json | undefined };
export type FhirResource = { resourceType: string; id?: string; [key: string]: unknown };

export interface SourceRecord {
  id: string;
  hospitalId: HospitalId;
  patientLocalId: string;
  version: number;
  payload: Record<string, unknown>;
}

export interface ClinicalRecord {
  id: string;
  sourceId: string;
  version: number;
  hospitalId: HospitalId;
  hospital: string;
  patientLocalId: string;
  kind: RecordKind;
  title: string;
  text: string;
  clinicalDate: string;
  retrievedAt: string;
  code?: string;
  codeSystem?: string;
  value?: number;
  unit?: string;
  status?: string;
  assertion?: "present" | "none-known";
  fhir: FhirResource;
  citationId: string;
}

export interface Citation {
  id: string;
  recordId: string;
  title: string;
  hospital: string;
  date: string;
  quote: string;
}

export interface Finding {
  id: string;
  category: "conflict" | "missing" | "change" | "coverage";
  severity: "high" | "medium" | "info";
  title: string;
  description: string;
  citationIds: string[];
  status: "review-required" | "documented";
}

export interface Consent {
  id: string;
  status: "active" | "revoked";
  recipient: "Hospital B";
  purpose: "treatment";
  categories: RecordKind[];
  sourceHospitals: HospitalId[];
  expiresAt: string;
  updatedAt: string;
  version: number;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  outcome: "allowed" | "denied" | "recorded";
  detail: string;
}

export interface SummarySection {
  title: string;
  items: { text: string; citationIds: string[] }[];
}

export interface ClinicalSummary {
  id: string;
  status: "draft" | "approved";
  generatedAt: string;
  title: string;
  sections: SummarySection[];
  coverage: string;
  recordCount: number;
  disclaimer: string;
  notes: string;
  sourceVersion: string;
  text: string;
}

export interface ChatAnswer {
  id: string;
  answer: string;
  citations: Citation[];
  suggestions: string[];
  mode: "local-evidence" | "bedrock" | "bedrock-kb";
  warning: string;
}

export interface MappingIssue {
  id: string;
  hospitalId: HospitalId;
  sourceId: string;
  field: string;
  suppliedValue: string;
  message: string;
  severity: "error";
}

export interface PatientCandidate {
  id: string;
  hospitalId: HospitalId;
  localId: string;
  name: string;
  birthDate: string;
  phoneLast4: string;
  matchScore: number;
  status: "confirmed" | "review-required" | "not-a-match";
  reasons: string[];
}

export interface ClinicalState {
  clinician?: { id: string; name: string };
  deliveries?: HospitalDelivery[];
  patientId: string;
  role: Role;
  consent: Consent;
  linkedPatientId: string | null;
  connectorStatus: Record<HospitalId, "connected" | "unavailable">;
  sources: SourceRecord[];
  approvedFingerprint: string | null;
  summaryNotes: string;
  approvedText: string;
  rejectedMatches: string[];
  audit: AuditEvent[];
  revision: number;
}

export interface PatientOverview {
  id: string; name: string; initials: string; age: number; sex: string;
  identifier: string; reason: string; lastActivity: string;
}

export interface Bootstrap {
  mode: "synthetic-demo";
  actor: { id: string; name: string; role: "doctor"; hospitalId: "B"; hospital: string };
  patients: PatientOverview[];
  hospitals: { id: HospitalId; name: string; format: string }[];
  services: { name: string; status: "local" | "not-configured"; detail: string }[];
  session: { syntheticOnly: true; authentication: "opaque-demo-cookie" | "supabase-http-only"; productionReady: false };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  checks: { label: string; passed: boolean }[];
  level: "local-structural-checks";
  notice: string;
}

export interface Workspace {
  deliveries?: HospitalDelivery[];
  mode: "synthetic-demo";
  provider: "local-evidence";
  role: Role;
  patient: { id: string; name: string; initials: string; birthDate: string; age: number; sex: string; identifiers: { hospital: string; value: string }[] };
  candidates: PatientCandidate[];
  consent: Consent;
  access: { allowed: boolean; reason: string };
  hospitals: { id: HospitalId; name: string; status: "connected" | "unavailable"; lastChecked: string; format: string; recordCount: number }[];
  records: ClinicalRecord[];
  citations: Citation[];
  findings: Finding[];
  summary: ClinicalSummary | null;
  timeline: ClinicalRecord[];
  mappings: { source: string; canonical: string; code: string; system: string }[];
  mappingIssues: MappingIssue[];
  validation: ValidationResult | null;
  audit: AuditEvent[];
  graph: { nodes: { id: string; label: string; type: string }[]; edges: { source: string; target: string; label: string }[] };
  metrics: { records: number; hospitals: number; conflicts: number; mapped: number };
  revision: number;
}

export interface HospitalDelivery {
  hospitalId: HospitalId;
  requestId: string;
  receivedAt: string;
  recordCount: number;
  source: "api";
  revision: string;
}
