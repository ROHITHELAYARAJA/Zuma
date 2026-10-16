import { ClinicalError } from "../server/clinical/engine";

export async function privateRag(path: string, payload: unknown) {
  const key = process.env.RAG_SERVICE_API_KEY;
  const origin = process.env.RAG_SERVICE_URL;
  if (!origin || !key || key.length < 32) throw new ClinicalError(503, "RAG_SERVICE_NOT_CONFIGURED", "Configure the private Python evidence service. No local answer was substituted.");
  const target = new URL(origin);
  if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) throw new ClinicalError(503, "INVALID_RAG_SERVICE_URL", "Invalid evidence service address.");
  const response = await fetch(new URL(path, target), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(115000) });
  const result = await response.json();
  if (!response.ok) throw new ClinicalError(503, "EVIDENCE_SERVICE_FAILED", typeof result.detail === "string" ? result.detail : "The evidence service could not verify this request.");
  return result;
}
