import { z } from "zod";
import { isCatalogCrop, cropBelongsToCluster } from "@/shared/crop-catalog";
import { CLUSTER_OPTIONS, DISTRICTS, INCOME_OPTIONS, IRRIGATION_OPTIONS, TALUKAS } from "@/shared/constants";

import {passwordSchema,mobileSchema,aadhaarSchema} from '@/shared/credential-schema';


const districtValues = DISTRICTS.map((item) => item.value) as [string, ...string[]];
const talukaValues = TALUKAS.map((item) => item[0]) as [string, ...string[]];

export const registrationSchema = z.object({
  name: z.string().trim().min(2).max(200),
  mobile: mobileSchema,
  password: passwordSchema,
  date_of_birth: z.iso.date(),
  aadhar_no: aadhaarSchema,
  village: z.string().trim().min(1).max(200),
  district: z.enum(districtValues),
  taluka: z.enum(talukaValues),
  income_source: z.enum(INCOME_OPTIONS),
  cluster_type: z.enum(CLUSTER_OPTIONS),
  referral_code: z.string().trim().max(16).optional().default(""),
  cash_received: z.boolean().optional().default(false),
  cash_note: z.string().trim().max(200).optional().default(""),
  consent: z.literal(true),
  website: z.string().max(0).optional().default(""),
  plots: z.array(z.object({
    plot_no: z.string().trim().min(1).max(100),
    area_acres: z.coerce.number().positive().max(100_000),
    crop_name: z.string().trim().min(1).max(100).refine(isCatalogCrop, "यादीतील पीक निवडा / Select a crop from the list"),
    irrigation_source: z.enum(IRRIGATION_OPTIONS),
  })).min(1).max(10),
}).superRefine((data, ctx) => {
  data.plots.forEach((plot,index)=>{
    if(!cropBelongsToCluster(data.cluster_type,plot.crop_name))ctx.addIssue({code:"custom",path:["plots",index,"crop_name"],message:"निवडलेल्या समूहातील पीक निवडा. / Select a crop from the selected cluster."});
  });
  const match = TALUKAS.some(([taluka, district]) => taluka === data.taluka && district === data.district);
  if (!match) ctx.addIssue({ code: "custom", path: ["taluka"], message: "Taluka does not belong to the selected district" });
  const birth = new Date(`${data.date_of_birth}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || birth > new Date()) ctx.addIssue({ code: "custom", path: ["date_of_birth"], message: "Date of birth must be in the past" });
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
