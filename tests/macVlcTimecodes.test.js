const test = require("node:test");
const assert = require("node:assert/strict");
const { MacVlcTimecodes } = require("../src/modules/macVlcTimecodes");

function fixture() {
  const values = new Map();
  const store = {
    get: (key, fallback) => values.get(key) ?? fallback,
    set: (key, value) => values.set(key, value),
  };
  const journal = new MacVlcTimecodes(store);
  const sample = {
    id: "session",
    version: 1,
    time: 42,
    duration: 100,
    percent: 42,
    timeline: { hash: "movie", storageKey: "file_view" },
  };
  return { journal, store, sample };
}

test("pending timecodes survive controller recreation until acknowledged", () => {
  const { journal, store, sample } = fixture();
  journal.save(sample);
  assert.deepEqual(new MacVlcTimecodes(store).all(), [sample]);
  journal.acknowledge(sample.id, sample.version);
  assert.deepEqual(journal.all(), []);
});

test("a delayed acknowledgement cannot remove a newer checkpoint", () => {
  const { journal, sample } = fixture();
  journal.save(sample);
  const next = { ...sample, version: 2, time: 40 };
  journal.save(next);
  journal.acknowledge(sample.id, 1);
  assert.deepEqual(journal.all(), [next]);
});

test("keeps account profiles separate and bounds unacknowledged history", () => {
  const { journal, sample } = fixture();
  journal.save(sample);
  const other = {
    ...sample,
    timeline: { ...sample.timeline, storageKey: "file_view_2" },
  };
  journal.save(other);
  assert.equal(journal.all().length, 2);
  for (let i = 0; i < 60; i++)
    journal.save({
      ...sample,
      id: String(i),
      timeline: { ...sample.timeline, hash: String(i) },
    });
  assert.equal(journal.all().length, 50);
  journal.save({ ...sample, time: 0, duration: 0 });
  assert.equal(journal.all().length, 50);
});
