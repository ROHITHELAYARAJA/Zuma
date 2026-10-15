# Prototype acceptance checks

Use fictional records only. Automated test results belong in the final build report; this document is a checklist, not a claim that every check passed.

| Check | Expected result |
|---|---|
| Import different A/B lab formats | Supported names/codes become the intended FHIR fields with original source values retained. |
| Unknown code, unsupported unit or malformed value | Actionable validation error; no guessed mapping or comparison. |
| Two people named Ravi | Distinct identities; uncertain links need confirmation. |
| Correct A/B patient link | Only explicitly linked record identifiers appear. |
| Doctor vs payer permissions | Role and purpose restrict retrieval; caller-supplied role headers do not grant production access. |
| Denied/expired/revoked consent | Record, question, summary and export routes deny unauthorized data. |
| Consent revoked during generation | Permission rechecked before response; generated content not released. |
| Hospital unavailable | Available-source coverage says the history is incomplete. |
| Conflicting allergy statements | Both sources shown; no automatic reconciliation. |
| Comparable results | Dates and original units preserved; incompatible contexts not automatically trended. |
| Corrected source record | Earlier summary cannot silently pass as current. |
| Prompt injection in report | It remains source data, cannot change permissions or invoke tools. |
| Fabricated model citation | Cloud response rejected. |
| No evidence | Explicit inability to answer; no invented patient history. |
| Export | Review state and current permission checked; supported FHIR fields/references validated. |
| Voice unavailable | Clear text fallback; no claim of an active AWS voice service. |
| Audit history | Reads, denials, consent changes and exports identify actor and time without unnecessary report content. |
| Restart | Workflow state persists in configured SQLite database. |

Run `npm run typecheck`, `npm test`, and `npm run build`. The integration unit tests exercise local validation only and never contact AWS. Separately exercise the browser: select patient, review sources, ask a question, inspect contradictions, approve/export, revoke and attempt retrieval again.

Cloud acceptance remains unverified until a configured account is tested for model access, IAM scope, region/data handling, supported language accuracy, encryption, logs and failures. Full FHIR profile conformance needs the chosen implementation guide and terminology packages, not only the built-in prototype checks.
