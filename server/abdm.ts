import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import { isDeepStrictEqual } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { StateSession, StoredSession } from "./state-store";
import { authProvider, supabaseAdmin, type AuthIdentity } from "./auth";
import { ClinicalError } from "./clinical/engine";
import dataset from "../data/abdm/dataset.json";

type Session = StateSession & { identity: AuthIdentity };
type IdentityReview = { decision: "pending" | "confirmed" | "rejected"; name: string; birthDate: string; patientId: string; reportId: string; sourceHash: string; actorId: string; actor: string; at: string };
type Review = { identity?: IdentityReview; consent: { active: boolean; expiresAt: string; version: number; doctorId: string; recipient: "B"; purpose: "treatment" }; approved?: { text: string; sourceVersion: string; doctor: string }; audit: { id: string; action: string; at: string; actor: string }[] };
type AbdmData = StoredSession & { abdm?: Record<string, Review> };
type Answer = { answer: string; citations: { id: string; recordId: string; title: string; hospital: string; date: string; quote: string; sourceUrl: string }[]; sourceVersion: string; mode: string; warning: string; audioBase64?: string; audioContentType?: string; transcript?: string };
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function createAbdmRouter(hooks: { getSession: (c: Context) => Promise<Session>; persist: (s: Session) => Promise<void> }) {
  const router = new Hono();
  const load = async (c: Context) => {
    const session = await hooks.getSession(c);
    if (session.identity.actor.role !== "doctor" || session.identity.actor.hospitalId !== "B") throw new ClinicalError(403, "ROLE_DENIED", "A verified Hospital B clinician is required.");
    let report = dataset.reports.find(r => r.reportId === c.req.param("id"));
    if (!report) throw new ClinicalError(404, "REPORT_NOT_FOUND", "Repository report does not exist.");
    const raw = readFileSync(new URL(`../data/abdm/${report.file}`, import.meta.url));
    if (createHash("sha256").update(raw).digest("hex") !== report.sha256) throw new ClinicalError(409, "SOURCE_CHANGED", "Repository source changed; refresh the dataset before using it.");
    if (authProvider() === "supabase") {
      const { data: stored, error } = await supabaseAdmin().from("abdm_repository_reports").select("source_patient_id,patient_name,sha256,fhir_bundle").eq("report_id", report.reportId).single();
      if (error || !stored) throw new ClinicalError(503, "FHIR_SOURCE_UNAVAILABLE", "The patient FHIR report could not be read from Supabase.");
      if (stored.source_patient_id !== report.patientId || stored.sha256 !== report.sha256 || stored.patient_name !== report.name || !isDeepStrictEqual(stored.fhir_bundle, report.bundle)) throw new ClinicalError(409, "FHIR_SOURCE_CHANGED", "The database record differs from the pinned evidence version. Synchronize the source and knowledge base before continuing.");
      report = { ...report, bundle: stored.fhir_bundle };
    }
    const retrievedAt = new Date().toISOString();
    const data = session.data as AbdmData;
    data.abdm ??= {};
    data.abdm[report.reportId] ??= { consent: { active: false, expiresAt: new Date(0).toISOString(), version: 0, doctorId: session.identity.actor.id, recipient: "B", purpose: "treatment" }, audit: [] };
    const state = data.abdm[report.reportId];
    state.identity ??= { decision: "pending", name: report.name, birthDate: report.birthDate, patientId: report.patientId, reportId: report.reportId, sourceHash: report.sha256, actorId: "", actor: "Not reviewed", at: new Date().toISOString() };
    const fingerprint = () => createHash("sha256").update(JSON.stringify({ hash: report.sha256, consent: state.consent, identity: state.identity, actor: session.identity.actor.id })).digest("hex").slice(0, 24);
    const identityRejected = state.identity?.sourceHash === report.sha256 && state.identity.decision === "rejected";
    const allowed = !identityRejected && state.consent.active && state.consent.doctorId === session.identity.actor.id && Date.parse(state.consent.expiresAt) > Date.now();
    return { session, report, state, sourceVersion: fingerprint(), allowed, retrievedAt };
  };
  const requireAccess = (scope: Awaited<ReturnType<typeof load>>) => { if (!scope.allowed) throw new ClinicalError(403, "CONSENT_REQUIRED", "Check the patient identity and report-specific permission before reading this report."); };
  const audit = (scope: Awaited<ReturnType<typeof load>>, action: string) => { scope.state.audit.unshift({ id: randomUUID(), action, at: new Date().toISOString(), actor: scope.session.identity.actor.name }); scope.state.audit = scope.state.audit.slice(0, 100); };
  const qualityFindings = (report: typeof dataset.reports[number]) => {
    const codes = new Map<string, Set<string>>();
    for (const entry of report.bundle.entry) {
      const resource = entry.resource as unknown as { code?: { coding?: { system?: string; code?: string; display?: string }[]; text?: string } };
      for (const item of resource.code?.coding ?? []) {
        const key = (item.system ?? "") + "|" + (item.code ?? "");
        const labels = codes.get(key) ?? new Set<string>();
        if (item.display) labels.add(item.display); codes.set(key, labels);
      }
    }
    return [...codes.entries()].filter(([, labels]) => labels.size > 1).map(([code, labels]) => ({ title: "Conflicting terminology in source", detail: code + " is used with different labels: " + [...labels].join(", ") + ". Human mapping review required; source preserved." }));
  };
  const view = (scope: Awaited<ReturnType<typeof load>>) => ({ identityReview: scope.state.identity?.sourceHash === scope.report.sha256 ? scope.state.identity : null, identityStorage: authProvider() === "supabase" ? "supabase" : "demo", providers: scope.allowed ? scope.report.bundle.entry.flatMap(entry => {
    const resource = entry.resource as Record<string, unknown>;
    if (!["Practitioner", "Organization"].includes(String(resource.resourceType))) return [];
    const names = resource.name as string | { text?: string; given?: string[]; family?: string }[] | undefined;
    const name = typeof names === "string" ? names : names?.map(n => n.text || [...(n.given ?? []), n.family].filter(Boolean).join(" ")).join("; ");
    return [{ id: String(resource.id), kind: resource.resourceType === "Practitioner" ? "HCP" : "HCO", name: name || "Name not recorded", registryStatus: "Repository sample; official registry verification pending" }];
  }) : [], reportId: scope.report.reportId, patientId: scope.report.patientId, name: scope.report.name, clinicalSource: authProvider() === "supabase" ? "Supabase FHIR record" : "Repository sample", retrievedAt: scope.retrievedAt, birthDate: scope.report.birthDate, hospitalId: scope.report.hospitalId, clinicalDate: scope.report.clinicalDate, sourceUrl: scope.report.source, sha256: scope.report.sha256, sourceVersion: scope.sourceVersion, keyResults: scope.allowed ? scope.report.bundle.entry.flatMap(entry => {
    const resource = entry.resource as Record<string, unknown>;
    const quantity = resource.valueQuantity as { value?: number; unit?: string; code?: string } | undefined;
    if (resource.resourceType !== "Observation" || !quantity || typeof quantity.value !== "number" || !Number.isFinite(quantity.value)) return [];
    const code = resource.code as { text?: string; coding?: { display?: string }[] } | undefined;
    return [{ id: String(resource.id), label: code?.text ?? code?.coding?.[0]?.display ?? "Unnamed measurement", value: quantity.value, unit: quantity.unit ?? quantity.code ?? "unit not recorded", date: typeof resource.effectiveDateTime === "string" ? resource.effectiveDateTime : null }];
  }) : [], consent: scope.state.consent, allowed: scope.allowed, approval: scope.allowed && scope.state.approved?.sourceVersion === scope.sourceVersion ? scope.state.approved : null, audit: scope.state.audit, bundle: scope.allowed ? scope.report.bundle : null, findings: [...qualityFindings(scope.report), { title: "Repository terminology requires review", detail: "Source coding has not been independently validated. Original values are preserved; no silent correction is performed." }, { title: "Separate patient identities", detail: "The two repository bundles describe different patients. They must not be merged or compared as visits for one patient." }, ...(String(scope.report.birthDate).length < 10 ? [{ title: "Incomplete birth date", detail: "Only the year is documented. Exact date and age are not inferred." }] : [])], notice: "Repository demonstration only. Permission grant is simulated for this hackathon. Source facts require clinician review; full HL7/ABDM validation remains required." });
  router.get("/dataset", async c => {
    await hooks.getSession(c);
    const query = (c.req.query("q") ?? "").trim().toLocaleLowerCase();
    if (query.length > 100) throw new ClinicalError(400, "INVALID_SEARCH", "Use at most 100 characters for patient search.");
    let reports = dataset.reports.map(({ bundle, ...r }) => r);
    if (authProvider() === "supabase") {
      const { data, error } = await supabaseAdmin().from("abdm_repository_reports").select("report_id,source_patient_id,patient_name,hospital_id,sha256").limit(100);
      if (error) throw new ClinicalError(503, "PATIENT_DIRECTORY_UNAVAILABLE", "The hospital patient directory is unavailable.");
      reports = reports.filter(r => data.some(row => row.report_id === r.reportId && row.source_patient_id === r.patientId && row.hospital_id === r.hospitalId && row.sha256 === r.sha256 && row.patient_name === r.name));
    }
    reports = reports.filter(r => !query || [r.name, r.patientId, r.reportId].some(value => value.toLocaleLowerCase().includes(query)));
    return c.json({ reports, notice: dataset.notice, directory: authProvider() === "supabase" ? "supabase" : "repository", search: "Patient identity search uses verified directory fields. Clinical questions use permission-scoped AWS knowledge retrieval." });
  });
  router.get("/reports/:id/workspace", async c => { const scope = await load(c); await hooks.persist(scope.session); return c.json(view(scope)); });
  router.post("/reports/:id/identity/review", async c => {
    const scope = await load(c);
    const input = z.object({ decision: z.enum(["confirmed", "rejected"]), sourceVersion: z.string() }).safeParse(await c.req.json().catch(() => null));
    if (!input.success) throw new ClinicalError(400, "INVALID_IDENTITY_REVIEW", "Choose confirm or reject for the selected source identity.");
    if (input.data.sourceVersion !== scope.sourceVersion) throw new ClinicalError(409, "SOURCE_CHANGED", "Refresh the patient record before reviewing identity.");
    scope.state.identity = { decision: input.data.decision, name: scope.report.name, birthDate: scope.report.birthDate, patientId: scope.report.patientId, reportId: scope.report.reportId, sourceHash: scope.report.sha256, actorId: scope.session.identity.actor.id, actor: scope.session.identity.actor.name, at: new Date().toISOString() };
    delete scope.state.approved;
    audit(scope, input.data.decision === "confirmed" ? "SOURCE_PATIENT_IDENTITY_CONFIRMED" : "SOURCE_PATIENT_IDENTITY_REJECTED");
    await hooks.persist(scope.session);
    return c.json(view(await load(c)));
  });
  router.post("/reports/:id/consent/:action", async c => {
    const scope = await load(c); const action = c.req.param("action");
    if (!["grant", "revoke"].includes(action)) throw new ClinicalError(400, "INVALID_ACTION", "Choose grant or revoke.");
    scope.state.consent = { active: action === "grant", expiresAt: new Date(Date.now() + 3600000).toISOString(), version: scope.state.consent.version + 1, doctorId: scope.session.identity.actor.id, recipient: "B", purpose: "treatment" };
    delete scope.state.approved; audit(scope, action === "grant" ? "DEMO_REPORT_PERMISSION_GRANTED" : "REPORT_PERMISSION_REVOKED"); await hooks.persist(scope.session);
    return c.json(view(await load(c)));
  });
  const callAi = async (c: Context, voice: boolean) => {
    const scope = await load(c); requireAccess(scope);
    const schema = voice ? z.object({ audioBase64: z.string().min(1).max(1280000), sampleRate: z.literal(16000) }) : z.object({ question: z.string().trim().min(1).max(4000), history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).max(6).default([]) });
    const parsed = schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new ClinicalError(400, "INVALID_REQUEST", "Supply a question or 16 kHz PCM recording up to 30 seconds.");
    const key = process.env.RAG_SERVICE_API_KEY;
    if (!key || key.length < 32) throw new ClinicalError(503, "RAG_SERVICE_NOT_CONFIGURED", "Configure the private Python evidence service and its shared service key.");
    if (!process.env.RAG_SERVICE_URL) throw new ClinicalError(503, "RAG_SERVICE_NOT_CONFIGURED", "The evidence service is unavailable. No local answer was substituted.");
    const target = new URL(process.env.RAG_SERVICE_URL);
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) throw new ClinicalError(503, "INVALID_RAG_SERVICE_URL", "Invalid Python service origin.");
    const response = await fetch(new URL(voice ? "/voice" : "/answer", target), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ ...parsed.data, reportId: scope.report.reportId, patientId: scope.report.patientId, sourceVersion: scope.sourceVersion }), signal: AbortSignal.timeout(voice ? 115000 : 95000) });
    const result = await response.json() as Answer & { detail?: string };
    if (!response.ok) throw new ClinicalError(503, "EVIDENCE_SERVICE_FAILED", result.detail || "The AWS evidence request failed. No answer was released.");
    const fresh = await load(c); requireAccess(fresh);
    if (fresh.sourceVersion !== scope.sourceVersion || result.sourceVersion !== scope.sourceVersion) throw new ClinicalError(409, "ACCESS_CHANGED", "Records or permission changed during generation. No answer was released.");
    if (typeof result.answer !== "string" || !Array.isArray(result.citations) || result.citations.some(citation => !citation.id.startsWith(scope.report.reportId + ":") || citation.sourceUrl !== scope.report.source)) throw new ClinicalError(503, "UNVERIFIED_CITATIONS", "The evidence service returned unsupported citations.");
    audit(fresh, voice ? "NOVA_VOICE_EVIDENCE_RETURNED" : "BEDROCK_TEXT_EVIDENCE_RETURNED"); await hooks.persist(fresh.session); return c.json(result);
  };
  router.post("/reports/:id/chat", c => callAi(c, false));
  router.post("/reports/:id/chat/stream", async c => {
    const initial = await load(c); requireAccess(initial);
    const response = await callAi(c, false);
    const result = await response.json() as Answer;
    c.header("X-Accel-Buffering", "no");
    return streamSSE(c, async stream => {
      await stream.writeSSE({ event: "answer.start", data: JSON.stringify({ verified: true }) });
      for (const paragraph of result.answer.split("\n\n")) {
        if (stream.aborted) return;
        const fresh = await load(c);
        if (!fresh.allowed || fresh.sourceVersion !== initial.sourceVersion) {
          await stream.writeSSE({ event: "answer.error", data: JSON.stringify({ message: "Access changed. The answer was stopped." }) });
          return;
        }
        const words = (paragraph + "\n\n").match(/\S+\s*/g) ?? [];
        for (let i = 0; i < words.length; i += 5) {
          if (stream.aborted) return;
          await stream.writeSSE({ event: "answer.delta", data: JSON.stringify({ text: words.slice(i, i + 5).join("") }) });
          await stream.sleep(22);
        }
      }
      const fresh = await load(c);
      if (!fresh.allowed || fresh.sourceVersion !== initial.sourceVersion) {
        await stream.writeSSE({ event: "answer.error", data: JSON.stringify({ message: "Access changed. Refresh before continuing." }) });
        return;
      }
      await stream.writeSSE({ event: "answer.complete", data: JSON.stringify(result) });
    });
  });
  router.post("/reports/:id/voice", c => callAi(c, true));
  router.post("/reports/:id/approve", async c => {
    const scope = await load(c); requireAccess(scope); const input = z.object({ text: z.string().trim().min(1).max(24000), sourceVersion: z.string() }).safeParse(await c.req.json().catch(() => null));
    if (!input.success) throw new ClinicalError(400, "INVALID_APPROVAL", "Supply reviewed text and source version.");
    if (input.data.sourceVersion !== scope.sourceVersion) throw new ClinicalError(409, "SOURCE_CHANGED", "Refresh before approving.");
    scope.state.approved = { text: input.data.text, sourceVersion: scope.sourceVersion, doctor: scope.session.identity.actor.name }; audit(scope, "SUMMARY_APPROVED"); await hooks.persist(scope.session); return c.json(view(scope));
  });
  router.get("/reports/:id/export", async c => {
    const scope = await load(c); requireAccess(scope); const approval = scope.state.approved;
    if (!approval || approval.sourceVersion !== scope.sourceVersion) throw new ClinicalError(409, "APPROVAL_REQUIRED", "Approve the current source version before release.");
    const format = c.req.query("format") || "html";
    if (!["html", "fhir"].includes(format)) throw new ClinicalError(400, "INVALID_FORMAT", "Choose html or fhir.");
    audit(scope, "APPROVED_REPORT_EXPORTED"); await hooks.persist(scope.session);
    c.header("Content-Disposition", `attachment; filename="${scope.report.reportId}.${format === "fhir" ? "json" : "html"}"`); c.header("Cache-Control", "no-store");
    if (format === "fhir") return c.json({ resourceType: "Bundle", type: "collection", entry: [{ resource: scope.report.bundle }, { resource: { resourceType: "DocumentReference", status: "current", description: "Clinician approved narrative; source FHIR unchanged and not externally validated", content: [{ attachment: { contentType: "text/plain", data: Buffer.from(approval.text).toString("base64") } }] } }] });
    return c.html(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Reviewed repository report</title><body><h1>${escape(scope.report.name)}</h1><p>Repository demonstration. Approved by ${escape(approval.doctor)} for Hospital B treatment use.</p><pre style="white-space:pre-wrap">${escape(approval.text)}</pre><p>Source: ${escape(scope.report.source)}</p><p>SHA256: ${scope.report.sha256}</p><p>Original FHIR terminology requires review. Not externally validated.</p></body></html>`);
  });
  return router;
}
