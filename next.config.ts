import fs from "node:fs";
import path from "node:path";

import type { NextConfig } from "next";

/**
 * Dev-only local secret loading.
 *
 * The Clocked key lives in `.secrets.local`, NOT in a `.env*` file: the Workers
 * build reads every `.env*` variant and bakes the values into
 * `.open-next/cloudflare/next-env.mjs`, which ships inside the deployed bundle
 * and shadows the Sites Secret. Keeping the key out of `.env*` means the
 * deployed Worker reads it only from its Secret.
 *
 * `next dev` sets NODE_ENV=development before loading this config, so this
 * branch never runs during `next build` / deploy.
 */
if (process.env.NODE_ENV === "development") {
  const file = path.join(process.cwd(), ".secrets.local");
  if (fs.existsSync(file)) {
    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
