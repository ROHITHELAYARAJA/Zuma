/** Cloud calls are opt-in. Importing this module never resolves AWS credentials. */
export function requireAwsConfiguration(env: NodeJS.ProcessEnv = process.env): { region: string } {
  if (env.AWS_CLOUD_ENABLED !== 'true') {
    throw new Error('AWS_CLOUD_DISABLED: Set AWS_CLOUD_ENABLED=true explicitly to enable cloud processing.');
  }
  if (!env.AWS_REGION?.trim()) throw new Error('AWS_REGION_REQUIRED');

  const explicitCredentials = Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
  const namedProfile = Boolean(env.AWS_PROFILE?.trim());
  const webIdentity = Boolean(env.AWS_ROLE_ARN && env.AWS_WEB_IDENTITY_TOKEN_FILE);
  // A workload role uses the SDK credential chain only after this explicit operator opt-in.
  const workloadRole = env.AWS_CREDENTIAL_MODE === 'workload-role';
  if (!explicitCredentials && !namedProfile && !webIdentity && !workloadRole) {
    throw new Error('AWS_CREDENTIAL_CONFIGURATION_REQUIRED: Configure a named profile or workload role explicitly.');
  }
  return { region: env.AWS_REGION.trim() };
}
