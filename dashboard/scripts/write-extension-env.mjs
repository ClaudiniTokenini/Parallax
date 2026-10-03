import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dashboardDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {};

for (const file of [".env.local", ".env"]) {
  const filePath = path.join(dashboardDir, file);
  if (!fs.existsSync(filePath)) continue;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cut = trimmed.indexOf("=");
    if (cut <= 0) continue;
    const key = trimmed.slice(0, cut).trim();
    let value = trimmed.slice(cut + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
}

const dashboardUrl = String(
  env.NEXT_PUBLIC_DASHBOARD_URL || env.DASHBOARD_PUBLIC_URL || "http://127.0.0.1:3000"
).replace(/\/$/, "");
const apiUrl = String(
  env.NEXT_PUBLIC_CLASSIFIER_URL || env.CLASSIFIER_PUBLIC_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const outPath = path.join(dashboardDir, "..", "chromeExtension", "env.js");
fs.writeFileSync(
  outPath,
  `var PARALLAX_ENV = {\n  dashboardUrl: ${JSON.stringify(dashboardUrl)},\n  apiUrl: ${JSON.stringify(apiUrl)}\n};\n`
);
console.log(`Extension env → ${dashboardUrl} / ${apiUrl}`);
