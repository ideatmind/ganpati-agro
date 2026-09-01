/** Shared domain constants used by the public registration form and admin tools. */
export const TALUKA_OPTIONS = [
  { value: "dharashiv", label: "Dharashiv", labelMr: "धाराशिव" },
  { value: "tuljapur", label: "Tuljapur", labelMr: "तुळजापूर" },
  { value: "umarga", label: "Umarga", labelMr: "उमरगा" },
  { value: "lohara", label: "Lohara", labelMr: "लोहारा" },
  { value: "kalamb", label: "Kalamb", labelMr: "कळंब" },
  { value: "washi", label: "Washi", labelMr: "वाशी" },
  { value: "bhum", label: "Bhum", labelMr: "भूम" },
  { value: "paranda", label: "Paranda", labelMr: "परंडा" },
  { value: "other", label: "Other", labelMr: "इतर" },
] as const;

export const TALUKA_VALUES: readonly string[] = TALUKA_OPTIONS.map(
  (option) => option.value
);

export const TALUKA_LABELS: Record<string, string> = Object.fromEntries(
  TALUKA_OPTIONS.map((option) => [option.value, option.label])
);

export const ADMIN_TALUKA_OPTIONS = [
  { value: "", label: "All Talukas" },
  ...TALUKA_OPTIONS,
] as const;
