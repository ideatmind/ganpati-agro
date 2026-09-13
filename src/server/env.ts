import "server-only";

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function isPaymentDemo() {
  return process.env.NODE_ENV !== "production" && process.env.PAYMENT_DEMO_MODE === "true";
}
