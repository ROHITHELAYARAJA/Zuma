import { afterEach, describe, expect, it, vi } from "vitest";
import { createHospitalApp } from "./app";
import { LOCAL_HOSPITAL_KEYS } from "./contracts";
import { connectionConfiguration, fetchHospitalRecords, setHospitalAvailability } from "../integrations/hospitals";

const opened: ReturnType<typeof createHospitalApp>[] = [];
function hospital(hospitalId: "A" | "B") {
  const result = createHospitalApp({ hospitalId, dbPath: ":memory:", host: "127.0.0.1", env: { NODE_ENV: "test" } });
  opened.push(result);
  return result.app;
}
const auth = (id: "A" | "B") => ({ Authorization: `Bearer ${LOCAL_HOSPITAL_KEYS[id]}` });
afterEach(() => { opened.splice(0).forEach(result => result.close()); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("independent synthetic hospital services", () => {
  it("keeps health public and clinical records authenticated", async () => {
    const app = hospital("A");
    const health = await (await app.request("/health")).json();
    expect(health.mode).toBe("synthetic-hospital-api");
    expect(health.records).toBeUndefined();
    expect(health.patient).toBeUndefined();
    expect((await app.request("/v1/patients/A-102/records")).status).toBe(401);
    const response = await app.request("/v1/patients/A-102/records", { headers: auth("A") });
    const envelope = await response.json();
    expect(response.status).toBe(200);
    expect(envelope.records).toHaveLength(4);
    expect(envelope.records[0].payload).toHaveProperty("kind");
    expect(envelope.patient).toEqual({ localId: "A-102", name: "Ravi Kumar", birthDate: "1990-04-18" });
  });

  it("filters categories inside the source hospital before transmission", async () => {
    const app = hospital("A");
    const envelope = await (await app.request("/v1/patients/A-102/records?categories=lab", { headers: auth("A") })).json();
    expect(envelope.records).toHaveLength(2);
    expect(envelope.records.every((record: { payload: { kind: string } }) => record.payload.kind === "lab")).toBe(true);
    expect((await app.request("/v1/patients/A-102/records?categories=", { headers: auth("A") })).status).toBe(400);
    expect((await app.request("/v1/patients/A-102/records?categories=secret", { headers: auth("A") })).status).toBe(400);
  });

  it("keeps the ambiguous Ravi isolated under B-811", async () => {
    const app = hospital("B");
    const main = await (await app.request("/v1/patients/B-507/records", { headers: auth("B") })).json();
    const other = await (await app.request("/v1/patients/B-811/records", { headers: auth("B") })).json();
    expect(main.records.every((record: { patientLocalId: string }) => record.patientLocalId === "B-507")).toBe(true);
    expect(other.records.every((record: { patientLocalId: string }) => record.patientLocalId === "B-811")).toBe(true);
    expect(other.patient.birthDate).not.toBe(main.patient.birthDate);
    expect((await app.request("/v1/patients/ravi/records", { headers: auth("B") })).status).toBe(404);
    expect((await app.request("/v1/patients", { headers: auth("B") })).status).toBe(404);
  });

  it("protects outage simulation and returns 503 while unavailable", async () => {
    const app = hospital("A");
    expect((await app.request("/v1/demo/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ available: false }) })).status).toBe(401);
    expect((await app.request("/v1/demo/status", { method: "POST", headers: { ...auth("A"), "Content-Type": "application/json" }, body: JSON.stringify({ available: false }) })).status).toBe(200);
    expect((await app.request("/v1/patients/A-102/records", { headers: auth("A") })).status).toBe(503);
    expect((await (await app.request("/health")).json()).available).toBe(false);
  });

  it("rejects default secrets for production or non-loopback hosting", () => {
    expect(() => createHospitalApp({ hospitalId: "A", dbPath: ":memory:", host: "0.0.0.0", env: { NODE_ENV: "production" } })).toThrow("HOSPITAL_API_KEY_REQUIRED");
    expect(() => createHospitalApp({ hospitalId: "B", dbPath: ":memory:", host: "0.0.0.0", env: { NODE_ENV: "development", HOSPITAL_API_KEY: LOCAL_HOSPITAL_KEYS.B } })).toThrow("HOSPITAL_API_KEY_REQUIRED");
  });
});

describe("hospital connector", () => {
  it("requests scoped native records and preserves delivery correlation", async () => {
    const app = hospital("A");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("HOSPITAL_A_API_URL", "http://127.0.0.1:8791");
    vi.stubEnv("HOSPITAL_A_API_KEY", LOCAL_HOSPITAL_KEYS.A);
    const request = vi.fn((input: string | URL | Request, init?: RequestInit) => app.request(new Request(input, init)));
    vi.stubGlobal("fetch", request);
    const result = await fetchHospitalRecords("A", "ravi", "request-scoped-01", { categories: ["lab"] });
    expect(result.records).toHaveLength(2);
    expect(result.delivery).toMatchObject({ hospitalId: "A", requestId: "request-scoped-01", source: "api", recordCount: 2 });
    expect(request.mock.calls[0][0].toString()).toContain("categories=lab");
    expect(JSON.stringify(connectionConfiguration())).not.toContain(LOCAL_HOSPITAL_KEYS.A);
    await setHospitalAvailability("A", false, "request-outage-01");
    await expect(fetchHospitalRecords("A", "ravi", "request-denied-01")).rejects.toMatchObject({ code: "HOSPITAL_UNAVAILABLE" });
  });

  it("rejects another person's identity before ingesting records", async () => {
    const app = hospital("B");
    const other = await (await app.request("/v1/patients/B-811/records", { headers: auth("B") })).json();
    other.requestId = "identity-01";
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("HOSPITAL_B_API_URL", "http://127.0.0.1:8792");
    vi.stubEnv("HOSPITAL_B_API_KEY", LOCAL_HOSPITAL_KEYS.B);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(other), { headers: { "Content-Type": "application/json" } })));
    await expect(fetchHospitalRecords("B", "ravi", "identity-01")).rejects.toMatchObject({ code: "HOSPITAL_IDENTITY_MISMATCH" });
  });

  it("rejects unexpected response types and non-HTTPS production URLs", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("HOSPITAL_A_API_URL", "http://127.0.0.1:8791");
    vi.stubEnv("HOSPITAL_A_API_KEY", LOCAL_HOSPITAL_KEYS.A);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Not records</html>", { headers: { "Content-Type": "text/html" } })));
    await expect(fetchHospitalRecords("A", "ravi", "type-01")).rejects.toMatchObject({ code: "HOSPITAL_RESPONSE_TYPE_INVALID" });
    vi.stubEnv("NODE_ENV", "production");
    await expect(fetchHospitalRecords("A", "ravi", "https-01")).rejects.toMatchObject({ code: "HOSPITAL_HTTPS_REQUIRED" });
  });
});
