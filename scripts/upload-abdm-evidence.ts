import { readdirSync,readFileSync } from "node:fs";
import { S3Client,PutObjectCommand } from "@aws-sdk/client-s3";
import { requireAwsConfiguration } from "../integrations/aws-config";
import { startEvidenceIngestion } from "../integrations/ingestion";
if(!process.argv.includes('--apply'))throw new Error('Use --apply to upload repository evidence to a separate ABDM demonstration knowledge base.');
if(process.env.ABDM_KB_DATASET!=='nha-abdm-repository')throw new Error('Set ABDM_KB_DATASET=nha-abdm-repository and configure a separate demonstration KB. Do not mix patient datasets.');
const bucket=process.env.S3_REPORT_BUCKET;if(!bucket)throw new Error('S3_REPORT_BUCKET_REQUIRED');
const key=process.env.S3_KMS_KEY_ID;if(!key)throw new Error('S3_KMS_KEY_ID_REQUIRED');
const client=new S3Client(requireAwsConfiguration());
try{
  for(const file of readdirSync('data/abdm/evidence'))await client.send(new PutObjectCommand({Bucket:bucket,Key:`evidence/${file}`,Body:readFileSync(`data/abdm/evidence/${file}`),ContentType:file.endsWith('.html')?'text/html':'application/json',ServerSideEncryption:'aws:kms',SSEKMSKeyId:key}));
  console.log(JSON.stringify(await startEvidenceIngestion()));
}finally{client.destroy();}
