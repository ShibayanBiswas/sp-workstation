/**
 * Post-doc thorough verification against production + NSE.
 * Run: node scripts/verify-markets-docs.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || "https://sp-workstation.vercel.app";
const EMAIL = process.env.SMOKE_EMAIL || "shibayanbiswas@rathi.com";

function loadPassword() {
  if (process.env.SMOKE_PASSWORD) return process.env.SMOKE_PASSWORD;
  const p = resolve(__dirname, "seed-passwords.local.json");
  if (!existsSync(p)) throw new Error("Missing seed-passwords.local.json");
  return JSON.parse(readFileSync(p, "utf8"))[EMAIL];
}

const PASSWORD = loadPassword();
let jar = new Map();
let failed = 0;

function store(res) {
  for (const line of res.headers.getSetCookie?.() || []) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}
function cookie() {
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(cookie() ? { Cookie: cookie() } : {}),
      ...opts.headers,
    },
  });
  store(res);
  return { status: res.status, j: await res.json().catch(() => null) };
}
function assert(name, cond, detail) {
  if (!cond) {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`  ✓ ${name}`);
  }
}
function near(a, b, tol = 0.05) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

const NSE_NAMES = {
  nifty: "NIFTY 50",
  banknifty: "NIFTY BANK",
  midcap: "NIFTY MIDCAP 100",
  next50: "NIFTY NEXT 50",
  vix: "INDIA VIX",
};

async function fetchNse() {
  const res = await fetch("https://www.nseindia.com/api/allIndices", {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
      Referer: "https://www.nseindia.com",
    },
  });
  const j = await res.json();
  const map = new Map();
  for (const row of j.data || []) map.set(row.index, row);
  return map;
}

console.log(`\nVerify markets/docs → ${BASE}\n`);

const health = await req("/api/health");
assert("health ok", health.status === 200 && health.j?.ok === true);

const login = await req("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
assert("login", login.status === 200 && login.j?.otp?.length === 6);
const verify = await req("/api/auth/verify-otp", {
  method: "POST",
  body: JSON.stringify({ code: login.j.otp }),
});
assert("otp", verify.status === 200);

const markets = await req("/api/markets");
assert("markets 200", markets.status === 200);
assert("13 quotes", markets.j?.quotes?.length === 13);
assert(
  "marketStatus present",
  ["open", "pre-open", "closed", "weekend", "holiday"].includes(
    markets.j?.marketStatus
  )
);

const nse = await fetchNse();
assert("NSE allIndices reachable", nse.size > 0);

// Live prints move between our poll and NSE's allIndices scrape.
const liveTol = markets.j?.marketStatus === "open" ? 50 : 0.05;

for (const [id, name] of Object.entries(NSE_NAMES)) {
  const q = markets.j.quotes.find((x) => x.id === id);
  const row = nse.get(name);
  if (!q || !row) {
    assert(`${id} present`, false, `q=${!!q} nse=${!!row}`);
    continue;
  }
  assert(
    `${id} LTP`,
    near(q.price, row.last, liveTol),
    `${q.price} vs ${row.last}`
  );
  assert(
    `${id} prevClose`,
    near(q.previousClose, row.previousClose, 0.05),
    `${q.previousClose} vs ${row.previousClose}`
  );
  assert(
    `${id} open`,
    near(q.dayOpen, row.open, 0.05),
    `${q.dayOpen} vs ${row.open}`
  );
  const vsPrev = q.price - q.previousClose;
  assert(
    `${id} vsPrev`,
    near(vsPrev, row.variation, liveTol),
    `${vsPrev} vs ${row.variation}`
  );
  const vsOpen = q.price - q.dayOpen;
  assert(
    `${id} tape vsOpen matches change field`,
    near(vsOpen, q.change, 0.05),
    `${vsOpen} vs ${q.change}`
  );
}

const sensex = markets.j.quotes.find((q) => q.id === "sensex");
assert("sensex present", !!sensex);
assert("sensex source bse", sensex?.source === "bse");

const chart = await req("/api/chart?indexId=nifty&timeframe=1D");
assert("chart 200", chart.status === 200);
// Early in the cash session Zoom Off 1D may only have the forming 5m bar.
assert("chart bars", (chart.j?.bars?.length || 0) >= 1);
assert("chart basis day_open", chart.j?.last?.basis === "day_open");
const nifty = markets.j.quotes.find((q) => q.id === "nifty");
assert(
  "tape/chart open aligned",
  near(nifty.dayOpen, chart.j.last.dayOpen, 0.05),
  `${nifty.dayOpen} vs ${chart.j.last.dayOpen}`
);
assert(
  "tape/chart LTP aligned",
  near(nifty.price, chart.j.last.price, 0.05),
  `${nifty.price} vs ${chart.j.last.price}`
);
assert(
  "tape/chart vsOpen aligned",
  near(nifty.change, chart.j.last.change, 0.05),
  `${nifty.change} vs ${chart.j.last.change}`
);
assert(
  "chart prevClose matches tape",
  near(nifty.previousClose, chart.j.last.previousClose, 0.05)
);

for (const tf of ["1W", "1M", "3M"]) {
  const r = await req(`/api/chart?indexId=nifty&timeframe=${tf}`);
  assert(`${tf} chart`, r.status === 200 && r.j?.bars?.length > 0);
}

const pages = ["/login", "/otp", "/forgot-password", "/dashboard"];
for (const p of pages) {
  const res = await fetch(`${BASE}${p}`, {
    headers: cookie() ? { Cookie: cookie() } : {},
    redirect: "manual",
  });
  assert(
    `page ${p}`,
    res.status === 200 || res.status === 307 || res.status === 302,
    `status ${res.status}`
  );
}

await req("/api/auth/logout", { method: "POST" });

console.log(
  failed
    ? `\n${failed} check(s) failed\n`
    : "\nAll verification checks passed\n"
);
process.exit(failed ? 1 : 0);
