import { z } from "zod";
import { isCatalogCrop, cropBelongsToCluster } from "@/shared/crop-catalog";
import { CLUSTER_OPTIONS, DISTRICTS, INCOME_OPTIONS, IRRIGATION_OPTIONS, TALUKAS } from "@/shared/constants";

import {passwordSchema,mobileSchema,aadhaarSchema} from '@/shared/credential-schema';
import {personNameSchema} from '@/shared/person-name';


const districtValues = DISTRICTS.map((item) => item.value) as [string, ...string[]];
const talukaValues = TALUKAS.map((item) => item[0]) as [string, ...string[]];

export const registrationSchema = z.object({
  name: personNameSchema,
  expected_fee_paise:z.number().int().positive().max(2_147_483_647).optional(),
  mobile: mobileSchema,
  password: passwordSchema,
  date_of_birth: z.iso.date(),
  aadhar_no: aadhaarSchema,
  village: z.string().trim().min(1).max(200),
  district: z.enum(districtValues),
  taluka: z.enum(talukaValues),
  income_source: z.enum(INCOME_OPTIONS),
  cluster_type: z.enum(CLUSTER_OPTIONS),
  referral_code: z.string().trim().toUpperCase().regex(/^$|^[A-Z0-9]{6,16}$/).optional().default(""),
  cash_received: z.boolean().optional().default(false),
  cash_note: z.string().trim().max(200).optional().default(""),
  consent: z.literal(true),
  website: z.string().max(0).optional().default(""),
  plots: z.array(z.preprocess(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const plot = value as Record<string, unknown>;
    // Accept older single-choice clients during the coordinated rollout.
    return {...plot, crop_names: plot.crop_names ?? (plot.crop_name === undefined ? undefined : [plot.crop_name]),
      irrigation_sources: plot.irrigation_sources ?? (plot.irrigation_source === undefined ? undefined : [plot.irrigation_source])};
  }, z.object({
    plot_no: z.string().trim().min(1).max(100),
    area_acres: z.union([z.number(),z.string().regex(/^[0-9]+(\.[0-9]{1,2})?$/)]).pipe(z.coerce.number<string|number>().min(0.01).max(100_000).refine(value=>Math.abs(value*100-Math.round(value*100))<1e-7,'Use at most two decimal places for acres.')),
    crop_names: z.array(z.string().trim().min(1).max(100).refine(isCatalogCrop)).min(1).max(18).refine(values => new Set(values).size === values.length, "Select each crop once"),
    irrigation_sources: z.array(z.enum(IRRIGATION_OPTIONS)).min(1).max(IRRIGATION_OPTIONS.length).refine(values => new Set(values).size === values.length, "Select each source once"),
  }))).min(1).max(10),
}).superRefine((data, ctx) => {
  data.plots.forEach((plot,index)=>{
    if(plot.crop_names.some(crop=>!cropBelongsToCluster(data.cluster_type,crop)))ctx.addIssue({code:"custom",path:["plots",index,"crop_names"],message:"निवडलेल्या समूहातील पीक निवडा. / Select a crop from the selected cluster."});
  });
  const match = TALUKAS.some(([taluka, district]) => taluka === data.taluka && district === data.district);
  if (!match) ctx.addIssue({ code: "custom", path: ["taluka"], message: "Taluka does not belong to the selected district" });
  const birth = new Date(`${data.date_of_birth}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || birth > new Date()) ctx.addIssue({ code: "custom", path: ["date_of_birth"], message: "Date of birth must be in the past" });
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
