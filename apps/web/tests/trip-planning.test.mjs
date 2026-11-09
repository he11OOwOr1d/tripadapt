import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyTrip,
  mockTripAdapter,
  mockSampleAdapter,
  sampleTrip,
} from "../lib/trips/adapter.ts";
import {
  timeAllocation,
  planningProblems,
  suggestedSplit,
  routeLegs,
  planningCosts,
} from "../lib/trips/planning.ts";
const draft = () => ({
  ...structuredClone(emptyTrip),
  origin: "Delhi",
  days: 20,
  stops: [
    { id: "one", name: "Kyoto", timezone: "Asia/Tokyo", nights: 9 },
    { id: "two", name: "Kyoto", timezone: "Asia/Tokyo", nights: 8 },
  ],
});
test("long repeated-stop route preserves visits and separates overnight travel from stays", () => {
  const t = draft();
  const leg = routeLegs(t)[0];
  t.travelPreferences = {
    [leg.key]: {
      mode: "Rail",
      overnight: 2,
      hours: "30",
      rate: "",
      basis: "person",
    },
  };
  assert.equal(routeLegs(t).length, 3);
  assert.equal(timeAllocation(t).stays, 17);
  assert.equal(timeAllocation(t).travelNights, 2);
  assert.equal(timeAllocation(t).remaining, 0);
  t.days = 19;
  assert.equal(planningProblems(t).length, 1);
});
test("exact inclusive days, open duration and explicit suggestion acceptance use different capacities", () => {
  const t = draft();
  t.mode = "exact";
  t.start = "2026-12-01";
  t.end = "2026-12-08";
  assert.equal(timeAllocation(t).days, 8);
  assert.equal(timeAllocation(t).available, 7);
  assert.equal(planningProblems(t).length, 1);
  const proposal = suggestedSplit(t);
  assert.deepEqual(
    proposal.map((s) => s.nights),
    [4, 3],
  );
  assert.equal(t.stops[0].nights, 9);
  t.mode = "duration";
  t.days = 0;
  assert.equal(timeAllocation(t).remaining, null);
  assert.equal(planningProblems(t).length, 0);
  t.stops.forEach((s) => (s.nights = 0));
  assert.equal(timeAllocation(t).allocated, 0);
});
test("cost bases multiply rooms, beds, travelers and vehicles; blanks stay unknown", () => {
  const t = draft();
  t.travelers = 3;
  t.rooms = 2;
  t.stops[0].nights = 2;
  t.stops[1].nights = 1;
  t.stayPreferences = {
    one: { style: "Hotel", basis: "room", rate: "1000" },
    two: { style: "Hostel", basis: "bed", rate: "500" },
  };
  const legs = routeLegs(t);
  t.travelPreferences = {
    [legs[0].key]: {
      mode: "Bus",
      hours: "",
      overnight: 0,
      rate: "200",
      basis: "person",
    },
    [legs[1].key]: {
      mode: "Private",
      hours: "",
      overnight: 0,
      rate: "1200",
      basis: "vehicle",
    },
  };
  assert.equal(planningCosts(t).total, 7300);
  assert.equal(planningCosts(t).unknown, 1);
  t.stops.reverse();
  assert.equal(planningCosts(t).total, 5500);
  assert.equal(planningCosts(t).unknown, 3);
});
test("window conflict and different finish remain explicit", () => {
  const t = draft();
  t.mode = "window";
  t.start = "2026-12-01";
  t.end = "2026-12-12";
  t.returnToOrigin = false;
  t.finish = "Osaka";
  assert.match(planningProblems(t)[0], /does not fit/);
  assert.equal(routeLegs(t).at(-1).to, "Osaka");
});
test("browser adapters isolate personal and sample drafts and preserve zero-night stops", async () => {
  const records = new Map();
  globalThis.localStorage = {
    getItem: (k) => records.get(k) ?? null,
    setItem: (k, v) => records.set(k, v),
  };
  const t = draft();
  t.days = 0;
  t.stops[0].nights = 0;
  await mockTripAdapter.save(t);
  await mockSampleAdapter.save(sampleTrip);
  assert.deepEqual(await mockTripAdapter.load(), t);
  assert.deepEqual(await mockSampleAdapter.load(), sampleTrip);
  delete globalThis.localStorage;
});

test("currency totals add integer minor units rather than accumulating fractional cents", () => {
  const t = draft();
  t.stops[0].nights = 3;
  t.stops[1].nights = 1;
  t.stayPreferences = {
    one: { style: "Hotel", basis: "room", rate: "0.10" },
    two: { style: "Hotel", basis: "room", rate: "0.20" },
  };
  assert.equal(planningCosts(t).total, 0.5);
});

test("malformed saved preferences are rejected before entering the UI", async () => {
  const records = new Map();
  globalThis.localStorage = {
    getItem: (k) => records.get(k) ?? null,
    setItem: (k, v) => records.set(k, v),
  };
  const t = draft();
  t.travelPreferences = {
    bad: {
      mode: "Bus",
      hours: "2",
      overnight: -1,
      rate: "100",
      basis: "person",
    },
  };
  await assert.rejects(mockTripAdapter.save(t), /invalid/);
  records.set(
    "tripadapt.mock-draft.v1",
    JSON.stringify({ schema: 1, trip: t }),
  );
  await assert.rejects(mockTripAdapter.load(), /unreadable/);
  delete globalThis.localStorage;
});
