import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  async redirects() {
    return [
      { source: "/:path*", has: [{ type: "host", value: "www.ganpatiagro.in" }], destination: "https://ganpatiagro.in/:path*", permanent: true },
      { source: "/admin", destination: "/dashboard/admin", permanent: false },
    ];
  },
  async headers() {
    const scriptSrc = ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com", ...(isDev ? ["'unsafe-eval'"] : [])];
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: [
          "default-src 'self'",
          `script-src ${scriptSrc.join(" ")}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "media-src 'self'",
          "connect-src 'self' https://api.razorpay.com",
          "frame-src https://api.razorpay.com https://*.razorpay.com",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; ") },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        ...(!isDev ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
      ],
    }, { source: "/receipt/:path*", headers: [{key:"X-Robots-Tag",value:"noindex, nofollow, noarchive"},{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}] },
    { source: "/dashboard/:path*", headers: [{key:"X-Robots-Tag",value:"noindex, nofollow, noarchive"}] }];
  },
};

export default nextConfig;
