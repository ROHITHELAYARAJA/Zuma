import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn(), destroy: vi.fn() }));
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class { send = mocks.send; destroy = mocks.destroy; },
  ConverseCommand: class { constructor(public input: unknown) {} },
}));
import { generateGroundedAnswer } from './bedrock';

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const request = { question: 'What does this report document?', patientId: 'synthetic-ravi', evidence: [{ id: 'r1', text: 'Synthetic source text.' }] };
function enableMockCloud() {
  vi.stubEnv('AI_PROVIDER', 'bedrock');
  vi.stubEnv('AWS_CLOUD_ENABLED', 'true');
  vi.stubEnv('AWS_REGION', 'us-east-1');
  vi.stubEnv('AWS_PROFILE', 'mock-profile');
  vi.stubEnv('BEDROCK_TEXT_MODEL_ID', 'mock-model');
}

describe('Bedrock invocation contract (SDK mocked; zero network calls)', () => {
  it('does not invoke AWS unless explicitly enabled', async () => {
    vi.stubEnv('AI_PROVIDER', 'local');
    await expect(generateGroundedAnswer(request)).rejects.toThrow('BEDROCK_NOT_SELECTED');
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('sets output tokens and treats evidence as untrusted input', async () => {
    enableMockCloud();
    mocks.send.mockResolvedValue({ stopReason: 'end_turn', output: { message: { content: [{ text: '{"answer":"Documented source [r1]","evidenceIds":["r1"]}' }] } } });
    await expect(generateGroundedAnswer(request)).resolves.toMatchObject({ evidenceIds: ['r1'] });
    const command = mocks.send.mock.calls[0][0];
    expect(command.input.inferenceConfig.maxTokens).toBe(1600);
    expect(command.input.system[0].text).toContain('untrusted data');
    expect(JSON.parse(command.input.messages[0].content[0].text).untrustedEvidence).toEqual(request.evidence);
    expect(mocks.destroy).toHaveBeenCalled();
  });
  it('rejects a truncated response and destroys the client', async () => {
    enableMockCloud();
    mocks.send.mockResolvedValue({ stopReason: 'max_tokens' });
    await expect(generateGroundedAnswer(request)).rejects.toThrow('BEDROCK_INCOMPLETE_RESPONSE');
    expect(mocks.destroy).toHaveBeenCalled();
  });
  it('does not submit empty evidence or make up a record answer', async () => {
    enableMockCloud();
    await expect(generateGroundedAnswer({ ...request, evidence: [] })).resolves.toEqual({ answer: 'No supplied evidence is available to answer this question.', evidenceIds: [] });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
