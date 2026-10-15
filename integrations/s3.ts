import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { requireAwsConfiguration } from './aws-config';

const MAX_REPORT_BYTES = 20 * 1024 * 1024;

function configuredS3() {
  if (process.env.REPORT_STORAGE_PROVIDER !== 's3') throw new Error('S3_NOT_SELECTED');
  const { region } = requireAwsConfiguration();
  const bucket = process.env.S3_REPORT_BUCKET?.trim();
  const prefix = process.env.S3_REPORT_PREFIX?.trim() || 'synthetic/';
  if (!bucket || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('S3_BUCKET_REQUIRED');
  if (!/^[A-Za-z0-9_/-]+\/$/.test(prefix) || prefix.includes('..')) throw new Error('S3_INVALID_PREFIX');
  return { region, bucket, prefix };
}

export function validateReportKey(key: string, prefix: string): string {
  if (!key.startsWith(prefix) || key.length > 512 || !/^[A-Za-z0-9_./-]+$/.test(key) ||
      key.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('S3_INVALID_OBJECT_KEY');
  return key;
}

/** Server-side only. The caller must authorize the patient and object before every read. */
export async function getReportObject(key: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const config = configuredS3();
  validateReportKey(key, config.prefix);
  const client = new S3Client({ region: config.region, maxAttempts: 3 });
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }), {
      abortSignal: AbortSignal.timeout(30000),
    });
    if (!response.Body || response.ContentLength === undefined || response.ContentLength > MAX_REPORT_BYTES) {
      throw new Error('S3_REPORT_SIZE_INVALID');
    }
    const bytes = await response.Body.transformToByteArray();
    if (bytes.byteLength > MAX_REPORT_BYTES) throw new Error('S3_REPORT_SIZE_INVALID');
    return { bytes, contentType: response.ContentType ?? 'application/octet-stream' };
  } finally { client.destroy(); }
}

/** Upload an already approved export. No public ACLs or patient metadata are attached. */
export async function putApprovedExport(input: { key: string; bytes: Uint8Array; contentType: string }): Promise<void> {
  const config = configuredS3();
  validateReportKey(input.key, config.prefix);
  const kmsKeyId = process.env.S3_KMS_KEY_ID?.trim();
  if (!kmsKeyId) throw new Error('S3_KMS_KEY_REQUIRED');
  if (!input.bytes.byteLength || input.bytes.byteLength > MAX_REPORT_BYTES ||
      !['application/fhir+json', 'application/json', 'application/pdf', 'text/html'].includes(input.contentType)) {
    throw new Error('S3_INVALID_EXPORT');
  }
  const client = new S3Client({ region: config.region, maxAttempts: 3 });
  try {
    await client.send(new PutObjectCommand({
      Bucket: config.bucket, Key: input.key, Body: input.bytes, ContentType: input.contentType,
      ServerSideEncryption: 'aws:kms', SSEKMSKeyId: kmsKeyId, CacheControl: 'no-store',
    }), { abortSignal: AbortSignal.timeout(30000) });
  } finally { client.destroy(); }
}
