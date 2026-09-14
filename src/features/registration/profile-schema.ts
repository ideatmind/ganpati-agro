import { z } from "zod";
import { DISTRICTS, TALUKAS, INCOME_OPTIONS, CLUSTER_OPTIONS } from "@/shared/constants";

export const profileChangesSchema = z.strictObject({
  name: z.string().trim().min(2).max(200).optional(),
  date_of_birth: z.iso.date().refine(value => value <= new Date().toISOString().slice(0,10)).optional(),
  village: z.string().trim().min(1).max(200).optional(),
  district: z.enum(DISTRICTS.map(item => item.value)).optional(),
  taluka: z.enum(TALUKAS.map(item => item[0])).optional(),
  income_source: z.enum(INCOME_OPTIONS).optional(),
  cluster_type: z.enum(CLUSTER_OPTIONS).optional(),
}).refine(value => Object.keys(value).length > 0).refine(value => !value.district || !value.taluka || TALUKAS.some(([taluka,district]) => taluka === value.taluka && district === value.district));
