import { afterEach, expect, it, vi } from "vitest";
import { evidenceRequest } from "./evidence-transport";

vi.mock("node:timers/promises", () => ({ setTimeout: async () => undefined }));
afterEach(() => vi.unstubAllGlobals());
const url = new URL("https://evidence.example/answer");

it("recovers from a Render HTML startup response before returning JSON", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("<html>Starting</html>", { status: 502 })).mockResolvedValueOnce(Response.json({ answer: "Source checked" }));
  vi.stubGlobal("fetch", fetcher);
  const { result } = await evidenceRequest(url, "secret", { question: "Medicines?" });
  expect(result.answer).toBe("Source checked"); expect(fetcher).toHaveBeenCalledTimes(2);
});
it("does not retry structured evidence or authentication failures", async () => {
  for (const status of [401, 503]) {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ detail: "NO_VERIFIED_KNOWLEDGE_BASE_EVIDENCE" }, { status }));
    vi.stubGlobal("fetch", fetcher);
    const { response } = await evidenceRequest(url, "secret", {});
    expect(response.status).toBe(status); expect(fetcher).toHaveBeenCalledTimes(1);
  }
});
it("fails closed with a useful error when the gateway remains unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("gateway error", { status: 503 })));
  await expect(evidenceRequest(url, "secret", {})).rejects.toMatchObject({ code: "EVIDENCE_SERVICE_UNAVAILABLE", status: 503 });
  expect(fetch).toHaveBeenCalledTimes(3);
});
it("does not retry an ingestion mutation", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("connection reset")));
  await expect(evidenceRequest(url, "secret", {}, false)).rejects.toMatchObject({ status: 503 });
  expect(fetch).toHaveBeenCalledTimes(1);
});
