export const REGISTRATION_FEE_PAISE = 50_000;

export const DISTRICTS = [
  { value: "dharashiv", en: "Dharashiv", mr: "धाराशिव" },
  { value: "solapur", en: "Solapur", mr: "सोलापूर" },
  { value: "beed", en: "Beed", mr: "बीड" },
  { value: "sangli", en: "Sangli", mr: "सांगली" },
] as const;

export const TALUKAS = [
  ["dharashiv","dharashiv","Dharashiv","धाराशिव"],["tuljapur","dharashiv","Tuljapur","तुळजापूर"],["umarga","dharashiv","Umarga","उमरगा"],["lohara","dharashiv","Lohara","लोहारा"],["kalamb","dharashiv","Kalamb","कळंब"],["washi","dharashiv","Washi","वाशी"],["bhum","dharashiv","Bhum","भूम"],["paranda","dharashiv","Paranda","परांडा"],
  ["akkalkot","solapur","Akkalkot","अक्कलकोट"],["barshi","solapur","Barshi","बार्शी"],["karmala","solapur","Karmala","करमाळा"],["madha","solapur","Madha","माढा"],["malshiras","solapur","Malshiras","माळशिरस"],["mangalwedha","solapur","Mangalwedha","मंगळवेढा"],["mohol","solapur","Mohol","मोहोळ"],["pandharpur","solapur","Pandharpur","पंढरपूर"],["sangola","solapur","Sangola","सांगोला"],["solapur_north","solapur","North Solapur","सोलापूर उत्तर"],["solapur_south","solapur","South Solapur","सोलापूर दक्षिण"],
  ["beed","beed","Beed","बीड"],["ashti","beed","Ashti","आष्टी"],["patoda","beed","Patoda","पाटोदा"],["shirur_kasar","beed","Shirur Kasar","शिरूर कासार"],["georai","beed","Georai","गेवराई"],["ambajogai","beed","Ambajogai","अंबाजोगाई"],["wadwani","beed","Wadwani","वडवणी"],["kaij","beed","Kaij","केज"],["dharur","beed","Dharur","धारूर"],["parli_vaijnath","beed","Parli Vaijnath","परळी वैजनाथ"],["majalgaon","beed","Majalgaon","माजलगाव"],
  ["shirala","sangli","Shirala","शिराळा"],["walwa","sangli","Walwa","वाळवा"],["palus","sangli","Palus","पळूस"],["kadegaon","sangli","Kadegaon","कडेगाव"],["khanapur","sangli","Khanapur (Vita)","खानापूर"],["atpadi","sangli","Atpadi","आटपाडी"],["tasgaon","sangli","Tasgaon","तासगाव"],["miraj","sangli","Miraj","मिरज"],["kavathemahankal","sangli","Kavathe-Mahankal","कवठे महांकाळ"],["jat","sangli","Jat","जत"],
] as const;

export const INCOME_OPTIONS = ["agriculture","business","job","other"] as const;
export const CLUSTER_OPTIONS = ["pulses","cereals","cash","fruits","vegs","allied"] as const;
export const IRRIGATION_OPTIONS = ["well","borewell","canal","drip","sprinkler","rainfed","river","other"] as const;

export function formatRupees(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}
