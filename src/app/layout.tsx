import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "@fontsource/noto-sans-devanagari/700.css";
import "@fontsource/noto-sans-devanagari/800.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./globals.css";
import "./marketing.css";
import "./legacy-form.css";
import "./operations.css";
import "./typography.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: "Shri Ganpati Agro", template: "%s | Shri Ganpati Agro" },
  description: "Growing Farmers. Building Futures. Farmer registration, membership, and trusted agricultural networks.",
  icons: { icon: "/brand/logo-icon.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="mr" translate="no"><body>{children}</body></html>;
}
