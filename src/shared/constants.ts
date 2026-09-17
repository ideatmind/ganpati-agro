export const REGISTRATION_FEE_PAISE = 50_000;

export {DISTRICTS,TALUKAS} from '@/features/geography/directory';

export const INCOME_OPTIONS = ["agriculture","business","job","other"] as const;
export { CLUSTER_OPTIONS } from "@/shared/crop-catalog";
export const IRRIGATION_OPTIONS = ["well","borewell","canal","drip","sprinkler","rainfed","river","other"] as const;

export function formatRupees(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: paise % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(paise / 100);
}

export const IRRIGATION_LABELS: Record<string,string> = {well:"विहीर / Well",borewell:"कूपनलिका / Borewell",canal:"कालवा / Canal",drip:"ठिबक सिंचन / Drip",sprinkler:"तुषार सिंचन / Sprinkler",rainfed:"कोरडवाहू / Rainfed",river:"नदी / River",other:"इतर / Other"};
