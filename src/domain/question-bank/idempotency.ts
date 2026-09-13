import { canonicalJsonStringify, sha256Hex } from './hashing';

export interface IdempotencyFingerprintInput {
  scope: string;
  route: string;
  payload: unknown;
}

export const createIdempotencyKeyHash = (key: string): string =>
  sha256Hex(key.trim());

export const createIdempotencyFingerprint = (
  input: IdempotencyFingerprintInput
): string =>
  sha256Hex(
    canonicalJsonStringify({
      payload: input.payload,
      route: input.route,
      scope: input.scope,
    })
  );

