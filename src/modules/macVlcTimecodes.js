// Keep unacknowledged samples across renderer reloads and application restarts.
class MacVlcTimecodes {
  constructor(store) {
    this.store = store;
  }

  all() {
    const values = this.store.get("macVlcTimecodes", []);
    return Array.isArray(values) ? values : [];
  }

  save(progress) {
    if (!Number.isFinite(progress.time) || !(progress.duration > 0)) return;
    const values = this.all().filter(
      (entry) =>
        entry.timeline.hash !== progress.timeline.hash ||
        entry.timeline.storageKey !== progress.timeline.storageKey,
    );
    this.store.set("macVlcTimecodes", [...values, progress].slice(-50));
  }

  acknowledge(id, version) {
    const values = this.all();
    const remaining = values.filter(
      (entry) => entry.id !== id || entry.version !== version,
    );
    if (remaining.length !== values.length) {
      this.store.set("macVlcTimecodes", remaining);
    }
  }
}

module.exports = { MacVlcTimecodes };
