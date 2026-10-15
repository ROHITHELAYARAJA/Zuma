import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";
import { answerQuestion, buildWorkspace, confirmMatch, createState, normalizeSource, validateBundle } from "./clinical/engine";
import type { Workspace } from "../shared/types";

const cleanups: (() => void)[] = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

async function setup(dbPath = ":memory:") {
  const server = createApp({ dbPath });
  cleanups.push(server.close);
  const initial = await server.app.request("http://localhost/api/demo/session", { method: "POST" });
  const cookie = initial.headers.get("set-cookie")!.split(";")[0];
  const request = (path: string, method = "GET", value?: unknown, extra: Record<string, string> = {}) => server.app.request(`http://localhost${path}`, { method, headers: { Cookie: cookie, ...(value === undefined ? {} : { "Content-Type": "application/json" }), ...extra }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
  return { server, cookie, initial, request };
}

describe("synthetic clinical API", () => {
  it("requires an opaque server session; session cookie is HttpOnly and responses are not cached", async () => {
    const { server, initial } = await setup();
    const denied = await server.app.request("http://localhost/api/patients/ravi/workspace");
    expect(denied.status).toBe(401);
    expect(initial.headers.get("set-cookie")).toContain("HttpOnly");
    expect(initial.headers.get("cache-control")).toBe("no-store");
  });

  it("maps supported two-hospital records and quarantines unknown terminology", async () => {
    const { request } = await setup();
    const response = await request("/api/patients/ravi/workspace");
    const workspace = await response.json() as Workspace;
    expect(response.status).toBe(200);
    expect(workspace.records).toHaveLength(7);
    expect(workspace.metrics.hospitals).toBe(2);
    expect(workspace.mappingIssues[0].suppliedValue).toBe("LOCAL-X17");
    expect(workspace.records.some((r) => r.sourceId.includes("unmapped"))).toBe(false);
    expect(workspace.findings.some((f) => f.category === "conflict")).toBe(true);
    expect(workspace.validation?.valid).toBe(true);
    expect(workspace.validation?.level).toBe("local-structural-checks");
  });

  it("answers kidney questions using only cited retrieved results", async () => {
    const { request } = await setup();
    const response = await request("/api/patients/ravi/chat", "POST", { message: "Compare Ravi's kidney results" });
    const result = await response.json();
    expect(result.mode).toBe("local-evidence");
    expect(result.citations).toHaveLength(2);
    expect(result.answer).toContain("1.1 mg/dL");
    expect(result.answer).toContain("1.3 mg/dL");
    expect(result.answer).toContain("do not establish its cause");
  });

  it("revocation removes foreign records from workspace, chat, direct record reads, and exports", async () => {
    const { request } = await setup();
    const before = await (await request("/api/patients/ravi/workspace")).json() as Workspace;
    expect((await request("/api/patients/ravi/approve", "POST", { text: before.summary!.text, sourceVersion: before.summary!.sourceVersion })).status).toBe(200);
    const revoked = await (await request("/api/consents/consent-ravi/revoke", "POST", {})).json() as Workspace;
    expect(revoked.records.every((r) => r.hospitalId === "B")).toBe(true);
    expect(revoked.summary?.status).toBe("draft");
    expect(revoked.summary?.sections.some((s) => s.items.some((item) => item.text.includes("Metformin")))).toBe(false);
    expect((await request("/api/records/record-a-medication-01")).status).toBe(404);
    const chat = await (await request("/api/patients/ravi/chat", "POST", { message: "Show kidney results" })).json();
    expect(chat.citations).toHaveLength(1);
    expect(chat.citations[0].hospital).toBe("Meridian Medical");
    expect((await request("/api/patients/ravi/export?format=fhir")).status).toBe(403);
    expect((await request("/api/patients/ravi/approve", "POST", { text: before.summary!.text, sourceVersion: before.summary!.sourceVersion })).status).toBe(403);
  });

  it("enforces consent categories before foreign evidence retrieval", async () => {
    const { request } = await setup();
    const w = await (await request("/api/consents/consent-ravi/grant", "POST", { categories: ["lab"] })).json() as Workspace;
    expect(w.records.filter((r) => r.hospitalId === "A").every((r) => r.kind === "lab")).toBe(true);
    expect(w.records.some((r) => r.hospitalId === "B" && r.kind === "allergy")).toBe(true);
    expect(w.findings.some((f) => f.category === "conflict")).toBe(false);
  });

  it("blocks the payer role from treatment-only evidence, including voice/chat tool endpoints", async () => {
    const { request } = await setup();
    expect((await request("/api/demo/role", "POST", { role: "payer" })).status).toBe(200);
    expect((await request("/api/patients/ravi/workspace")).status).toBe(403);
    expect((await request("/api/patients/ravi/chat", "POST", { message: "Show the summary" })).status).toBe(403);
    expect((await request("/api/records/record-b-creatinine-02")).status).toBe(403);
    expect((await request("/api/demo/role", "POST", { role: "doctor" })).status).toBe(200);
  });

  it("refuses to combine two Ravis based only on matching names", async () => {
    const { request } = await setup();
    const response = await request("/api/matches/candidate-other-ravi/confirm", "POST", {});
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("IDENTITY_MISMATCH");
    expect((await request("/api/matches/candidate-other-ravi/reject", "POST", {})).status).toBe(200);
  });

  it("shows an incomplete history when a connector is offline and invalidates approvals", async () => {
    const { request } = await setup();
    const first = await (await request("/api/patients/ravi/workspace")).json() as Workspace;
    await request("/api/patients/ravi/approve", "POST", { text: first.summary!.text, sourceVersion: first.summary!.sourceVersion });
    const w = await (await request("/api/hospitals/A/status", "POST", { available: false })).json() as Workspace;
    expect(w.records.every((r) => r.hospitalId === "B")).toBe(true);
    expect(w.findings.some((f) => f.category === "coverage" && f.title.includes("Aster"))).toBe(true);
    expect((await request("/api/patients/ravi/export?format=fhir")).status).toBe(409);
    expect((await request("/api/patients/ravi/approve", "POST", { text: first.summary!.text, sourceVersion: first.summary!.sourceVersion })).status).toBe(409);
  });

  it("requires approval then exports an internally linked FHIR document and readable report", async () => {
    const { request } = await setup();
    expect((await request("/api/patients/ravi/export?format=fhir")).status).toBe(409);
    const w = await (await request("/api/patients/ravi/workspace")).json() as Workspace;
    const approval = await request("/api/patients/ravi/approve", "POST", { text: w.summary!.text, sourceVersion: w.summary!.sourceVersion });
    expect(approval.status).toBe(200);
    const fhir = await request("/api/patients/ravi/export?format=fhir");
    const bundle = await fhir.json();
    expect(fhir.status).toBe(200);
    expect(bundle.entry[0].resource.resourceType).toBe("Composition");
    expect(bundle.entry[0].resource.status).toBe("final");
    expect(validateBundle(bundle).valid).toBe(true);
    const markdown = await request("/api/patients/ravi/export?format=markdown");
    expect(markdown.status).toBe(200);
    expect(await markdown.text()).toContain("SYNTHETIC DEMONSTRATION");
  });

  it("previews an authorized draft document without approval and excludes revoked sources", async () => {
    const { request } = await setup();
    const preview = await request("/api/patients/ravi/document-preview");
    const draft = await preview.json();
    expect(preview.status).toBe(200);
    expect(draft.validation.valid).toBe(true);
    expect(draft.bundle.entry[0].resource.status).toBe("preliminary");
    expect(draft.bundle.entry.some((entry: { resource: { id: string } }) => entry.resource.id === "record-a-creatinine-01")).toBe(true);
    await request("/api/consents/consent-ravi/revoke", "POST", {});
    const filtered = await (await request("/api/patients/ravi/document-preview")).json();
    expect(filtered.bundle.entry.some((entry: { resource: { id: string } }) => entry.resource.id?.startsWith("record-a-"))).toBe(false);
    expect(filtered.bundle.entry[0].resource.status).toBe("preliminary");
    await request("/api/demo/role", "POST", { role: "payer" });
    expect((await request("/api/patients/ravi/document-preview")).status).toBe(403);
  });

  it("rejects cross-patient questions and disallowed request origins", async () => {
    const { request } = await setup();
    expect((await request("/api/patients/ravi/chat", "POST", { message: "Tell me about Meera" })).status).toBe(409);
    expect((await request("/api/consents/consent-ravi/revoke", "POST", {}, { Origin: "https://untrusted.example" })).status).toBe(403);
  });

  it("does not release an in-flight cloud response after consent is revoked", async () => {
    const previous = process.env.AI_PROVIDER;
    let release!: (value: { answer: string; evidenceIds: string[] }) => void;
    let started!: () => void;
    const hasStarted = new Promise<void>((resolve) => { started = resolve; });
    const paused = new Promise<{ answer: string; evidenceIds: string[] }>((resolve) => { release = resolve; });
    vi.doMock("../integrations/bedrock", () => ({ generateGroundedAnswer: async () => { started(); return paused; } }));
    try {
      process.env.AI_PROVIDER = "bedrock";
      const { request } = await setup();
      const pending = request("/api/patients/ravi/chat", "POST", { message: "Compare kidney results" });
      await hasStarted;
      await request("/api/consents/consent-ravi/revoke", "POST", {});
      release({ answer: "Source fact [cite-a-creatinine-01]", evidenceIds: ["cite-a-creatinine-01"] });
      const response = await pending;
      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe("ACCESS_CHANGED");
      const workspace = await (await request("/api/patients/ravi/workspace")).json() as Workspace;
      expect(workspace.consent.status).toBe("revoked");
      expect(workspace.records.every((r) => r.hospitalId === "B")).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = previous;
      vi.doUnmock("../integrations/bedrock");
    }
  });

  it("persists consent changes across database reopen", async () => {
    const folder = mkdtempSync(join(tmpdir(), "synapse-api-"));
    const path = join(folder, "test.sqlite");
    const first = await setup(path);
    await first.request("/api/consents/consent-ravi/revoke", "POST", {});
    cleanups.pop()!();
    const reopened = createApp({ dbPath: path });
    cleanups.push(() => { reopened.close(); rmSync(folder, { recursive: true, force: true }); });
    const response = await reopened.app.request("http://localhost/api/patients/ravi/workspace", { headers: { Cookie: first.cookie } });
    expect((await response.json() as Workspace).consent.status).toBe("revoked");
  });
});

describe("clinical evidence safeguards", () => {
  it("excludes expired consent and rejects unsupported units instead of comparing them", () => {
    const state = createState("ravi");
    state.consent.expiresAt = "2020-01-01T00:00:00Z";
    expect(buildWorkspace(state).records.every((record) => record.hospitalId === "B")).toBe(true);
    const incompatible = normalizeSource({ id: "bad-unit", hospitalId: "A", patientLocalId: "A-102", version: 1, payload: { kind: "lab", test: "S.CREAT", result: 120, unit: "umol/L", sampled_at: "2026-10-14T00:00:00Z", report_status: "final" } });
    expect(incompatible.record).toBeUndefined();
    expect(incompatible.issue?.field).toBe("unit");
  });

  it("rejects malformed FHIR, preserves source contradictions, and declines unsupported clinical advice", () => {
    expect(validateBundle({ resourceType: "Bundle", type: "document", entry: [] }).valid).toBe(false);
    const state = createState("ravi");
    expect(answerQuestion(state, "Does Ravi have a penicillin allergy?").answer).toContain("statements conflict");
    expect(answerQuestion(state, "Should I start an antibiotic?").answer).toContain("do not provide diagnosis or treatment advice");
    expect(() => confirmMatch(state, "candidate-other-ravi", "confirm")).toThrow("must remain separate");
  });
});
