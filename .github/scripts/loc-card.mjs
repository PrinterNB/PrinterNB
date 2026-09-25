// Generates loc-card.svg: total estimated lines of code across all public repos
// for the repo owner. Logic ported from InsideEmpire/readme-LineCounter (estimates
// lines from the GitHub language-bytes API). Runs in GitHub Actions and locally.
import { readFileSync, writeFileSync } from "node:fs";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.LOC_CARD_OWNER || "PrinterNB";
const REPOSITORY = process.env.GITHUB_REPOSITORY || `${OWNER}/${OWNER}`;
const API = "https://api.github.com";

const headers = { "Accept": "application/vnd.github+json", "User-Agent": "loc-card" };
if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

async function api(path) {
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res;
}

async function getRepos() {
  const repos = [];
  for (let page = 1; ; page++) {
    const r = await api(`/users/${OWNER}/repos?per_page=100&page=${page}`);
    const batch = await r.json();
    if (!batch.length) break;
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos;
}

// Same avg-bytes-per-line table as readme-LineCounter/src/eval.py
const BYTES_PER_LINE = {
  Python: 60, JavaScript: 60, TypeScript: 60, Java: 100, C: 100, "C++": 100, "C#": 90,
  Go: 90, Rust: 85, Swift: 95, Kotlin: 95, PHP: 70, Ruby: 65, Perl: 75, Lua: 50,
  HTML: 50, CSS: 50, XML: 50, Markdown: 40, YAML: 45, JSON: 50, TOML: 50,
  Shell: 55, PowerShell: 60, Batch: 50, SQL: 70, "PL/SQL": 80,
  Assembly: 30, VHDL: 40, Verilog: 40,
  Haskell: 75, Lisp: 60, Scheme: 55, Clojure: 65, "F#": 80, Erlang: 85, Elixir: 80,
  R: 65, Matlab: 75, Octave: 75, Dart: 80, Scala: 90, "Objective-C": 90,
  GDScript: 55, Pawn: 50, ActionScript: 60,
};
const estimateLines = (bytes, lang) => bytes / (BYTES_PER_LINE[lang] ?? 80);

async function main() {
  const repos = await getRepos();
  let total = 0;
  for (const repo of repos) {
    try {
      const r = await api(`/repos/${OWNER}/${repo.name}/languages`);
      const langs = await r.json();
      total += Object.entries(langs).reduce((sum, [lang, bytes]) => sum + estimateLines(bytes, lang), 0);
    } catch {
      // Rate limit or transient error on one repo: skip it, keep the total.
    }
  }
  const value = Math.round(total).toLocaleString("en-US");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="auto" viewBox="0 0 900 210" role="img" preserveAspectRatio="xMidYMid meet">
    <rect width="100%" height="100%" fill="#1a1b27" rx="10"/>
    <text x="3%" y="24%" fill="#c0caf5" font-size="24" font-family="Segoe UI, Ubuntu, Sans-Serif" text-anchor="start" font-weight="bold">
        LINES OF CODE
    </text>
    <text x="3%" y="60%" fill="#70a5fd" font-size="72" font-weight="bold" font-family="Segoe UI, Ubuntu, Sans-Serif" text-anchor="start">
        ${value}
    </text>
    <text x="3%" y="85%" fill="#565f89" font-size="24" font-family="Segoe UI, Ubuntu, Sans-Serif" text-anchor="start">
        across all public repositories
    </text>
</svg>
`;
  writeFileSync("loc-card.svg", svg);
  const readme = readFileSync("README.md", "utf8");
  const locCardUrl = `https://raw.githubusercontent.com/${REPOSITORY}/main/loc-card.svg`;
  const refreshedReadme = readme.replace(
    /https:\/\/raw\.githubusercontent\.com\/[^"\s]+\/loc-card\.svg(?:\?v=\d+)?/,
    `${locCardUrl}?v=${Date.now()}`
  );
  writeFileSync("README.md", refreshedReadme);
  console.log(`Wrote loc-card.svg with total ${value}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
