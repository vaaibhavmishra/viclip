import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/_next/",
          "/private/",
          "*.json",
          "/sentry-example-page",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/api/", "/sentry-example-page"],
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: ["/api/", "/sentry-example-page"],
      },
    ],
    sitemap: "https://viclip.shipby.me/sitemap.xml",
    host: "https://viclip.shipby.me",
  };
}
