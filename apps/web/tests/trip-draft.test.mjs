import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleTrip, issuesFor, mockTripAdapter } from '../lib/trips/adapter.ts';

test('back-to-back activities are allowed; true overlaps remain draft issues', () => {
 const trip = structuredClone(sampleTrip);
 trip.activities[0].start = '10:00';
 assert.equal(issuesFor(trip).length, 0);
 trip.activities[0].minutes = 121;
 assert.equal(issuesFor(trip).filter(x => x.includes('overlaps')).length, 2);
});
test('time conflicts are scoped to destination and day', () => {
 const trip = structuredClone(sampleTrip);
 trip.activities[0].start = '12:00';
 trip.activities[0].day = 2;
 assert.equal(issuesFor(trip).length, 0);
 trip.activities[0].day = 1;
 trip.activities[0].stopId = 'udaipur';
 assert.equal(issuesFor(trip).length, 0);
});
test('shortened stays expose displaced activities', () => {
 const trip = structuredClone(sampleTrip);
 trip.activities[0].day = 6;
 assert.ok(issuesFor(trip).some(x => x.includes('outside this destination')));
});
test('exact dates and flexible windows expose incompatible stay lengths', () => {
 const trip = structuredClone(sampleTrip);
 trip.mode = 'exact'; trip.start = '2026-12-01'; trip.end = '2026-12-05';
 assert.ok(issuesFor(trip).some(x => x.includes('Stay nights')));
 trip.mode = 'window';
 assert.ok(issuesFor(trip).some(x => x.includes('tentative date window')));
 trip.mode = 'duration'; trip.start = ''; trip.end = '';
 assert.equal(issuesFor(trip).length, 0);
});
test('mock persistence round-trips draft and reports unavailable storage', async () => {
 const records = new Map();
 globalThis.localStorage = { getItem: k => records.get(k) ?? null, setItem: (k,v) => records.set(k,v) };
 assert.equal(await mockTripAdapter.load(), null);
 await mockTripAdapter.save(sampleTrip);
 assert.deepEqual(await mockTripAdapter.load(), sampleTrip);
 globalThis.localStorage.setItem = () => { throw new Error('quota'); };
 await assert.rejects(mockTripAdapter.save(sampleTrip), /quota/);
 records.set('tripadapt.mock-draft.v1', '{broken');
 await assert.rejects(mockTripAdapter.load());
 delete globalThis.localStorage;
});
