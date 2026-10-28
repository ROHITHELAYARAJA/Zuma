import { ClinicalError } from "../server/clinical/engine";
import { evidenceRequest } from "./evidence-transport";

export async function privateRag(path: string, payload: unknown) {
  const key = process.env.RAG_SERVICE_API_KEY;
  const origin = process.env.RAG_SERVICE_URL;
  if (!origin || !key || key.length < 32) throw new ClinicalError(503, "RAG_SERVICE_NOT_CONFIGURED", "Configure the private Python evidence service. No local answer was substituted.");
  const target = new URL(origin);
  if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) throw new ClinicalError(503, "INVALID_RAG_SERVICE_URL", "Invalid evidence service address.");
  const { response, result } = await evidenceRequest(new URL(path, target), key, payload, ["/comparison/answer", "/comparison/voice"].includes(path));
  if (!response.ok) {
    const detail = typeof result.detail === "string" ? result.detail : "The evidence service could not verify this request.";
    const messages: Record<string, string> = {
      NO_VERIFIED_KNOWLEDGE_BASE_EVIDENCE: "No current permitted evidence was retrieved. Check indexing status and try a specific question; no local answer was substituted.",
      SUMMARY_REQUIRES_EVIDENCE_REVIEW: "The draft could not be fully supported by its sources. Ask a more specific question or inspect the original records.",
      NO_VERIFIED_USER_TRANSCRIPT: "The voice question was not understood. Please try again or type your question.",
      MODEL_RESPONSE_INCOMPLETE: "The answer was interrupted before verification. Please try again.",
    };
    throw new ClinicalError(503, "EVIDENCE_SERVICE_FAILED", detail.startsWith("COMPARISON_CONFIGURATION_REQUIRED:") ? `The Python service needs the existing project's ${detail.split(":")[1]} setting before indexing can run.` : messages[detail] ?? detail);
  }
  return result;
}
