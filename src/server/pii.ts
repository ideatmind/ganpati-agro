import "server-only";
import { createCipheriv, createHmac, randomBytes } from "node:crypto";
import { requiredEnv } from "@/server/env";

function key() {
  const value = Buffer.from(requiredEnv("PII_ENCRYPTION_KEY"), "hex");
  if (value.length !== 32) throw new Error("PII_ENCRYPTION_KEY must contain 64 hexadecimal characters");
  return value;
}

export function protectAadhaar(aadhaar: string) {
  const encryptionKey = key();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(aadhaar, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    fingerprint: createHmac("sha256", encryptionKey).update(aadhaar).digest("hex"),
    ciphertext: [iv, tag, encrypted].map((value) => value.toString("base64url")).join("."),
    lastFour: aadhaar.slice(-4),
  };
}
