/**
 * Edge-case checks for tradingSessionBars / sessionSparkPath.
 * Run: npx tsx scripts/check-session-day.ts
 */
import {
  formatIstDateTime,
  istDateString,
  tradingSessionBars,
} from "../src/lib/chart-ist";
import { sessionSparkPath, type OhlcBar } from "../src/lib/yahoo-ohlc";

function bar(istLocal: string, open: number, close = open): OhlcBar {
  // istLocal: "2026-07-23T09:15:00"
  const time = Math.floor(new Date(`${istLocal}+05:30`).getTime() / 1000);
  return {
    time,
    open,
    high: Math.max(open, close),
    low: Math.min(open, close),
    close,
    volume: 0,
  };
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function firstStamp(bars: OhlcBar[]) {
  return formatIstDateTime(bars[0]!.time, "time");
}

function daysIn(bars: OhlcBar[]) {
  return [...new Set(bars.map((b) => istDateString(b.time)))];
}

const wed = [
  bar("2026-07-22T09:15:00", 100),
  bar("2026-07-22T10:15:00", 101),
  bar("2026-07-22T15:25:00", 102),
];
const thu = [
  bar("2026-07-23T09:15:00", 103),
  bar("2026-07-23T10:15:00", 104),
  bar("2026-07-23T15:25:00", 105),
];
const friOpen = [bar("2026-07-24T09:15:00", 106, 107)];
const friMid = [
  ...friOpen,
  bar("2026-07-24T09:20:00", 107, 108),
  bar("2026-07-24T09:25:00", 108, 109),
];

const all = [...wed, ...thu, ...friMid];

// Live Friday morning with only 1 bar — must NOT pull Thursday.
{
  const now = new Date("2026-07-24T09:17:00+05:30");
  const session = tradingSessionBars([...wed, ...thu, ...friOpen], { now });
  assert(daysIn(session).length === 1, "early open: single day");
  assert(daysIn(session)[0] === "2026-07-24", "early open: today");
  assert(firstStamp(session).includes("09:15"), `early open starts 09:15 got ${firstStamp(session)}`);
  const spark = sessionSparkPath([...wed, ...thu, ...friOpen], 96, { now });
  assert(spark && spark.sessionOpen === 106, "spark open is today's open");
  assert(spark!.prices.length >= 2, "spark has open+close even with 1 bar");
}

// Mid-session Friday — full today only.
{
  const now = new Date("2026-07-24T11:00:00+05:30");
  const session = tradingSessionBars(all, { now });
  assert(daysIn(session).join() === "2026-07-24", "mid-session today only");
  assert(firstStamp(session).includes("09:15"), "mid-session from open");
}

// After cash close Friday — still Friday session from open.
{
  const now = new Date("2026-07-24T18:00:00+05:30");
  const session = tradingSessionBars(all, { now });
  assert(daysIn(session).join() === "2026-07-24", "after close: Friday");
  assert(firstStamp(session).includes("09:15"), "after close from open");
}

// Saturday — last completed Friday (no Sat bars).
{
  const now = new Date("2026-07-25T12:00:00+05:30");
  const session = tradingSessionBars(all, { now });
  assert(daysIn(session).join() === "2026-07-24", "weekend → last Friday");
  assert(firstStamp(session).includes("09:15"), "weekend from Friday open");
}

// Monday pre-open holiday-style (no Monday bars yet) → last Friday.
{
  const now = new Date("2026-07-27T08:00:00+05:30");
  const session = tradingSessionBars(all, { now });
  assert(daysIn(session).join() === "2026-07-24", "pre-open / holiday → last session");
}

// FX: IST calendar day, including overnight prints before cash open.
{
  const fx = [
    bar("2026-07-23T18:00:00", 96.4),
    bar("2026-07-24T00:20:00", 96.5),
    bar("2026-07-24T09:15:00", 96.55),
  ];
  const now = new Date("2026-07-24T09:17:00+05:30");
  const session = tradingSessionBars(fx, { fx: true, now });
  assert(daysIn(session).join() === "2026-07-24", "FX today IST only");
  assert(firstStamp(session).includes("00:20"), `FX from first IST print got ${firstStamp(session)}`);
}

// Never starts at 10:15 when 09:15 exists.
{
  const now = new Date("2026-07-23T14:00:00+05:30");
  const session = tradingSessionBars([...wed, ...thu], { now });
  assert(firstStamp(session).includes("09:15"), "must not start at 10:15");
  assert(!firstStamp(session).includes("10:15"), "first stamp is not 10:15");
}

console.log("ok — trading session day boundaries");
