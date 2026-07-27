#!/usr/bin/env node
/**
 * Thorough homepage + chart regression test (auth required).
 * Usage: SMOKE_PASSWORD=... node scripts/homepage-test.mjs
 */

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const EMAIL = process.env.SMOKE_EMAIL || "shibayanbiswas@rathi.com";
const PASSWORD = process.env.SMOKE_PASSWORD || "";

const TIMEFRAMES = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y"];
const INDICES = [
  "nifty",
  "sensex",
  "banknifty",
  "midcap",
  "next50",
  "niftyit",
  "niftyauto",
  "niftyfmcg",
  "niftymetal",
  "niftypharma",
  "niftyenergy",
  "niftyfin",
  "vix",
];

let cookies = new Map();

function storeCookies(res) {
  const raw =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (value) cookies.set(name, value);
    else cookies.delete(name);
  }
}

function cookieHeader() {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader() ? { Cookie: cookieHeader() } : {}),
      ...options.headers,
    },
  });
  storeCookies(res);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json, cacheControl: res.headers.get("cache-control") || "" };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  console.log(`  ✗ ${msg}`);
}

async function login() {
  const login = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  assert(login.status === 200, `Login failed: ${login.status}`);
  const otp = login.json?.otp;
  assert(otp?.length === 6, "OTP missing");
  const verify = await req("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ code: otp }),
  });
  assert(verify.status === 200, `OTP verify failed: ${verify.status}`);
}

async function testDashboardPage() {
  const res = await fetch(`${BASE}/dashboard`, {
    headers: cookieHeader() ? { Cookie: cookieHeader() } : {},
  });
  assert(res.ok, `/dashboard failed: ${res.status}`);
  const html = await res.text();
  for (const needle of [
    "SP TERMINAL",
    "Good morning",
    "Indian market indices",
    "Structured Products",
  ]) {
    assert(html.includes(needle), `/dashboard missing "${needle}"`);
  }
  pass("Dashboard SSR includes greeting, tape header, terminal shell");
}

async function testMarkets() {
  const m1 = await req("/api/markets");
  assert(m1.status === 200, `Markets failed: ${m1.status}`);
  assert(m1.json?.quotes?.length === 13, `Expected 13 quotes, got ${m1.json?.quotes?.length}`);
  assert(/no-store/i.test(m1.cacheControl), "Markets must be uncached");

  let sparkOk = 0;
  let pctOk = 0;
  for (const q of m1.json.quotes) {
    assert(q.price != null, `${q.id} missing price`);
    assert(q.dayOpen != null && q.dayOpen > 0, `${q.id} missing dayOpen`);
    assert(Number.isFinite(q.changePercent), `${q.id} missing changePercent`);
    assert(Array.isArray(q.sparkline) && q.sparkline.length >= 2, `${q.id} sparkline too short`);

    const vsOpen = ((q.price - q.dayOpen) / q.dayOpen) * 100;
    if (Math.abs(vsOpen - q.changePercent) < 0.05) pctOk++;
    if (Math.abs(q.sparkline[0]) < 0.1) sparkOk++;
  }
  assert(pctOk === 13, `Only ${pctOk}/13 quotes match session-open %`);
  assert(sparkOk === 13, `Only ${sparkOk}/13 sparklines start at open (0%)`);
  pass(`Markets: 13 quotes, session-open % + spark anchor OK`);

  await new Promise((r) => setTimeout(r, 400));
  const m2 = await req("/api/markets");
  assert(m2.json?.asOf && m2.json.asOf !== m1.json.asOf, "Markets asOf should advance");
  pass(`Markets poll OK (${m1.json.asOf} → ${m2.json.asOf})`);
}

async function testChartVolumeAndIndicators() {
  for (const tf of TIMEFRAMES) {
    const off = await req(`/api/chart?indexId=nifty&timeframe=${tf}`);
    const bars = off.json?.bars ?? [];
    assert(bars.length > 0, `${tf}: no bars`);
    // Yahoo index feeds often ship volume=0; client derives activity from OHLC range.
    const plottable = bars.filter(
      (b) =>
        b.open != null &&
        b.high != null &&
        b.low != null &&
        b.close != null &&
        b.high >= b.low
    ).length;
    assert(plottable === bars.length, `${tf}: ${bars.length - plottable} bars missing OHLC for volume proxy`);
    pass(`${tf} OHLC complete for volume overlay (${bars.length} bars)`);
  }
}

async function testChartPeriodRefs() {
  const expected = {
    "1D": "day_open",
    "1W": "week_open",
    "1M": "month_open",
  };
  for (const [tf, basis] of Object.entries(expected)) {
    const r = await req(`/api/chart?indexId=nifty&timeframe=${tf}`);
    assert(r.json?.last?.basis === basis, `${tf} expected basis ${basis}, got ${r.json?.last?.basis}`);
    assert(Number.isFinite(r.json?.last?.changePercent), `${tf} missing changePercent`);
  }
  for (const tf of ["3M", "6M", "1Y", "5Y"]) {
    const r = await req(`/api/chart?indexId=nifty&timeframe=${tf}`);
    assert(r.json?.last?.basis === "lookback_open", `${tf} expected lookback_open`);
  }
  pass("Period reference bases correct for all TFs");
}

async function testChartsAllTimeframes() {
  for (const tf of TIMEFRAMES) {
    const off = await req(`/api/chart?indexId=nifty&timeframe=${tf}`);
    assert(off.status === 200, `${tf} Zoom Off failed: ${off.status}`);
    const offBars = off.json?.bars ?? [];
    assert(offBars.length > 0, `${tf} Zoom Off: no bars`);
    assert(off.json?.last?.price != null, `${tf} missing last price`);
    assert(off.json?.last?.reference != null, `${tf} missing period reference`);
    assert(Number.isFinite(off.json.last.changePercent), `${tf} missing changePercent`);
    assert(/no-store/i.test(off.cacheControl), `${tf} must be uncached`);

    const on = await req(`/api/chart?indexId=nifty&timeframe=${tf}&full=1`);
    assert(on.status === 200, `${tf} Zoom On failed: ${on.status}`);
    const onBars = on.json?.bars ?? [];
    assert(onBars.length >= offBars.length, `${tf} Zoom On (${onBars.length}) < Off (${offBars.length})`);

    pass(
      `${tf} Off ${offBars.length} bars · On ${onBars.length} · ${Number(off.json.last.changePercent).toFixed(2)}% (${off.json.last.basis})`
    );
  }
}

async function testChartIndices() {
  for (const id of INDICES) {
    const r = await req(`/api/chart?indexId=${id}&timeframe=1D`);
    assert(r.status === 200, `${id} 1D chart failed: ${r.status}`);
    assert(r.json?.bars?.length > 0, `${id} 1D: no bars`);
    assert(r.json?.last?.price != null, `${id} missing price`);
  }
  pass(`All ${INDICES.length} indices return 1D charts`);
}

async function testChartTapeSync() {
  const markets = await req("/api/markets");
  const niftyTape = markets.json.quotes.find((q) => q.id === "nifty");
  assert(niftyTape?.price != null, "Nifty tape price missing");
  const chart = await req("/api/chart?indexId=nifty&timeframe=1D");
  const chartPrice = chart.json?.last?.price;
  assert(chartPrice != null, "Nifty chart price missing");
  const diff = Math.abs(chartPrice - niftyTape.price);
  // Live session: tape and chart can be a few ticks apart between polls.
  assert(diff < 25, `Chart vs tape mismatch: chart ${chartPrice} vs tape ${niftyTape.price} (Δ ${diff.toFixed(2)})`);
  pass(`Chart synced with tape (Nifty chart ${chartPrice} · tape ${niftyTape.price} · Δ ${diff.toFixed(2)})`);
}

async function main() {
  console.log(`\nHomepage thorough test → ${BASE}\n`);
  if (!PASSWORD) {
    fail("SMOKE_PASSWORD required");
    process.exit(1);
  }

  const failures = [];
  const run = async (name, fn) => {
    try {
      await fn();
    } catch (e) {
      failures.push({ name, error: e instanceof Error ? e.message : String(e) });
      fail(`${name}: ${e instanceof Error ? e.message : e}`);
    }
  };

  await run("login", login);
  await run("dashboard page", testDashboardPage);
  await run("markets tape/snapshot API", testMarkets);
  await run("charts all timeframes", testChartsAllTimeframes);
  await run("chart volume bars", testChartVolumeAndIndicators);
  await run("chart period refs", testChartPeriodRefs);
  await run("charts all indices 1D", testChartIndices);
  await run("chart/tape price sync", testChartTapeSync);

  console.log("");
  if (failures.length === 0) {
    console.log("All homepage tests passed.\n");
    process.exit(0);
  } else {
    console.log(`${failures.length} test group(s) failed.\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
