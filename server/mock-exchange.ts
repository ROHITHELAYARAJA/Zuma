import { Hono, type Context } from "hono";
import { createHash, randomUUID } from "node:crypto";
import type { StateSession, StoredSession } from "./state-store";
import type { AuthIdentity } from "./auth";
import { addAudit, canReadForeign, ClinicalError, normalizeSource, sourceVersion } from "./clinical/engine";
import { readHospitalDatabase } from "./hospital-database";
import type { RecordKind } from "../shared/types";

type Session = StateSession & { identity: AuthIdentity };
type Exchange = { consentId: string; actorId: string; policyVersion: number; expiresAt: string; categories: RecordKind[]; sourceVersion: string; transferId?: string; receivedAt?: string; digest?: string; entries?: number };
type Data = StoredSession & { mockExchange?: Exchange };

export function createMockExchangeRouter(hooks: { getSession: (c: Context) => Promise<Session>; persist: (session: Session) => Promise<void> }) {
  const router = new Hono();
  const scope = async (c: Context) => {
    const session = await hooks.getSession(c), state = session.data.states.ravi;
    if (session.identity.actor.role !== "doctor" || session.identity.actor.hospitalId !== "B") throw new ClinicalError(403, "ROLE_DENIED", "Only the Hospital B clinician can request this exchange.");
    if (!canReadForeign(state).allowed) throw new ClinicalError(403, "CONSENT_REQUIRED", "Confirm Ravi’s identity and grant demo permission before requesting Hospital A records.");
    return { session, state, data: session.data as Data };
  };
  router.post("/v1/consent-init", async c => {
    const { session, state, data } = await scope(c);
    data.mockExchange = { consentId: randomUUID(), actorId: session.identity.actor.id, policyVersion: state.consent.version, expiresAt: state.consent.expiresAt, categories: [...state.consent.categories], sourceVersion: sourceVersion(state) };
    addAudit(state, "MOCK_GATEWAY_CONSENT_ARTEFACT", "recorded", "Co-hosted mock gateway issued a treatment-scoped artefact for HIP A → HIU B. No national ABDM consent is claimed.");
    await hooks.persist(session);
    return c.json({ mockOnly: true, consentId: data.mockExchange.consentId, hip: "Hospital A", hiu: "Hospital B", expiresAt: data.mockExchange.expiresAt }, 201);
  });
  router.post("/v1/health-information/fetch-records", async c => {
    const initial = await scope(c), input = await c.req.json().catch(() => null);
    const artefact = initial.data.mockExchange;
    if (!artefact || input?.consentId !== artefact.consentId || artefact.actorId !== initial.session.identity.actor.id || artefact.policyVersion !== initial.state.consent.version || Date.parse(artefact.expiresAt) <= Date.now()) throw new ClinicalError(403, "MOCK_CONSENT_INVALID", "The mock consent artefact is missing, stale or belongs to another clinician.");
    if (sourceVersion(initial.state) !== artefact.sourceVersion) throw new ClinicalError(409, "SOURCE_CHANGED", "Records changed. Request a fresh mock consent artefact.");
    const [previous, current] = await Promise.all([readHospitalDatabase("A", artefact.categories), readHospitalDatabase("B")]);
    const fhir = { resourceType: "Bundle", type: "collection", entry: [...previous, ...current].flatMap(source => { const { record } = normalizeSource(source); return record ? [{ resource: record.fhir }] : []; }) };
    const fresh = await scope(c);
    if (sourceVersion(fresh.state) !== artefact.sourceVersion || fresh.data.mockExchange?.consentId !== artefact.consentId) throw new ClinicalError(409, "ACCESS_CHANGED", "Identity, records or permission changed during the exchange. Nothing was released.");
    const transferId = randomUUID(), receivedAt = new Date().toISOString(), digest = createHash("sha256").update(JSON.stringify(fhir)).digest("hex");
    fresh.state.sources = [...previous, ...current];
    fresh.state.connectorStatus = { A: "connected", B: "connected" };
    fresh.state.approvedFingerprint = null; fresh.state.approvedText = ""; fresh.state.revision++;
    for (const hospitalId of ["A", "B"] as const) {
      const records = hospitalId === "A" ? previous : current;
      fresh.state.deliveries = [...(fresh.state.deliveries ?? []).filter(receipt => receipt.hospitalId !== hospitalId), { hospitalId, requestId: transferId, receivedAt, recordCount: records.length, source: "api", revision: digest }];
    }
    fresh.data.mockExchange = { ...artefact, transferId, receivedAt, digest, entries: fhir.entry.length };
    addAudit(fresh.state, "MOCK_HIP_RECORDS_RELEASED", "allowed", `Hospital A database supplied ${previous.length} scoped records to the mock gateway.`);
    addAudit(fresh.state, "MOCK_HIU_FHIR_RECEIVED", "allowed", `Hospital B HIU received ${fhir.entry.length} FHIR resources. Transfer ${transferId}; SHA-256 ${digest}. Both roles and the gateway are co-hosted prototype modules.`);
    await hooks.persist(fresh.session);
    return c.json({ mockOnly: true, transferId, consentId: artefact.consentId, receivedAt, digest, fhirResources: fhir.entry.length, sourceRecords: { A: previous.length, B: current.length }, protocol: "ABDM-style consent → HIP release → HIU receipt; co-hosted mock modules, not the official NHA gateway runtime" });
  });
  router.get("/v1/health-information/status/:id", async c => {
    const { data, state, session } = await scope(c), receipt = data.mockExchange;
    if (receipt && (receipt.policyVersion !== state.consent.version || receipt.actorId !== session.identity.actor.id)) throw new ClinicalError(403, "MOCK_CONSENT_INVALID", "The transfer permission has changed.");
    if (!receipt?.transferId || receipt.transferId !== c.req.param("id")) throw new ClinicalError(404, "TRANSFER_NOT_FOUND", "This transfer is not available in your session.");
    return c.json({ mockOnly: true, status: "RECEIVED", ...receipt });
  });
  return router;
}
