import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { BedrockAgentClient, CreateKnowledgeBaseCommand, GetKnowledgeBaseCommand, CreateDataSourceCommand, GetDataSourceCommand } from "@aws-sdk/client-bedrock-agent";
import { requireAwsConfiguration } from "../../integrations/aws-config";
import { startEvidenceIngestion, getEvidenceIngestionStatus } from "../../integrations/ingestion";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
function client() { return new BedrockAgentClient({ ...requireAwsConfiguration(), maxAttempts: 1 }); }
function mutationAllowed() {
  if (process.env.AWS_PROVISIONING_ENABLED !== "true") throw new Error("AWS_PROVISIONING_DISABLED: Explicitly set AWS_PROVISIONING_ENABLED=true for provisioning.");
}

export async function createManagedKnowledgeBase() {
  mutationAllowed();
  const roleArn = required("BEDROCK_KB_ROLE_ARN");
  const kmsKeyArn = process.env.BEDROCK_KB_KMS_KEY_ARN?.trim();
  const sdk = client();
  try {
    const result = await sdk.send(new CreateKnowledgeBaseCommand({
      name: process.env.BEDROCK_KB_NAME || "ClinicalSyntheticEvidence",
      description: "Synthetic two-hospital clinical evidence with live application authorization",
      roleArn,
      clientToken: randomUUID(),
      knowledgeBaseConfiguration: { type: "MANAGED", managedKnowledgeBaseConfiguration: {
        embeddingModelType: "MANAGED",
        ...(kmsKeyArn ? { serverSideEncryptionConfiguration: { kmsKeyArn } } : {}),
      } },
      tags: { workload: "clinical-synthetic-prototype", data: "synthetic-only" },
    }), { abortSignal: AbortSignal.timeout(30000) });
    return { knowledgeBaseId: result.knowledgeBase?.knowledgeBaseId, arn: result.knowledgeBase?.knowledgeBaseArn, status: result.knowledgeBase?.status, next: "Set BEDROCK_KNOWLEDGE_BASE_ID and call status until ACTIVE; do not connect or ingest before ACTIVE." };
  } finally { sdk.destroy(); }
}

export async function getKnowledgeBaseStatus() {
  const sdk = client();
  try {
    const result = await sdk.send(new GetKnowledgeBaseCommand({ knowledgeBaseId: required("BEDROCK_KNOWLEDGE_BASE_ID") }));
    return { knowledgeBaseId: result.knowledgeBase?.knowledgeBaseId, status: result.knowledgeBase?.status, type: result.knowledgeBase?.knowledgeBaseConfiguration?.type, failureCount: result.knowledgeBase?.failureReasons?.length ?? 0 };
  } finally { sdk.destroy(); }
}

export async function connectManagedS3Evidence() {
  mutationAllowed();
  const knowledgeBaseId = required("BEDROCK_KNOWLEDGE_BASE_ID");
  const bucketName = required("S3_REPORT_BUCKET");
  const accountId = required("AWS_ACCOUNT_ID");
  if (!/^\d{12}$/.test(accountId)) throw new Error("AWS_ACCOUNT_ID_INVALID");
  const sdk = client();
  try {
    const current = await sdk.send(new GetKnowledgeBaseCommand({ knowledgeBaseId }));
    if (current.knowledgeBase?.status !== "ACTIVE" || current.knowledgeBase.knowledgeBaseConfiguration?.type !== "MANAGED") throw new Error("ACTIVE_MANAGED_KNOWLEDGE_BASE_REQUIRED");
    const result = await sdk.send(new CreateDataSourceCommand({
      knowledgeBaseId,
      name: "ClinicalSyntheticS3Evidence",
      description: "Only normalized synthetic evidence HTML and metadata, excluding raw and FHIR JSON",
      clientToken: randomUUID(),
      dataSourceConfiguration: { type: "MANAGED_KNOWLEDGE_BASE_CONNECTOR", managedKnowledgeBaseConnectorConfiguration: {
        connectorParameters: { type: "S3", version: "1", connectionConfiguration: { bucketName, bucketOwnerAccountId: accountId },
          filterConfiguration: { inclusionPrefixes: ["evidence/"], exclusionPrefixes: ["raw/", "fhir/"], maxFileSizeInMegaBytes: "1" } },
      } },
    }), { abortSignal: AbortSignal.timeout(30000) });
    return { dataSourceId: result.dataSource?.dataSourceId, status: result.dataSource?.status, next: "Set BEDROCK_DATA_SOURCE_ID; check source-status until AVAILABLE, then upload normalized evidence and start ingestion." };
  } finally { sdk.destroy(); }
}

export async function getDataSourceStatus() {
  const sdk = client();
  try {
    const result = await sdk.send(new GetDataSourceCommand({ knowledgeBaseId: required("BEDROCK_KNOWLEDGE_BASE_ID"), dataSourceId: required("BEDROCK_DATA_SOURCE_ID") }));
    return { dataSourceId: result.dataSource?.dataSourceId, status: result.dataSource?.status, failureCount: result.dataSource?.failureReasons?.length ?? 0 };
  } finally { sdk.destroy(); }
}

export function runtimePolicy() {
  const region = required("AWS_REGION");
  const account = required("AWS_ACCOUNT_ID");
  const bucket = required("S3_REPORT_BUCKET");
  const keyArn = required("S3_KMS_KEY_ID");
  const kbId = required("BEDROCK_KNOWLEDGE_BASE_ID");
  const modelArns = required("BEDROCK_ALLOWED_MODEL_ARNS").split(",").map((value) => value.trim());
  if (!/^\d{12}$/.test(account) || !/^[A-Za-z0-9]{10}$/.test(kbId) || modelArns.some((value) => !value.startsWith("arn:") || value.includes("*"))) throw new Error("EXACT_RUNTIME_RESOURCE_ARNS_REQUIRED");
  return { Version: "2012-10-17", Statement: [
    { Sid: "ReadAuthorizedEvidence", Effect: "Allow", Action: ["bedrock:Retrieve", "bedrock:StartIngestionJob", "bedrock:GetIngestionJob"], Resource: `arn:aws:bedrock:${region}:${account}:knowledge-base/${kbId}` },
    { Sid: "InvokeSelectedModels", Effect: "Allow", Action: ["bedrock:InvokeModel"], Resource: modelArns },
    { Sid: "ScopedStorageListing", Effect: "Allow", Action: ["s3:ListBucket"], Resource: `arn:aws:s3:::${bucket}`, Condition: { StringLike: { "s3:prefix": ["evidence/*", "raw/*", "fhir/*"] } } },
    { Sid: "SyntheticObjectAccess", Effect: "Allow", Action: ["s3:GetObject", "s3:PutObject"], Resource: ["evidence", "raw", "fhir"].map((prefix) => `arn:aws:s3:::${bucket}/${prefix}/*`) },
    { Sid: "StorageKey", Effect: "Allow", Action: ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"], Resource: keyArn },
  ] };
}

async function main() {
  const action = process.argv[2];
  if (["create", "connect", "ingest"].includes(action) && !process.argv.includes("--apply")) throw new Error("PROVISIONING_REQUIRES_APPLY_FLAG");
  const result = action === "create" ? await createManagedKnowledgeBase() : action === "status" ? await getKnowledgeBaseStatus() : action === "connect" ? await connectManagedS3Evidence() : action === "source-status" ? await getDataSourceStatus() : action === "ingest" ? await startEvidenceIngestion() : action === "ingestion-status" ? await getEvidenceIngestionStatus(required("BEDROCK_INGESTION_JOB_ID")) : action === "runtime-policy" ? runtimePolicy() : { actions: ["create --apply", "status", "connect --apply", "source-status", "ingest --apply", "ingestion-status", "runtime-policy"], mutatingCommandsRequire: "AWS_CLOUD_ENABLED=true, explicit credentials, AWS_PROVISIONING_ENABLED=true and --apply", cloudResourcesCreatedByImport: false };
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error: unknown) => { process.stderr.write((error instanceof Error ? error.message : "AWS_SETUP_FAILED") + "\n"); process.exitCode = 1; });
