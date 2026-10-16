import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createApp } from "../server/app";
import type { Workspace } from "../shared/types";
import { evidenceObjects } from "../integrations/ingestion";

let instance: ReturnType<typeof createApp>;
let cookie: string;
beforeEach(async () => {
  vi.stubEnv("AUTH_PROVIDER", "demo"); vi.stubEnv("HOSPITAL_DATA_PROVIDER", "fixtures"); vi.stubEnv("RAG_PROVIDER", "local"); vi.stubEnv("RAG_SERVICE_URL", ""); vi.stubEnv("AWS_CLOUD_ENABLED", "false");
  instance = createApp({ dbPath: ":memory:" });
  const response = await instance.app.request("/api/demo/session", { method: "POST" });
  cookie = response.headers.get("set-cookie")!.split(";")[0];
});
afterEach(() => { instance.close(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
async function call(path: string, body?: unknown) {
  return instance.app.request(`/api${path}`, { method: body === undefined ? "GET" : "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function start() { return (await call("/comparison/session", {})).json() as Promise<Workspace>; }
async function allow() {
  await call("/matches/candidate-ravi-b/confirm", {});
  return (await call("/consents/consent-ravi/grant", {})).json() as Promise<Workspace>;
}
it("withholds Hospital A until identity and permission are both confirmed", async () => {
  const initial = await start(); expect(initial.access.allowed).toBe(false); expect(initial.records.every(record => record.hospitalId === "B")).toBe(true);
  const permissionOnly = await (await call("/consents/consent-ravi/grant", {})).json() as Workspace;
  expect(permissionOnly.access.allowed).toBe(false);
  expect((await call("/matches/candidate-other-ravi/confirm", {})).status).toBe(409);
  const approvedIdentity = await allow(); expect(approvedIdentity.metrics.hospitals).toBe(2);
  const reload = await start(); expect(reload.access.allowed).toBe(true);
});
it("compares the same fictional patient with dated evidence and distinguishes changes from conflicts", async () => {
  await start(); const workspace = await allow();
  expect(workspace.records.filter(record => record.code === "1558-6").map(record => record.value).sort()).toEqual([120, 145]);
  expect(workspace.findings.find(finding => finding.id === "finding-allergy")?.category).toBe("conflict");
  expect(workspace.findings.find(finding => finding.id === "finding-medication-difference")?.citationIds).toHaveLength(2);
  expect(workspace.findings.find(finding => finding.id === "finding-glucose-change")?.category).toBe("change");
  expect(workspace.mappingIssues.some(issue => issue.sourceId === "b-unmapped-03")).toBe(true);
  expect(workspace.validation?.valid).toBe(true);
  const metadata = JSON.parse(evidenceObjects("ravi", workspace.records[0], "managed").metadata).metadataAttributes;
  expect(metadata.synthetic.value).toEqual({ type: "STRING", stringValue: "true" });
  expect(Object.values(metadata).some((field: any) => field.value.type === "BOOLEAN")).toBe(false);
});
it("never substitutes a local answer for comparison RAG", async () => {
  await start();
  expect((await call("/patients/ravi/chat", { message: "Compare allergies", requireKnowledgeBase: true })).status).toBe(403);
  await allow();
  const response = await call("/patients/ravi/chat", { message: "Compare allergies", requireKnowledgeBase: true });
  expect(response.status).toBe(503); expect((await response.json()).error).toBe("KNOWLEDGE_BASE_REQUIRED");
});
it("revoking permission invalidates approval, exports and voice access", async () => {
  await start(); const workspace = await allow();
  expect((await call("/patients/ravi/approve", { text: workspace.summary!.text, sourceVersion: workspace.summary!.sourceVersion })).status).toBe(200);
  expect((await call("/patients/ravi/export?format=fhir")).status).toBe(200);
  await call("/consents/consent-ravi/revoke", {});
  expect((await call("/patients/ravi/export?format=fhir")).status).toBe(403);
  expect((await call("/comparison/voice", { audioBase64: "AAAA", sampleRate: 16000 })).status).toBe(403);
  expect((await call("/comparison/ingest", {})).status).toBe(403);
});
it("does not expose another session's ingestion job", async () => {
  await start(); await allow();
  expect((await call("/comparison/ingestion/ABCDEFGHIJ")).status).toBe(404);
});
