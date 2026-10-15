import { BedrockAgentRuntimeClient, RetrieveCommand, type RetrievalFilter } from "@aws-sdk/client-bedrock-agent-runtime";
import type { ClinicalRecord } from "../shared/types";
import { requireAwsConfiguration } from "./aws-config";
import { assertSyntheticRecords, canonicalRecordText, evidenceDigest } from "./ingestion";

export async function retrieveKnowledgeEvidence(input: { question: string; patientId: string; records: ClinicalRecord[] }): Promise<{ evidence: { id: string; text: string }[]; matchedRecordIds: string[]; candidates: number }> {
  const { region } = requireAwsConfiguration();
  const knowledgeBaseId = process.env.BEDROCK_KNOWLEDGE_BASE_ID?.trim();
  if (!knowledgeBaseId || !/^[A-Za-z0-9]{10}$/.test(knowledgeBaseId)) throw new Error("BEDROCK_KNOWLEDGE_BASE_ID_REQUIRED");
  if (!["managed", "customer"].includes(process.env.BEDROCK_KB_MODE ?? "managed")) throw new Error("BEDROCK_KB_MODE_INVALID");
  if (!input.question.trim() || input.question.length > 4000) throw new Error("BEDROCK_QUERY_INVALID");
  assertSyntheticRecords(input);
  if (!input.records.length) return { evidence: [], matchedRecordIds: [], candidates: 0 };
  const records = new Map(input.records.map((record) => [record.id, record]));
  const allow = (key: string, values: string[]): RetrievalFilter => values.length === 1 ? { equals: { key, value: values[0] } } : { in: { key, value: values } };
  const filter: RetrievalFilter = { andAll: [
    { equals: { key: "patient_id", value: input.patientId } },
    allow("hospital_id", [...new Set(input.records.map((record) => record.hospitalId))]),
    allow("record_id", [...records.keys()]),
    allow("category", [...new Set(input.records.map((record) => record.kind))]),
    { equals: { key: "synthetic", value: true } },
  ] };
  const client = new BedrockAgentRuntimeClient({ region, maxAttempts: 1 });
  try {
    const result = await client.send(new RetrieveCommand({
      knowledgeBaseId,
      retrievalQuery: { text: input.question },
      retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: 20, filter } },
    }), { abortSignal: AbortSignal.timeout(30000) });
    const candidates = result.retrievalResults ?? [];
    const matched = new Map<string, { id: string; text: string }>();
    for (const candidate of candidates) {
      const metadata = candidate.metadata;
      if (!metadata || typeof metadata.record_id !== "string") continue;
      const record = records.get(metadata.record_id);
      if (!record || metadata.patient_id !== input.patientId || metadata.hospital_id !== record.hospitalId ||
          metadata.version !== record.version || metadata.category !== record.kind || metadata.synthetic !== true ||
          metadata.content_sha256 !== evidenceDigest(record)) continue;
      if (matched.has(record.id)) continue;
      const passage = candidate.content?.text?.trim();
      const verifiedExcerpt = passage && passage.length >= 20 && passage.length <= 2000 && record.text.includes(passage) ? `\nVerified retrieved excerpt: ${passage}` : "";
      matched.set(record.id, { id: record.citationId, text: canonicalRecordText(record) + verifiedExcerpt });
    }
    return { evidence: [...matched.values()], matchedRecordIds: [...matched.keys()], candidates: candidates.length };
  } finally { client.destroy(); }
}
