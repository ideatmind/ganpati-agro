import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { requiredEnv } from "@/server/env";

function key() {
  const value = requiredEnv("PII_ENCRYPTION_KEY");
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error("PII_ENCRYPTION_KEY must contain 64 hexadecimal characters");
  return Buffer.from(value,"hex");
}

// Call only after an audited super-admin authorization check. Never log the result.
export function decryptAadhaar(ciphertext: string): string {
  const parts=ciphertext.split('.');
  if(parts.length!==3||parts.some(part=>!part||!/^[A-Za-z0-9_-]+$/.test(part)))throw new Error('Invalid encrypted identifier');
  const [iv,tag,encrypted]=parts.map(part=>Buffer.from(part,'base64url'));
  if(iv.length!==12||tag.length!==16||encrypted.length!==12)throw new Error('Invalid encrypted identifier');
  const decipher=createDecipheriv('aes-256-gcm',key(),iv);decipher.setAuthTag(tag);
  const value=Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8');
  if(!/^\d{12}$/.test(value))throw new Error('Invalid encrypted identifier');
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
