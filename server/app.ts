import { createAbdmRouter } from "./abdm";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Bootstrap, ClinicalState, HospitalId, RecordKind } from "../shared/types";
import { HOSPITALS, PATIENTS } from "./clinical/fixtures";
import { ClinicalError, DEMO_DOCTOR, addAudit, answerQuestion, approveSummary, buildFhirBundle, buildWorkspace, canReadForeign, citationsFor, confirmMatch, createState, exportSummary, findingsFor, makeSummary, retrieve, sourceVersion, updateConsent, validateBundle } from "./clinical/engine";
import { authProvider, signIn, signOut, supabaseConfigured, verifyIdentity, type AuthIdentity } from "./auth";
import { createStateStore, type StateSession, type StoredSession } from "./state-store";
import { platformRouter } from "./platform";
import { connectionConfiguration, fetchHospitalRecords, HospitalConnectorError, setHospitalAvailability } from "../integrations/hospitals";

type RequestSession = StateSession & { identity: AuthIdentity };
type JobSession = StoredSession & { ingestionJobs?: Record<string, { patientId: string; sourceVersion: string }> };
const COOKIE_NAME = "synapse_demo_session";
const patientIdSchema = z.enum(["ravi", "meera", "arjun"]);
const hospitalIdSchema = z.enum(["A", "B"]);
const kindSchema = z.enum(["lab", "allergy", "medication", "note"]);
const apiHospitals = () => process.env.HOSPITAL_DATA_PROVIDER === "api";
const allowedOrigins = () => (process.env.APP_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8787,http://127.0.0.1:8787").split(",").map((value) => value.trim().replace(/\/+$/, ""));

export function createApp(options: { dbPath?: string } = {}) {
  const store = createStateStore(options);
  const app = new Hono();
  const getState = (session: StoredSession, id: string) => {
    const parsed = patientIdSchema.safeParse(id);
    if (!parsed.success || !session.states[parsed.data]) throw new ClinicalError(404, "PATIENT_NOT_FOUND", "Patient does not exist in the synthetic workspace.");
    return session.states[parsed.data];
  };
  const getSession = async (c: Context): Promise<RequestSession> => {
    const identity = await verifyIdentity(c);
    const id = getCookie(c, COOKIE_NAME);
    if (!id || !/^[a-f0-9]{64}$/.test(id)) throw new ClinicalError(401, "SESSION_REQUIRED", "Initialize an authenticated clinical workspace first.");
    const stored = await store.load(id, identity.userId);
    if (!stored || stored.userId !== identity.userId) throw new ClinicalError(401, "SESSION_EXPIRED", "Your clinical workspace session has expired. Sign in again.");
    if (authProvider() === "supabase") for (const state of Object.values(stored.data.states)) { state.role = identity.actor.role; state.clinician = { id: identity.actor.id, name: identity.actor.name }; }
    return { ...stored, identity };
  };
  const persist = async (session: RequestSession) => {
    if (session.identity.userId) for (const state of Object.values(session.data.states)) for (const event of state.audit) if (event.actor === DEMO_DOCTOR.name) event.actor = session.identity.actor.name;
    await store.save(session);
  };
  const initialSession = async (c: Context, identity: AuthIdentity): Promise<RequestSession> => {
    const session: RequestSession = { id: randomBytes(32).toString("hex"), identity, userId: identity.userId, version: 1, expiresAt: Date.now() + 86400_000, data: { createdAt: new Date().toISOString(), states: Object.fromEntries(PATIENTS.map((patient) => [patient.id, createState(patient.id)])) } };
    for (const state of Object.values(session.data.states)) {
      state.clinician = { id: identity.actor.id, name: identity.actor.name };
      if (identity.userId) for (const event of state.audit) event.actor = identity.actor.name;
    }
    await store.create(session);
    setCookie(c, COOKIE_NAME, session.id, { httpOnly: true, sameSite: "Lax", path: "/api", maxAge: 86400, secure: process.env.NODE_ENV === "production" });
    return session;
  };
  const requireDemo = () => { if (authProvider() !== "demo") throw new ClinicalError(403, "DEMO_DISABLED", "Demonstration identity and state controls are disabled in Supabase authentication mode."); };
  const requireDoctor = (state: ClinicalState) => { if (state.role !== "doctor") throw new ClinicalError(403, "ROLE_DENIED", "Only the authorized treating clinician can perform this action."); };
  const body = async <T>(c: Context, schema: z.ZodType<T>): Promise<T> => {
    let value: unknown;
    try { value = await c.req.json(); } catch { throw new ClinicalError(400, "INVALID_JSON", "Request body must be valid JSON."); }
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new ClinicalError(400, "INVALID_REQUEST", parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
    return parsed.data;
  };
  const optionalBody = async <T>(c: Context, schema: z.ZodType<T>): Promise<T> => {
    const text = await c.req.text();
    let value: unknown;
    try { value = text ? JSON.parse(text) : {}; } catch { throw new ClinicalError(400, "INVALID_JSON", "Request body must be valid JSON."); }
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new ClinicalError(400, "INVALID_REQUEST", "The supplied request options are invalid.");
    return parsed.data;
  };
  const currentWorkspace = (state: ClinicalState) => ({ ...buildWorkspace(state), deliveries: state.deliveries ?? [] });
  const bootstrap = (identity: AuthIdentity): Bootstrap => ({
    mode: "synthetic-demo", actor: identity.actor,
    patients: PATIENTS.map((p) => ({ id: p.id, name: p.name, initials: p.initials, age: Math.floor((Date.now() - Date.parse(p.birthDate)) / 31557600000), sex: p.sex, identifier: p.identifier, reason: p.reason, lastActivity: p.lastActivity })),
    hospitals: HOSPITALS,
    services: [
      { name: "Clinical state", status: "local", detail: store.provider === "supabase" ? "Supabase persistence with verified clinician ownership and optimistic version checks." : "Persistent local SQLite; opaque demonstration session." },
      { name: "Hospital adapters", status: "local", detail: apiHospitals() ? "Independent authenticated Hospital A/B HTTP APIs. Explicit synchronization records delivery receipts." : "Offline fixture mode. No network exchange is claimed." },
      { name: "FHIR mapping", status: "local", detail: "Explicit terminology mappings and structural checks; full external profile validation remains required." },
      { name: "Evidence assistant", status: "local", detail: process.env.RAG_PROVIDER === "bedrock-kb" ? "Configured Bedrock Knowledge Bases retrieval, live source allowlist, and cited Bedrock answers." : process.env.AI_PROVIDER === "bedrock" ? "Configured Bedrock answer generation from currently permitted structured evidence." : "Deterministic local evidence answers. No model or vector retrieval is claimed." },
      { name: "Supabase", status: authProvider() === "supabase" ? "local" : "not-configured", detail: authProvider() === "supabase" ? "Server-side getUser verification and authoritative active clinician membership on every protected request." : "Not selected; email authentication is disabled." },
      { name: "Speech", status: "local", detail: "Browser speech recognition and synthesis where supported." },
    ], session: { syntheticOnly: true, authentication: authProvider() === "supabase" ? "supabase-http-only" : "opaque-demo-cookie", productionReady: false },
  });
  const freshUnchanged = async (c: Context, patientId: string, version: string) => {
    const fresh = await getSession(c), state = getState(fresh.data, patientId);
    requireDoctor(state);
    if (sourceVersion(state) !== version) throw new ClinicalError(409, "ACCESS_CHANGED", "Records or permissions changed while the request was in progress. No stale result was released.");
    return { session: fresh, state };
  };
  app.use("/api/*", cors({ origin: (origin) => allowedOrigins().includes(origin) ? origin : "", credentials: true, allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type"] }));
  app.use("/api/*", async (c, next) => {
    c.header("Cache-Control", "no-store"); c.header("X-Content-Type-Options", "nosniff");
    if (["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method)) {
      const origin = c.req.header("Origin");
      if (origin && !allowedOrigins().includes(origin)) throw new ClinicalError(403, "ORIGIN_DENIED", "Request origin is not permitted.");
      if (Number(c.req.header("Content-Length") ?? "0") > 1024 * 1024) throw new ClinicalError(413, "BODY_TOO_LARGE", "Request body exceeds 1 MB.");
    }
    await next();
  });
  app.route("/api/platform", platformRouter);
  app.route("/api/abdm", createAbdmRouter({ getSession, persist }));
  app.get("/", c => c.json({ service: "zuma-clinical-api", health: "/api/health", website: "https://zumaai.vercel.app" }));
  app.get("/api/health", (c) => c.json({ ok: true, mode: "synthetic-demo", storage: store.provider, authProvider: authProvider(), cloudConnected: false, fhirValidation: "local-structural-checks" }));
  app.get("/api/auth/config", (c) => c.json({ provider: authProvider(), supabaseConfigured: supabaseConfigured(), syntheticOnly: true }));
  app.post("/api/auth/login", async (c) => {
    const input = await body(c, z.object({ email: z.email().max(254), password: z.string().min(1).max(1024) }));
    const identity = await signIn(c, input.email, input.password);
    await initialSession(c, identity);
    return c.json(bootstrap(identity));
  });
  app.post("/api/auth/logout", async (c) => {
    let session: RequestSession | undefined;
    try { session = await getSession(c); } catch {}
    if (session) await store.remove(session.id, session.userId);
    await signOut(c);
    deleteCookie(c, COOKIE_NAME, { path: "/api" });
    return c.json({ signedOut: true });
  });
  app.post("/api/demo/session", async (c) => {
    requireDemo();
    try { const existing = await getSession(c); return c.json(bootstrap(existing.identity)); }
    catch (error) { if (!(error instanceof ClinicalError) || error.status !== 401) throw error; }
    const session = await initialSession(c, await verifyIdentity(c));
    return c.json(bootstrap(session.identity), 201);
  });
  app.post("/api/demo/reset", async (c) => {
    requireDemo(); const session = await getSession(c);
    session.data.states = Object.fromEntries(PATIENTS.map((p) => [p.id, createState(p.id)]));
    (session.data as JobSession).ingestionJobs = {};
    await persist(session); return c.json(bootstrap(session.identity));
  });
  app.post("/api/demo/role", async (c) => {
    requireDemo();
    const input = await body(c, z.object({ role: z.enum(["doctor", "payer"]), patientId: patientIdSchema.optional() }));
    const session = await getSession(c);
    for (const state of Object.values(session.data.states)) { state.role = input.role; state.approvedFingerprint = null; addAudit(state, "DEMO_ROLE_CHANGED", "recorded", `Synthetic role changed to ${input.role}.`); }
    await persist(session);
    return input.role === "payer" ? c.json({ role: "payer", access: { allowed: false, reason: "Treatment-only consent does not authorize a payer." }, mode: "synthetic-demo" }) : c.json(currentWorkspace(getState(session.data, input.patientId ?? "ravi")));
  });
  app.get("/api/bootstrap", async (c) => { const session = await getSession(c); return c.json(bootstrap(session.identity)); });
  app.get("/api/pipeline/status", async (c) => {
    const session = await getSession(c);
    return c.json({ authProvider: authProvider(), stateStore: store.provider, recordProvider: apiHospitals() ? "api" : "fixtures", hospitals: connectionConfiguration(), ragProvider: process.env.RAG_PROVIDER ?? "local", aiProvider: process.env.AI_PROVIDER ?? "local", awsEnabled: process.env.AWS_CLOUD_ENABLED === "true", knowledgeBaseConfigured: Boolean(process.env.BEDROCK_KNOWLEDGE_BASE_ID && process.env.BEDROCK_DATA_SOURCE_ID), actor: session.identity.actor, notice: "Configuration is distinct from a completed transmission. Delivery receipts show actual successful hospital API exchanges." });
  });
  app.get("/api/patients/:id/workspace", async (c) => {
    const session = await getSession(c), state = getState(session.data, c.req.param("id"));
    addAudit(state, "WORKSPACE_VIEWED", "allowed", "Rendered currently authorized source records.");
    const workspace = currentWorkspace(state); await persist(session); return c.json(workspace);
  });
  app.post("/api/patients/:id/summary", async (c) => {
    const session = await getSession(c), state = getState(session.data, c.req.param("id"));
    requireDoctor(state); addAudit(state, "SUMMARY_GENERATED", "allowed", "Structured summary assembled from all currently authorized mapped records; missing evidence and contradictions retained.");
    const workspace = currentWorkspace(state); await persist(session); return c.json(workspace);
  });
  app.get("/api/patients/:id/document-preview", async (c) => {
    const session = await getSession(c), state = getState(session.data, c.req.param("id"));
    const { records } = retrieve(state), summary = makeSummary(state, records, findingsFor(state, records));
    const bundle = buildFhirBundle(state, records, { ...summary, status: "draft" });
    addAudit(state, "FHIR_DRAFT_PREVIEWED", "allowed", "Inspected an authorized synthetic draft; not an approved clinical release.");
    await persist(session); return c.json({ bundle, validation: validateBundle(bundle), notice: "Synthetic draft preview. Clinician approval and current consent are required for export." });
  });
  app.post("/api/patients/:id/sync", async (c) => {
    if (!apiHospitals()) throw new ClinicalError(409, "HOSPITAL_APIS_NOT_SELECTED", "Select HOSPITAL_DATA_PROVIDER=api to synchronize independent hospital services.");
    const input = await optionalBody(c, z.object({ hospitals: z.array(hospitalIdSchema).min(1).max(2).optional(), hospitalIds: z.array(hospitalIdSchema).min(1).max(2).optional() }));
    let session = await getSession(c), state = getState(session.data, c.req.param("id"));
    requireDoctor(state);
    const requested = [...new Set(input.hospitals ?? input.hospitalIds ?? (canReadForeign(state).allowed ? ["A", "B"] : ["B"]))] as HospitalId[];
    if (requested.includes("A") && !canReadForeign(state).allowed) throw new ClinicalError(403, "CONSENT_REQUIRED", "Hospital A transmission is blocked by the current identity or consent policy.");
    for (const hospitalId of requested) {
      const version = sourceVersion(state), requestId = randomUUID();
      try {
        const result = await fetchHospitalRecords(hospitalId, state.patientId, requestId, hospitalId === "A" ? { categories: state.consent.categories } : {});
        const fresh = await freshUnchanged(c, state.patientId, version);
        session = fresh.session; state = fresh.state;
        if (hospitalId === "A" && !canReadForeign(state).allowed) throw new ClinicalError(403, "CONSENT_REQUIRED", "Hospital A access changed before transmission could be committed.");
        state.sources = [...state.sources.filter((source) => source.hospitalId !== hospitalId), ...result.records];
        state.connectorStatus[hospitalId] = "connected"; state.approvedFingerprint = null; state.approvedText = ""; state.revision += 1;
        state.deliveries = [...(state.deliveries ?? []).filter((delivery) => delivery.hospitalId !== hospitalId), result.delivery];
        addAudit(state, "HOSPITAL_API_DELIVERY", "allowed", `${hospitalId} delivered ${result.delivery.recordCount} identity-verified source records. Request ${requestId}; revision ${result.delivery.revision}.`);
        await persist(session);
      } catch (error) {
        if (error instanceof ClinicalError) throw error;
        const fresh = await freshUnchanged(c, state.patientId, version);
        session = fresh.session; state = fresh.state; state.connectorStatus[hospitalId] = "unavailable"; state.approvedFingerprint = null; state.revision += 1;
        addAudit(state, "HOSPITAL_API_FAILED", "denied", `${hospitalId} did not release verified records. Request ${requestId}.`);
        await persist(session);
        throw new ClinicalError(502, error instanceof HospitalConnectorError ? error.code : "HOSPITAL_API_FAILED", `Hospital ${hospitalId} could not complete an authenticated, identity-verified transmission. No substitute delivery was fabricated.`);
      }
    }
    return c.json(currentWorkspace(state));
  });
  app.post("/api/patients/:id/chat", async (c) => {
    const input = await body(c, z.object({ message: z.string().trim().min(1).max(4000) }));
    let session = await getSession(c), state = getState(session.data, c.req.param("id"));
    let answer = answerQuestion(state, input.message);
    if (process.env.AI_PROVIDER === "bedrock" || process.env.RAG_PROVIDER === "bedrock-kb") {
      const version = sourceVersion(state), { records } = retrieve(state);
      try {
        let evidence = records.map((record) => ({ id: record.citationId, text: `${record.hospital}; ${record.clinicalDate}; ${record.text}` }));
        if (process.env.RAG_PROVIDER === "bedrock-kb") {
          const { retrieveKnowledgeEvidence } = await import("../integrations/knowledge-base");
          const retrieved = await retrieveKnowledgeEvidence({ question: input.message, patientId: state.patientId, records });
          evidence = retrieved.evidence;
          await freshUnchanged(c, state.patientId, version);
        }
        const { generateGroundedAnswer } = await import("../integrations/bedrock");
        const result = await generateGroundedAnswer({ question: input.message, patientId: state.patientId, evidence });
        const fresh = await freshUnchanged(c, state.patientId, version);
        session = fresh.session; state = fresh.state;
        const ids = new Set(result.evidenceIds), allowed = new Set(evidence.map((item) => item.id));
        if (result.evidenceIds.some((id) => !allowed.has(id))) throw new Error("UNKNOWN_CITATION");
        answer = { ...answer, mode: process.env.RAG_PROVIDER === "bedrock-kb" ? "bedrock-kb" : "bedrock", answer: result.answer, citations: citationsFor(records).filter((citation) => ids.has(citation.id)), warning: "Configured Bedrock response with permission-scoped evidence. Clinician verification remains required." };
        addAudit(state, "BEDROCK_QUERY", "allowed", "Current permissions and source-reference membership checked before releasing the configured cloud answer.");
      } catch (error) {
        if (error instanceof ClinicalError) throw error;
        throw new ClinicalError(502, "BEDROCK_UNAVAILABLE", "Configured retrieval or generation could not be verified. No local substitute was presented as a cloud answer.");
      }
    }
    await persist(session); return c.json(answer);
  });
  app.post("/api/patients/:id/ingest", async (c) => {
    const session = await getSession(c), state = getState(session.data, c.req.param("id"));
    requireDoctor(state);
    const version = sourceVersion(state), { records } = retrieve(state);
    try {
      const { syncPatientEvidence, startEvidenceIngestion } = await import("../integrations/ingestion");
      const uploaded = await syncPatientEvidence({ patientId: state.patientId, records });
      await freshUnchanged(c, state.patientId, version);
      const job = await startEvidenceIngestion();
      const fresh = await freshUnchanged(c, state.patientId, version), data = fresh.session.data as JobSession;
      data.ingestionJobs = { ...(data.ingestionJobs ?? {}), [job.jobId]: { patientId: state.patientId, sourceVersion: version } };
      addAudit(fresh.state, "EVIDENCE_INGESTION_STARTED", "allowed", `Authorized canonical evidence uploaded; ingestion job ${job.jobId} started. Retrieval readiness is not assumed.`);
      await persist(fresh.session);
      return c.json({ ...job, records: uploaded.documents, documents: uploaded.documents, metadataFiles: uploaded.metadataFiles, ready: false });
    } catch (error) { if (error instanceof ClinicalError) throw error; throw new ClinicalError(502, "INGESTION_UNAVAILABLE", "Authorized evidence ingestion could not complete. Verify AWS, S3, knowledge-base, and data-source configuration."); }
  });
  app.get("/api/patients/:id/ingestion", async (c) => {
    const session = await getSession(c), state = getState(session.data, c.req.param("id"));
    requireDoctor(state);
    const jobId = c.req.query("jobId") ?? "", entry = (session.data as JobSession).ingestionJobs?.[jobId];
    if (!entry || entry.patientId !== state.patientId) throw new ClinicalError(404, "INGESTION_JOB_NOT_FOUND", "No authorized ingestion job matches this patient and session.");
    if (entry.sourceVersion !== sourceVersion(state)) throw new ClinicalError(409, "ACCESS_CHANGED", "Permissions or source evidence changed after this ingestion started.");
    try {
      const { getEvidenceIngestionStatus } = await import("../integrations/ingestion");
      const result = await getEvidenceIngestionStatus(jobId);
      await freshUnchanged(c, state.patientId, entry.sourceVersion);
      return c.json(result);
    } catch (error) { if (error instanceof ClinicalError) throw error; throw new ClinicalError(502, "INGESTION_STATUS_UNAVAILABLE", "The authorized ingestion status could not be verified."); }
  });
  for (const action of ["revoke", "grant"] as const) app.post(`/api/consents/:id/${action}`, async (c) => {
    const input = await optionalBody(c, z.object({ categories: z.array(kindSchema).min(1).optional() }));
    const session = await getSession(c), state = getState(session.data, c.req.param("id").replace(/^consent-/, ""));
    requireDoctor(state); updateConsent(state, action, input.categories as RecordKind[] | undefined);
    await persist(session); return c.json(currentWorkspace(state));
  });
  for (const action of ["confirm", "reject"] as const) app.post(`/api/matches/:id/${action}`, async (c) => {
    const session = await getSession(c), state = getState(session.data, "ravi"); requireDoctor(state);
    try { confirmMatch(state, c.req.param("id"), action); } finally { await persist(session); }
    return c.json(currentWorkspace(state));
  });
  app.post("/api/hospitals/:id/status", async (c) => {
    const parsed = hospitalIdSchema.safeParse(c.req.param("id"));
    if (!parsed.success) throw new ClinicalError(404, "HOSPITAL_NOT_FOUND", "Unknown hospital.");
    const input = await body(c, z.object({ available: z.boolean(), patientId: patientIdSchema.optional() }));
    let session = await getSession(c); requireDoctor(getState(session.data, input.patientId ?? "ravi"));
    if (apiHospitals()) {
      requireDemo();
      try { await setHospitalAvailability(parsed.data, input.available); } catch { throw new ClinicalError(502, "HOSPITAL_STATUS_FAILED", "The independent demonstration hospital did not accept the availability change."); }
      session = await getSession(c);
    }
    for (const state of Object.values(session.data.states)) { state.connectorStatus[parsed.data] = input.available ? "connected" : "unavailable"; state.revision += 1; state.approvedFingerprint = null; addAudit(state, "CONNECTOR_STATUS_CHANGED", "recorded", `${parsed.data}: ${input.available ? "available" : "unavailable"}. ${apiHospitals() ? "Independent API service acknowledged this change." : "Offline simulation."}`); }
    await persist(session); return c.json(currentWorkspace(getState(session.data, input.patientId ?? "ravi")));
  });
  app.post("/api/patients/:id/approve", async (c) => {
    const input = await body(c, z.object({ text: z.string().min(1).max(50000), sourceVersion: z.string().min(1).max(100) }));
    const session = await getSession(c), state = getState(session.data, c.req.param("id")); requireDoctor(state);
    approveSummary(state, input.text, input.sourceVersion); await persist(session); return c.json(currentWorkspace(state));
  });
  app.get("/api/patients/:id/export", async (c) => {
    const parsed = z.enum(["fhir", "html", "markdown"]).safeParse(c.req.query("format") ?? "fhir");
    if (!parsed.success) throw new ClinicalError(400, "INVALID_FORMAT", "Export format must be fhir or html.");
    const session = await getSession(c), state = getState(session.data, c.req.param("id")); requireDoctor(state);
    try {
      const document = exportSummary(state, parsed.data); await persist(session);
      c.header("Content-Disposition", `attachment; filename="${state.patientId}-synthetic-summary.${parsed.data === "fhir" ? "json" : "html"}"`);
      return parsed.data === "fhir" ? c.json(document) : c.html(document as string);
    } catch (error) { addAudit(state, "EXPORT_BLOCKED", "denied", "An authorization, source-version, or document check blocked export."); await persist(session); throw error; }
  });
  app.get("/api/records/:id", async (c) => {
    const session = await getSession(c);
    for (const state of Object.values(session.data.states)) {
      const { records } = retrieve(state), record = records.find((item) => item.id === c.req.param("id"));
      if (record) { addAudit(state, "SOURCE_RECORD_VIEWED", "allowed", `Authorized source ${record.sourceId} version ${record.version}.`); await persist(session); return c.json({ record, source: state.sources.find((source) => source.id === record.sourceId && source.version === record.version), citation: citationsFor([record])[0], validation: { valid: true, level: "local-structural-checks", notice: "Explicit local mapping; full profile validation remains required." } }); }
    }
    throw new ClinicalError(404, "RECORD_UNAVAILABLE", "The requested record is unavailable or not authorized.");
  });
  app.get("/api/audit", async (c) => {
    const session = await getSession(c); requireDoctor(getState(session.data, "ravi"));
    return c.json({ events: Object.values(session.data.states).flatMap((state) => state.audit).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 150) });
  });
  app.post("/api/validate", async (c) => { const session = await getSession(c); requireDoctor(getState(session.data, "ravi")); const input = await body(c, z.object({ bundle: z.unknown() })); return c.json(validateBundle(input.bundle)); });
  app.notFound((c) => c.json({ error: "NOT_FOUND", message: "API endpoint not found." }, 404));
  app.onError(async (error, c) => {
    if (error instanceof ClinicalError) {
      if ([401, 403, 404, 409].includes(error.status)) {
        try { const session = await getSession(c), state = session.data.states[c.req.param("id") ?? "ravi"] ?? session.data.states.ravi; addAudit(state, "REQUEST_BLOCKED", "denied", `Policy or state check: ${error.code}.`); await persist(session); } catch {}
      }
      return c.json({ error: error.code, message: error.message }, error.status as 400);
    }
    return c.json({ error: "INTERNAL_ERROR", message: "The request could not be completed. No clinical result was released." }, 500);
  });
  return { app, close: () => store.close(), database: store.database };
}
