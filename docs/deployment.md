# Run and deploy the synthetic prototype

## Local development

Use Node.js 24 LTS and npm. From the application directory:

```sh
npm install
npm run dev
```

The Next.js app runs at `http://127.0.0.1:3000`. `/` is the product presentation; `/workspace` is the clinical application. Next.js rewrites same-origin `/api` requests to the Hono API on port 8787. Cloud access is disabled by default. There is no requirement for an AWS or Supabase account to run the synthetic workflow.

For a local built version use `npm run build` to compile Next.js, then `npm start` for the API and `npm run start:web` in another terminal for Next.js. `npm start` does not imply an installed production authentication system.

The backend reads process environment variables. `.env.example` is a reference, not credentials. Next.js loads its supported environment files, but if a local `.env` file is used for the separate backend, load it with your runner or shell; do not assume TypeScript's runner automatically loads it. Never place server credentials in a `NEXT_PUBLIC_` variable.

## Render API

`render.yaml` is a template, not a deployed service. Review paid plan/disk choices in Render before use. It specifies Node 24, the API start command and persistent disk; SQLite requires persistent storage across redeploys. The disk permits only one instance of this prototype. Move persistence to PostgreSQL before horizontal scaling.

Keep public exposure disabled until a real authentication boundary exists. A synthetic demo can be hosted behind access protection, with an explicit public-demo opt-in if supported by the backend. CORS is not authentication. Set the permitted frontend origin exactly and do not use `*`.

## Next.js on Vercel

`vercel.json` uses the Next.js framework preset and `npm run build`. It does not deploy the Hono/SQLite API. Set the Vercel project root to this application directory. Next.js manages its own build output; no static output override is required.

The API's session cookie uses `SameSite=Lax`, so browser requests stay on the Next.js origin. The Next.js configuration rewrites `/api/:path*` to `${API_PROXY_TARGET}/api/:path*`. Set the server-side Vercel build variable to the **actual** Render HTTPS origin, without a trailing slash:

```text
API_PROXY_TARGET=https://YOUR-ACTUAL-RENDER-ORIGIN
```

The placeholder above is instructional and must be replaced. The local default `http://127.0.0.1:8787` works only when the backend runs beside Next.js. Do not leave this default in a Vercel deployment. Next.js reads `API_PROXY_TARGET` in its configuration; after a change, rebuild and redeploy. No guessed cloud host is checked into the configuration.

Set Render's `APP_ORIGINS` to the actual Vercel URL and use `NODE_ENV=production` so the session cookie is Secure. Verify session creation, record retrieval, revocation and exports through the Vercel URL. The browser always calls `/api`; it should not receive AWS, Supabase or Render credentials. A working hosted prototype needs both deployments and the configured backend origin.

## Optional Bedrock text generation

Only the backend may call `integrations/bedrock.ts`. Its caller must authorize and filter evidence first, then recheck permission/source versions before release.

Configure explicitly:

```text
AI_PROVIDER=bedrock
AWS_CLOUD_ENABLED=true
AWS_REGION=<approved-region>
BEDROCK_TEXT_MODEL_ID=<model-or-inference-profile-enabled-in-your-account>
AWS_PROFILE=<explicit-local-profile>
```

For a deployed workload use a role with `AWS_CREDENTIAL_MODE=workload-role`, or an explicitly configured web identity role, instead of local shared profiles. Scope `bedrock:InvokeModel` to approved resources. Verify regional model availability and data routing before choosing an inference profile. No model ID is hardcoded because account access and regional availability differ.

The adapter uses Converse, explicit `maxTokens`, a 45-second timeout and response validation. Rejected responses are errors; do not silently claim successful cloud generation. Turn off or tightly restrict prompt/response logging: clinical text should not enter ordinary service logs.

This project has not provisioned IAM, KMS, Secrets Manager, CloudWatch, CloudTrail, Nova Sonic, HealthLake, Neptune, Knowledge Bases or a vector database. These remain deployment integrations, even though they appeared in the original architecture proposal.

## Optional S3 storage

`integrations/s3.ts` is a server-only adapter. No current cloud bucket is connected. Configure `REPORT_STORAGE_PROVIDER=s3`, `S3_REPORT_BUCKET`, `S3_REPORT_PREFIX` and `S3_KMS_KEY_ID`, together with the explicit AWS settings. Reads and approved export writes must follow backend authorization. The helper restricts object keys to the configured prefix and writes exports using SSE-KMS.

Create a private bucket with public access blocked; configure retention and least-privilege IAM separately. Do not expose raw object keys or long-lived public URLs as substitutes for current consent checks.

## Future Supabase migration

`docs/supabase-schema.sql` is a proposed, unapplied schema. It is intentionally not a plug-in replacement for the local SQLite store. Review and test RLS, integrate real JWT validation and institute membership checks, and implement patient-consent workflows before connecting the app.

The schema denies browser access to clinical rows by default. Service-role credentials bypass RLS and must stay server-side; every service-role operation still requires the application's authorization policy. Adding a Supabase URL alone does not migrate data or implement this boundary.
