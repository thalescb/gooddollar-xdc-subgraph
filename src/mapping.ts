import { BigInt } from "@graphprotocol/graph-ts";
import { UBIClaimed, UBICalculated } from "../generated/UBIScheme/UBIScheme";
import { Claim, User, UserDay, DailyClaimStat, GlobalTotals } from "../generated/schema";

// --- time helpers (UTC) ---
function epochDay(ts: BigInt): i64 { return ts.toI64() / 86400; }

function dayIdOf(ts: BigInt): string { return epochDay(ts).toString(); }

// Kept simple: emit numeric epoch-day string; format to calendar in BI tool
function dayISOOf(ts: BigInt): string { return epochDay(ts).toString(); }

function dayStartTs(ts: BigInt): BigInt {
  let s = ts.toI64();
  let d = (s / 86400) * 86400;
  return BigInt.fromI64(d);
}

// --- loaders/creators ---
function getOrCreateGlobal(): GlobalTotals {
  let g = GlobalTotals.load("global");
  if (g == null) {
    g = new GlobalTotals("global");
    g.totalClaims = BigInt.zero();
    g.totalDistributed = BigInt.zero();
    g.totalUniqueUsers = BigInt.zero();
    g.save();
  }
  return g as GlobalTotals;
}

function getOrCreateDaily(dayId: string, dayISO: string, dayStart: BigInt): DailyClaimStat {
  let d = DailyClaimStat.load(dayId);
  if (d == null) {
    d = new DailyClaimStat(dayId);
    d.dayISO = dayISO;
    d.dayStart = dayStart;
    d.claimCount = BigInt.zero();
    d.dailyUniqueClaimers = BigInt.zero();
    d.newUsers = BigInt.zero();
    d.amountSum = BigInt.zero();
    d.cumulativeClaims = BigInt.zero();
    d.cumulativeDistributed = BigInt.zero();
    d.cumulativeUniqueUsers = BigInt.zero();
    d.dailyUbi = null;
    d.save();
  }
  return d as DailyClaimStat;
}

// --- handlers ---
export function handleUBIClaimed(event: UBIClaimed): void {
  const ts = event.block.timestamp;
  const dayId = dayIdOf(ts);
  const dayISO = dayISOOf(ts);
  const dayStart = dayStartTs(ts);

  // 1) Raw claim
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let c = new Claim(id);
  c.claimer = event.params.claimer;
  c.amount = event.params.amount;
  c.blockNumber = event.block.number;
  c.timestamp = ts;
  c.txHash = event.transaction.hash;
  c.dayId = dayId;
  c.dayISO = dayISO;
  c.save();

  // 2) User upsert
  let user = User.load(event.params.claimer);
  let isNewUser = false;
  if (user == null) {
    user = new User(event.params.claimer);
    user.firstClaimDay = dayISO;
    user.lastClaimTimestamp = ts;
    user.totalClaims = BigInt.fromI32(1);
    user.totalClaimedAmount = event.params.amount;
    isNewUser = true;
  } else {
    user.lastClaimTimestamp = ts;
    user.totalClaims = user.totalClaims.plus(BigInt.fromI32(1));
    user.totalClaimedAmount = user.totalClaimedAmount.plus(event.params.amount);
  }
  user.save();

  // 3) UserDay (drives daily uniques & rolling windows in BI)
  const userDayId = dayId + "-" + event.params.claimer.toHex();
  let ud = UserDay.load(userDayId);
  let isNewDailyClaimer = false;
  if (ud == null) {
    ud = new UserDay(userDayId);
    ud.dayId = dayId;
    ud.dayISO = dayISO;
    ud.user = event.params.claimer;
    ud.amount = BigInt.zero();
    isNewDailyClaimer = true;
  }
  ud.amount = ud.amount.plus(event.params.amount);
  ud.save();

  // 4) Daily rollup
  let d = getOrCreateDaily(dayId, dayISO, dayStart);
  d.claimCount = d.claimCount.plus(BigInt.fromI32(1));
  if (isNewDailyClaimer) d.dailyUniqueClaimers = d.dailyUniqueClaimers.plus(BigInt.fromI32(1));
  if (isNewUser) d.newUsers = d.newUsers.plus(BigInt.fromI32(1));
  d.amountSum = d.amountSum.plus(event.params.amount);

  // 5) Global totals (for cumulatives)
  let g = getOrCreateGlobal();
  g.totalClaims = g.totalClaims.plus(BigInt.fromI32(1));
  g.totalDistributed = g.totalDistributed.plus(event.params.amount);
  if (isNewUser) g.totalUniqueUsers = g.totalUniqueUsers.plus(BigInt.fromI32(1));
  g.save();

  // Copy cumulatives to the day snapshot
  d.cumulativeClaims = g.totalClaims;
  d.cumulativeDistributed = g.totalDistributed;
  d.cumulativeUniqueUsers = g.totalUniqueUsers;
  d.save();
}

export function handleUBICalculated(event: UBICalculated): void {
  const ts = event.block.timestamp;
  const dayId = dayIdOf(ts);
  const dayISO = dayISOOf(ts);
  const dayStart = dayStartTs(ts);

  let d = getOrCreateDaily(dayId, dayISO, dayStart);
  d.dailyUbi = event.params.dailyUbi; // per-user quota for that day
  d.save();
}
