import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [, , rendererDir, outputPath] = process.argv;

if (!rendererDir || !outputPath) {
  throw new Error("usage: node scripts/render-github-stats.mjs <renderer-dir> <output-path>");
}

process.chdir(rendererDir);
process.env.PAT_1 ||= process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const { default: renderStats } = await import(
  pathToFileURL(path.join(rendererDir, "api/index.js"))
);

let body = "";
const headers = new Map();
const res = {
  setHeader(name, value) {
    headers.set(name.toLowerCase(), value);
  },
  send(value) {
    body = String(value);
    return value;
  },
};

await renderStats(
  {
    query: {
      username: "KentoNishi",
      show_icons: "true",
      theme: "dark",
      hide_border: "true",
      cache_seconds: "300",
    },
  },
  res,
);

if (!headers.get("content-type")?.includes("image/svg+xml")) {
  throw new Error("github-readme-stats did not render an SVG response");
}

if (!body.includes("<svg") || body.includes("Something went wrong")) {
  throw new Error("github-readme-stats rendered an error card");
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, body);
