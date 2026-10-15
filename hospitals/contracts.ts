import { z } from "zod";

export const recordKindSchema = z.enum(["lab", "allergy", "medication", "note"]);
export const sourceRecordSchema = z.object({
  id: z.string().min(1).max(160),
  hospitalId: z.enum(["A", "B"]),
  patientLocalId: z.string().min(1).max(80),
  version: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()),
}).strict();

export const hospitalEnvelopeSchema = z.object({
  hospitalId: z.enum(["A", "B"]),
  patient: z.object({
    localId: z.string().min(1).max(80),
    name: z.string().min(1).max(160),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).strict(),
  records: z.array(sourceRecordSchema).max(500),
  revision: z.string().min(1).max(100),
  requestId: z.string().min(1).max(100),
  sentAt: z.string().datetime({ offset: true }),
}).strict();

export const MAX_HOSPITAL_RESPONSE_BYTES = 1024 * 1024;
export const LOCAL_HOSPITAL_KEYS = {
  A: "demo-hospital-a-local-key",
  B: "demo-hospital-b-local-key",
} as const;

export const isLoopback = (hostname: string) => ["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname);
export const safeRequestId = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);
