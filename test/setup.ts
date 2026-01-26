// Polyfill global crypto for Node.js environments that don't have it globally
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  // @ts-expect-error - webcrypto is compatible with global crypto
  globalThis.crypto = webcrypto;
}
