import type { Metadata } from "next";
import { Noto_Sans_Devanagari, Poppins } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans_Devanagari({
  variable: "--font-noto-sans",
  subsets: ["devanagari", "latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.ganpatiagro.in"),
  title: "गणपती ॲग्रो प्रोड्युसर कंपनी लि. | Ganpati Agro Producer Co. Ltd.",
  description:
    "गणपती ॲग्रो प्रोड्युसर कंपनी — २०१६ पासून बळीराजाच्या सेवेत. शेतकरी समूह शेती, मूल्यवर्धन व बाजार जोडणी. Farmer-centric cluster agriculture in Dharashiv, Maharashtra.",
  openGraph: {
    title: "गणपती ॲग्रो प्रोड्युसर कंपनी | Ganpati Agro",
    description: "२०१६ पासून बळीराजाच्या सेवेत. शेतकरी समूह शेती, मूल्यवर्धन, बाजार जोडणी.",
    type: "website",
    images: [{ url: "/logo-icon.png" }],
  },
  icons: { icon: "/logo-icon.png" },
  other: { google: "notranslate" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="mr"
      className={`${notoSans.variable} ${poppins.variable} notranslate`}
      translate="no"
    >
      <body>
        <a className="skip-link" href="#main">
          मुख्य सामग्रीकडे जा / Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
