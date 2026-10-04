import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url.mjs";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/admin" },
    sitemap: new URL("/sitemap.xml", siteUrl()).href,
  };
}
