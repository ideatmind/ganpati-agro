import 'server-only';
import {AppError} from '@/shared/errors';

export type PaymentMode = 'test' | 'live';
export const testPaymentsEnabled = () => process.env.ENABLE_PAYMENT_MODE_SWITCH === 'true';
export const defaultPaymentMode = ():PaymentMode => process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') ? 'test' : 'live';
export function paymentKeyId(mode:PaymentMode) {
  const explicit=process.env[`RAZORPAY_${mode.toUpperCase()}_KEY_ID`];
  const legacy=process.env.RAZORPAY_KEY_ID;
  return explicit || (legacy?.startsWith(`rzp_${mode}_`)?legacy:undefined);
}
export function paymentSecret(mode:PaymentMode) {
  const explicitKey=process.env[`RAZORPAY_${mode.toUpperCase()}_KEY_ID`];
  const value=process.env[`RAZORPAY_${mode.toUpperCase()}_KEY_SECRET`] || (!explicitKey&&process.env.RAZORPAY_KEY_ID?.startsWith(`rzp_${mode}_`)?process.env.RAZORPAY_KEY_SECRET:undefined);
  if(!value)throw new AppError(503,'PAYMENTS_UNAVAILABLE',`${mode==='test'?'Test':'Live'} payments are not configured.`);
  return value;
}
export function checkoutKey(mode:PaymentMode) {
  if(mode==='test'&&process.env.VERCEL_ENV==='production'&&!testPaymentsEnabled())throw new AppError(503,'PAYMENTS_UNAVAILABLE','Test payments are not enabled.');
  const key=paymentKeyId(mode);
  if(!key?.startsWith(`rzp_${mode}_`)||/replace|placeholder/i.test(key+paymentSecret(mode)))throw new AppError(503,'PAYMENTS_UNAVAILABLE',`${mode==='test'?'Test':'Live'} payments are not configured. ${mode==='live'?'Turn on Test mode to test checkout.':''}`.trim());
  return key;
}
