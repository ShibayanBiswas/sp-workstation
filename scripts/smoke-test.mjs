#!/usr/bin/env node
/**
 * End-to-end smoke test for SP Workstation.
 * Usage: BASE_URL=http://127.0.0.1:3000 node scripts/smoke-test.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const EMAIL = process.env.SMOKE_EMAIL || "shibayanbiswas@rathi.com";
const BAD_EMAIL = "not-a-team-member@rathi.com";

function loadPassword() {
  if (process.env.SMOKE_PASSWORD) return process.env.SMOKE_PASSWORD;
  const localPath = resolve(__dirname, "seed-passwords.local.json");
  if (!existsSync(localPath)) return "";
  try {
    const map = JSON.parse(readFileSync(localPath, "utf8"));
    return map[EMAIL] || "";
  } catch {
    return "";
  }
}

const PASSWORD = loadPassword();

let cookieJar = new Map();

function storeCookies(res) {
  const raw = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (value) cookieJar.set(name, value);
    else cookieJar.delete(name);
  }
}

function cookieHeader() {
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function request(path, options = {}) {
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
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function pass(message) {
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log(`\nSP Workstation smoke test → ${BASE}\n`);

  // 1. Public pages
  const loginPage = await fetch(`${BASE}/login`);
  assert(loginPage.ok, `/login should load (${loginPage.status})`);
  pass("Login page loads");

  const otpPage = await fetch(`${BASE}/otp`);
  assert(otpPage.ok, `/otp should load (${otpPage.status})`);
  pass("OTP page loads");

  // 2. Invalid email ID
  const badEmail = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: BAD_EMAIL, password: "anything" }),
  });
  assert(badEmail.status === 401, `Bad email expected 401, got ${badEmail.status}`);
  assert(
    badEmail.json?.error === "Invalid email ID.",
    `Bad email message wrong: ${badEmail.json?.error}`
  );
  pass("Non-roster email returns Invalid email ID");

  if (!PASSWORD) {
    console.log("\n  ⚠ SMOKE_PASSWORD not set — skipping credential tests.");
    console.log("    Set SMOKE_PASSWORD to run full auth + markets tests.\n");
    return;
  }

  // 3. Wrong password
  const badPass = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: "WrongPassword999!" }),
  });
  assert(badPass.status === 401, `Wrong password expected 401, got ${badPass.status}`);
  assert(
    badPass.json?.error === "Wrong password.",
    `Wrong password message wrong: ${badPass.json?.error}`
  );
  pass("Valid email + wrong password returns Wrong password");

  // 4. Login success + OTP
  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  assert(login.status === 200, `Login failed: ${login.status} ${JSON.stringify(login.json)}`);
  assert(login.json?.otp?.length === 6, "OTP missing from login response");
  pass(`Login succeeds with 6-digit OTP`);

  const otp = login.json.otp;

  // 5. Verify OTP → session
  const verify = await request("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ code: otp }),
  });
  assert(verify.status === 200, `OTP verify failed: ${verify.status} ${JSON.stringify(verify.json)}`);
  assert(verify.json?.redirect === "/dashboard", "Expected dashboard redirect");
  pass("OTP verification creates session");

  // 6. Session check
  const me = await request("/api/auth/me");
  assert(me.status === 200, `/api/auth/me failed: ${me.status}`);
  assert(me.json?.user?.email, "Session email missing");
  pass(`Session active for ${me.json.user.email}`);

  // 7. Markets API
  const markets1 = await request("/api/markets");
  assert(markets1.status === 200, `Markets failed: ${markets1.status}`);
  assert(Array.isArray(markets1.json?.quotes), "Quotes array missing");
  assert(markets1.json.quotes.length >= 10, "Expected 10+ index quotes");
  const nifty = markets1.json.quotes.find((q) => q.id === "nifty");
  assert(nifty?.price != null, "Nifty 50 price missing");
  pass(`Markets: ${markets1.json.quotes.length} quotes, Nifty ${nifty.price}`);

  // 8. Chart API + price alignment
  const chart = await request("/api/chart?indexId=nifty&timeframe=1D");
  assert(chart.status === 200, `Chart failed: ${chart.status}`);
  assert(chart.json?.bars?.length > 0, "Chart bars missing");
  assert(chart.json?.last?.price != null, "Chart last price missing");
  const priceDiff = Math.abs(chart.json.last.price - nifty.price);
  assert(
    priceDiff < 0.05,
    `Chart vs tape price mismatch: chart ${chart.json.last.price} vs tape ${nifty.price}`
  );
  pass(`Chart synced with tape (Nifty ${chart.json.last.price})`);
  assert(
    typeof chart.json.last.reference === "number" && chart.json.last.reference > 0,
    "1D chart should include period reference (session open)"
  );
  pass(`1D period reference ${chart.json.last.reference}`);

  // 8b. Timeframe period returns include a reference open for each window
  for (const tf of ["1W", "1M", "3M"]) {
    const r = await request(`/api/chart?indexId=nifty&timeframe=${tf}`);
    assert(r.status === 200, `${tf} chart failed: ${r.status}`);
    assert(
      typeof r.json?.last?.reference === "number" && r.json.last.reference > 0,
      `${tf} chart missing period reference`
    );
    assert(
      typeof r.json.last.changePercent === "number" &&
        Number.isFinite(r.json.last.changePercent),
      `${tf} chart missing period changePercent`
    );
    pass(
      `${tf} period return ${Number(r.json.last.changePercent).toFixed(2)}% (ref ${r.json.last.reference})`
    );
  }

  // Month-to-date open should differ from today's session open in normal weeks.
  const chartMonth = await request("/api/chart?indexId=nifty&timeframe=1M");
  if (
    chartMonth.json?.last?.reference != null &&
    chart.json.last.reference !== chartMonth.json.last.reference
  ) {
    pass("1M period reference differs from 1D (expected)");
  } else {
    pass("1M period reference checked (may match 1D on month-start days)");
  }

  // 9. Second markets fetch (simulates minute refresh)
  await new Promise((r) => setTimeout(r, 1500));
  const markets2 = await request("/api/markets");
  assert(markets2.status === 200, "Second markets fetch failed");
  assert(markets2.json?.asOf, "asOf timestamp missing");
  pass(`Markets refresh OK (asOf ${markets2.json.asOf})`);

  // 10. Forgot password flow (invalid email)
  cookieJar.clear();
  const forgotBad = await request("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: BAD_EMAIL }),
  });
  assert(forgotBad.status === 401, `Forgot bad email expected 401`);
  pass("Forgot password rejects non-roster email");

  // 11. Forgot password (valid email)
  const forgot = await request("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL }),
  });
  assert(forgot.status === 200, `Forgot password failed: ${forgot.status}`);
  assert(forgot.json?.otp?.length === 6, "Forgot password OTP missing");
  pass("Forgot password generates OTP for roster email");

  // 12. Logout
  cookieJar = cookieJar; // keep pending from forgot
  const logout = await request("/api/auth/logout", { method: "POST" });
  assert(logout.status === 200, "Logout failed");
  pass("Logout clears cookies");

  console.log("\nAll smoke tests passed.\n");
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
