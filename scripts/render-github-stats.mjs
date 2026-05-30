import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [, , rendererDir, outputPath] = process.argv;

if (!rendererDir || !outputPath) {
  throw new Error("usage: node scripts/render-github-stats.mjs <renderer-dir> <output-path>");
}

process.chdir(rendererDir);
process.env.PAT_1 ||= process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

if (process.env.CARD_AS_OF) {
  const statsFetcherPath = path.join(rendererDir, "src/fetchers/stats.js");
  let statsFetcher = await fs.readFile(statsFetcherPath, "utf8");

  const replaceOnce = (source, needle, replacement) => {
    if (!source.includes(needle)) {
      throw new Error(`could not patch github-readme-stats: ${needle}`);
    }
    return source.replace(needle, replacement);
  };

  statsFetcher = replaceOnce(
    statsFetcher,
    "$startTime: DateTime = null) {",
    "$startTime: DateTime = null, $endTime: DateTime = null) {",
  );
  statsFetcher = replaceOnce(
    statsFetcher,
    "commits: contributionsCollection (from: $startTime) {",
    "commits: contributionsCollection (from: $startTime, to: $endTime) {",
  );
  statsFetcher = replaceOnce(
    statsFetcher,
    "reviews: contributionsCollection {",
    "reviews: contributionsCollection (to: $endTime) {",
  );
  statsFetcher = replaceOnce(
    statsFetcher,
    "      startTime,\n    };",
    "      startTime,\n      endTime: process.env.CARD_AS_OF,\n    };",
  );

  await fs.writeFile(statsFetcherPath, statsFetcher);
}

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
