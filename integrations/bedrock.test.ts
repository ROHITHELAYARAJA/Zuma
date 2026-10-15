import { describe, expect, it } from 'vitest';
import { parseGroundedResponse } from './bedrock';
import { requireAwsConfiguration } from './aws-config';
import { validateReportKey } from './s3';

describe('optional cloud adapters fail closed without contacting AWS', () => {
  const evidence = [{ id: 'report-a', text: 'A synthetic report.' }];
  it('accepts a valid response citing only supplied evidence', () => {
    expect(parseGroundedResponse('{"answer":"A documented finding [report-a]","evidenceIds":["report-a"]}', evidence).evidenceIds).toEqual(['report-a']);
  });
  it('rejects fabricated citations', () => {
    expect(() => parseGroundedResponse('{"answer":"A finding [other]","evidenceIds":["other"]}', evidence)).toThrow('BEDROCK_INVALID_CITATION');
  });
  it('rejects inline citations that disagree with the response list', () => {
    expect(() => parseGroundedResponse('{"answer":"A finding [report-a]","evidenceIds":[]}', evidence)).toThrow('BEDROCK_INVALID_CITATION');
  });
  it('rejects uncited medical statements and malformed JSON', () => {
    expect(() => parseGroundedResponse('{"answer":"The patient has no allergies.","evidenceIds":[]}', evidence)).toThrow('BEDROCK_UNSUPPORTED_ANSWER');
    expect(() => parseGroundedResponse('not JSON', evidence)).toThrow('BEDROCK_INVALID_JSON');
  });
  it('allows an explicit inability to answer without evidence', () => {
    expect(parseGroundedResponse('{"answer":"Insufficient evidence to answer.","evidenceIds":[]}', []).evidenceIds).toEqual([]);
  });
  it('requires explicit cloud and credential configuration', () => {
    expect(() => requireAwsConfiguration({ NODE_ENV: 'test' })).toThrow('AWS_CLOUD_DISABLED');
    expect(() => requireAwsConfiguration({ NODE_ENV: 'test', AWS_CLOUD_ENABLED: 'true', AWS_REGION: 'us-east-1' })).toThrow('AWS_CREDENTIAL_CONFIGURATION_REQUIRED');
    expect(requireAwsConfiguration({ NODE_ENV: 'test', AWS_CLOUD_ENABLED: 'true', AWS_REGION: 'us-east-1', AWS_PROFILE: 'synthetic-demo' })).toEqual({ region: 'us-east-1' });
  });
  it('blocks S3 traversal and objects outside the configured prefix', () => {
    expect(validateReportKey('synthetic/ravi/report.json', 'synthetic/')).toBe('synthetic/ravi/report.json');
    expect(() => validateReportKey('synthetic/../other.json', 'synthetic/')).toThrow();
    expect(() => validateReportKey('other/report.json', 'synthetic/')).toThrow();
  });
});
