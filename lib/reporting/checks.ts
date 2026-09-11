/**
 * Dependency-free assertions for the pure reporting logic — the mapping layer
 * especially, since Google and Meta rows never arrive matching and a silent
 * mis-map corrupts every downstream number.
 *
 *   npm run check:reporting
 */
import assert from "node:assert/strict";
import { mapRow, toNumber, toDate } from "./mappers";
import { evaluateFormula } from "./formula";
import { parsePeriod, previousPeriod, latestClosedPeriod, isPeriodKey } from "./periods";
import { formatMetric, computeDelta } from "./format";

// --- mappers: Google Ads, as Supermetrics labels its columns ---------------
const g = mapRow("google_ads", {
  Date: "2026-08-14",
  Campaign: "Brand — Exact",
  "Cost (USD)": "1,234.56",
  Impressions: "45,000",
  Clicks: "1,020",
  Conversions: "37.5",
  "Search impr. share": "0.62",
});
assert.equal(g.date, "2026-08-14");
assert.equal(g.campaign, "Brand — Exact");
assert.equal(g.spend, 1234.56);
assert.equal(g.impressions, 45000);
assert.equal(g.clicks, 1020);
assert.equal(g.conversions, 37.5);
assert.equal(g.metrics.search_impr_share, 0.62);

// --- mappers: Meta, different names, actions array, link clicks ------------
const m = mapRow("meta_ads", {
  date_start: "08/14/2026",
  campaign_name: "Prospecting — Broad",
  "Amount spent (USD)": "980.00",
  impressions: 210000,
  clicks: 5000,            // all clicks — must NOT win over link clicks
  inline_link_clicks: 3100,
  actions: [
    { action_type: "lead", value: "22" },
    { action_type: "post_engagement", value: "900" },
    { action_type: "purchase", value: 3 },
  ],
  video_views: 812,
});
assert.equal(m.date, "2026-08-14");
assert.equal(m.spend, 980);
assert.equal(m.clicks, 3100, "prefers link clicks over all clicks");
assert.equal(m.conversions, 25, "sums only the action types that count");
assert.equal(m.metrics.video_views, 812);
assert.equal(m.metrics.clicks, undefined, "consumed columns stay out of jsonb");

// actions delivered as a JSON string (Supermetrics does this too)
assert.equal(
  mapRow("meta_ads", { date: "20260814", campaign: "x", actions: '[{"action_type":"lead","value":"4"}]' }).conversions,
  4
);

// date + number parsing edge cases
assert.equal(toDate("20260101", "t"), "2026-01-01");
assert.equal(toDate("1/9/2026", "t"), "2026-01-09");
assert.equal(toNumber("$1,000.50"), 1000.5);
assert.equal(toNumber("n/a"), 0);

// --- formula evaluation ----------------------------------------------------
const totals = { spend: 100, impressions: 1000, clicks: 50, conversions: 4 };
assert.equal(evaluateFormula("spend / conversions", totals), 25);
assert.equal(evaluateFormula("clicks / impressions", totals), 0.05);
assert.equal(evaluateFormula("(spend + 20) / clicks", totals), 2.4);
assert.equal(evaluateFormula("spend / conversions", { ...totals, conversions: 0 }), null, "divide by zero → null");
assert.throws(() => evaluateFormula("process.exit(1)", totals), /Unknown metric/);
assert.throws(() => evaluateFormula("spend / (clicks", totals), /Unbalanced/);

// --- periods ---------------------------------------------------------------
const p = parsePeriod("2026-08");
assert.equal(p.start, "2026-08-01");
assert.equal(p.end, "2026-08-31");
assert.equal(p.label, "August 2026");
assert.equal(previousPeriod(p).key, "2026-07");
assert.equal(previousPeriod(parsePeriod("2026-01")).key, "2025-12");
assert.equal(parsePeriod("2024-02").end, "2024-02-29", "leap year");
assert.equal(latestClosedPeriod(new Date("2026-09-11T00:00:00Z")).key, "2026-08");
assert.equal(isPeriodKey("2026-13"), false);

// --- formatting + deltas ---------------------------------------------------
assert.equal(formatMetric(null, "money"), "—");
assert.equal(formatMetric(0.0512, "percent"), "5.12%");
assert.equal(computeDelta(80, 100, true).tone, "positive", "CPA down is good");
assert.equal(computeDelta(80, 100, false).tone, "negative");
assert.equal(computeDelta(80, null).label, "—");

console.log("all reporting logic checks passed");
