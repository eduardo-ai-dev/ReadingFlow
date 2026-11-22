import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      isProd
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://covers.openlibrary.org https://archive.org https://*.archive.org https://books.google.com https://books.googleusercontent.com https://brasilapi.com.br https://api.mercadoeditorial.org https://mercadoeditorial.org https://m.media-amazon.com https://images-na.ssl-images-amazon.com https://http2.mlstatic.com https://hardcover.app https://*.hardcover.app https://storage.googleapis.com https://*.mzstatic.com",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  images: {
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    qualities: [75, 85],
    minimumCacheTTL: 31536000,
    deviceSizes: [640, 828, 1080, 1280, 1920, 2560, 3840],
    imageSizes: [48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "books.googleusercontent.com" },
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "https", hostname: "archive.org" },
      { protocol: "https", hostname: "*.archive.org" },
      { protocol: "https", hostname: "brasilapi.com.br" },
      { protocol: "https", hostname: "api.mercadoeditorial.org" },
      { protocol: "https", hostname: "mercadoeditorial.org" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com" },
      { protocol: "https", hostname: "http2.mlstatic.com" },
      { protocol: "https", hostname: "hardcover.app" },
      { protocol: "https", hostname: "*.hardcover.app" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "*.mzstatic.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
