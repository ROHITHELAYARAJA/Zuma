import { Hono } from 'hono';

export const platformRouter = new Hono();
platformRouter.get('/status', (c) => {
  const configured = (keys: string[]) => keys.every((key) => Boolean(process.env[key]?.trim()));
  return c.json({
    syntheticOnly: true,
    authProvider: process.env.AUTH_PROVIDER ?? 'demo',
    recordProvider: process.env.HOSPITAL_DATA_PROVIDER ?? 'api',
    ragProvider: process.env.RAG_PROVIDER ?? 'local',
    components: [
      { platform: 'Vercel', title: 'Website and same-origin API gateway', configured: true, status: 'application-code', elements: ['Next.js App Router', 'Clinical workspace and deployment guide', 'HttpOnly authentication cookies forwarded to Render', 'No AWS or Supabase secrets in the browser'] },
      { platform: 'Render', title: 'Clinical API and two hospital APIs', configured: configured(['HOSPITAL_A_API_URL', 'HOSPITAL_B_API_URL']), status: 'configuration-only', elements: ['Clinical API on port 8787 locally', 'Aster General API on port 8791 locally', 'Meridian Medical API on port 8792 locally', 'FHIR mappings, patient checks, consent enforcement and summary approval'] },
      { platform: 'Supabase', title: 'Sign-in, membership and permission state', configured: configured(['SUPABASE_URL']) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY), status: 'configuration-only', elements: ['Supabase Auth verifies users', 'clinician_memberships determines hospital and role', 'clinical_state_sessions persists permission and approval state', 'Row-level security prevents direct browser access to state'] },
      { platform: 'AWS', title: 'Private documents and knowledge-base RAG', configured: process.env.AWS_CLOUD_ENABLED === 'true' && configured(['AWS_REGION', 'S3_REPORT_BUCKET', 'BEDROCK_KNOWLEDGE_BASE_ID', 'BEDROCK_TEXT_MODEL_ID']), status: 'configuration-only', elements: ['S3 raw and normalized FHIR archives', 'S3 evidence prefix connected to Bedrock Knowledge Bases', 'Metadata-filtered retrieval followed by live authorization checks', 'Bedrock Converse generates cited clinician-review drafts', 'KMS, IAM, CloudWatch and CloudTrail controls'] },
    ],
    notice: 'Configuration presence is not a live cloud connection test. Synthetic demonstration; not an ABDM-certified or Epic-connected service.',
  });
});
