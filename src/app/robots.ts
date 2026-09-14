import type { MetadataRoute } from "next";
export default function robots():MetadataRoute.Robots {
  const origin=process.env.NEXT_PUBLIC_APP_URL;
  return { rules:{userAgent:"*",allow:"/",disallow:["/api/","/dashboard/","/receipt/","/login"]}, ...(origin?{sitemap:new URL('/sitemap.xml',origin).href}:{}) };
}
