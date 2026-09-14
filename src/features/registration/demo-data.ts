import { CROP_CATEGORIES } from "@/shared/crop-catalog";
import { INCOME_OPTIONS, IRRIGATION_OPTIONS } from "@/shared/constants";

const villages = ["Alni", "Dharashiv", "Dhoki", "Ter", "Yedsi"];

export function createDemoRegistration() {
  const random = crypto.getRandomValues(new Uint32Array(4));
  const category = CROP_CATEGORIES[random[0] % CROP_CATEGORIES.length];
  const serial = String(random[1] % 1_000_000).padStart(6, "0");
  const password = `Demo@${serial}`;

  return {
    name: `Demo Farmer ${serial}`,
    mobile: `9${String(random[1] % 1_000_000_000).padStart(9, "0")}`,
    date_of_birth: `${1970 + (random[2] % 30)}-${String(1 + (random[2] % 12)).padStart(2, "0")}-${String(1 + (random[3] % 28)).padStart(2, "0")}`,
    aadhar_no: `${String(100_000 + (random[2] % 900_000))}${String(100_000 + (random[3] % 900_000))}`,
    district: "dharashiv",
    taluka: "dharashiv",
    village: villages[random[3] % villages.length],
    income_source: INCOME_OPTIONS[random[0] % INCOME_OPTIONS.length],
    cluster_type: category.id,
    password,
    confirm_password: password,
    plots: [{
      plot_no: `DEMO-${serial}`,
      area_acres: String(1 + (random[2] % 20) / 2),
      crop_name: category.crops[random[3] % category.crops.length],
      irrigation_source: IRRIGATION_OPTIONS[random[3] % IRRIGATION_OPTIONS.length],
    }],
  };
}
