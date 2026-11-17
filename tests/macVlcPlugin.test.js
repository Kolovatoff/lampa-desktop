const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const plugin = readFileSync(
  path.join(__dirname, "../src/macVlcPlugin.js"),
  "utf8",
);

function loadPlugin({
  mac = true,
  ready = true,
  launchResult = { success: true },
  unlock = (_data, callback) => callback(),
} = {}) {
  const events = new Map();
  const appEvents = [];
  const opened = [];
  const requests = [];
  const acknowledgements = [];
  const records = new Map();
  const timelineReads = [];
  let storageKey = "file_view";
  let pending = [];
  let receiveProgress;
  let receiveWarning;
  let prompt;
  const external = [];
  const messages = [];
  const settings = {
    player: "iina",
    player_torrent: "iina",
    player_iptv: "inner",
  };
  let nativeIptv = 0;
  const Lampa = {
    Platform: { macOS: () => mac },
    Params: {
      values: {},
      defaults: {},
      select(name, values, fallback) {
        this.values[name] = values;
        this.defaults[name] = fallback;
      },
    },
    Storage: {
      field: (name) =>
        settings[name] ?? (name === "player_timecode" ? "continue" : false),
    },
    Lang: { add() {}, translate: (key) => key },
    Noty: { show: (message) => messages.push(message) },
    Listener: { follow: (_name, callback) => appEvents.push(callback) },
    Controller: { enabled: () => ({ name: "content" }), toggle() {} },
    Select: {
      show: (value) => {
        prompt = value;
      },
    },
    Utils: { secondsToTime: String },
    Timeline: {
      filename: () => storageKey,
      listener: { follow: (_name, callback) => timelineReads.push(callback) },
      view: (hash, meta = {}) => ({
        hash,
        time: 0,
        duration: 0,
        percent: 0,
        profile:
          Number(storageKey.replace("file_view", "").replace("_", "")) || 0,
        updated: 0,
        ...records.get(`${storageKey}:${hash}`),
        handler: (percent, time, duration) =>
          records.set(`${storageKey}:${hash}`, {
            ...meta,
            percent,
            time,
            duration,
            updated: Date.now(),
          }),
      }),
    },
    Player: {
      runas() {},
      iptv: () => nativeIptv++,
      getUrlQuality: (quality) => quality["1080p"] || "",
      listener: {
        follow: (name, callback) =>
          events.set(name, [...(events.get(name) || []), callback]),
        send: (name, data) => {
          if (name === "external") external.push(data);
          for (const callback of events.get(name) || []) callback(data);
        },
      },
    },
    PlayerVideo: { verifyTube: (url) => url.includes("youtube.com") },
    PlayerIPTV: { locked: unlock },
    Torserver: { toPlayUrl: (url) => url.replace("/stream?", "/play?") },
  };
  for (const name of Object.keys(settings)) {
    Lampa.Params.values[name] = { inner: "Built-in", iina: "IINA" };
    Lampa.Params.defaults[name] = "inner";
  }
  const window = {
    appready: ready,
    electronAPI: {
      player: {
        openMacVlc: async (request) => {
          requests.push(JSON.parse(JSON.stringify(request)));
          opened.push(request.url);
          return { ...launchResult, id: `session-${requests.length}` };
        },
        getMacVlcTimecodes: async () => pending,
        acknowledgeMacVlcTimecode: async (id, version) => {
          acknowledgements.push({ id, version });
          pending = pending.filter(
            (entry) => entry.id !== id || entry.version !== version,
          );
        },
        onMacVlcProgress: (callback) => {
          receiveProgress = callback;
        },
        onMacVlcWarning: (callback) => {
          receiveWarning = callback;
        },
      },
    },
  };
  const context = vm.createContext({ window, Lampa, console: { error() {} } });
  vm.runInContext(plugin, context);
  function play(data) {
    let aborted = false;
    Lampa.Player.listener.send("create", {
      data,
      abort: () => {
        aborted = true;
      },
    });
    return aborted;
  }
  return {
    Lampa,
    settings,
    opened,
    requests,
    acknowledgements,
    records,
    timelineReads,
    setProfile: (value) => {
      storageKey = value;
    },
    setPending: (value) => {
      pending = value;
    },
    progress: (value) => receiveProgress(value),
    warn: (warning) => receiveWarning(warning),
    prompt: () => prompt,
    external,
    messages,
    appEvents,
    play,
    nativeIptv: () => nativeIptv,
    reinject: () => vm.runInContext(plugin, context),
  };
}

test("adds VLC to all three menus while preserving choices and defaults", () => {
  const app = loadPlugin();
  for (const name of Object.keys(app.settings)) {
    assert.equal(app.Lampa.Params.values[name].vlc, "VLC");
    assert.equal(app.Lampa.Params.values[name].maclc, "MacLC");
    assert.equal(app.Lampa.Params.values[name].iina, "IINA");
    assert.equal(app.Lampa.Params.defaults[name], "inner");
  }
  assert.equal(app.settings.player, "iina");
  app.reinject();
  assert.equal(app.play({ url: "https://example.com/movie.mp4" }), false);
});

test("opens online and torrent videos with their separate player selections", async () => {
  const app = loadPlugin();
  app.settings.player_torrent = "vlc";
  assert.equal(
    app.play({
      url: "http://localhost:8090/stream?index=2&play",
      torrent_hash: "hash",
    }),
    true,
  );
  await new Promise(setImmediate);
  assert.equal(app.play({ url: "https://example.com/movie.mp4" }), false);
  app.settings.player = "vlc";
  assert.equal(app.play({ url: "https://example.com/movie.mp4" }), true);
  await new Promise(setImmediate);
  assert.deepEqual(app.opened, [
    "http://localhost:8090/play?index=2&play",
    "https://example.com/movie.mp4",
  ]);
  assert.equal(app.external.length, 2);
});

test("routes MacLC video, torrent and IPTV through the shared timecode integration", async () => {
  const app = loadPlugin();
  app.settings.player = "maclc";
  app.settings.player_torrent = "vlc";
  const data = {
    url: "https://example.com/movie.mp4",
    timeline: { hash: "movie" },
  };
  app.records.set("file_view:movie", {
    time: 420,
    duration: 1200,
    percent: 35,
  });
  assert.equal(app.play(data), true);
  await new Promise(setImmediate);
  assert.equal(app.requests[0].player, "maclc");
  assert.equal(app.requests[0].startTime, 420);
  assert.equal(app.requests[0].timeline.hash, "movie");
  app.play({ ...data, torrent_hash: "hash" });
  await new Promise(setImmediate);
  assert.equal(app.requests.at(-1).player, "vlc");
  app.play({ ...data, launch_player: "maclc", torrent_hash: "hash" });
  await new Promise(setImmediate);
  assert.equal(app.requests.at(-1).player, "maclc");
  assert.equal(app.play({ ...data, launch_player: "iina" }), false);
  app.settings.player_iptv = "maclc";
  app.Lampa.Player.iptv(data);
  await new Promise(setImmediate);
  assert.equal(app.requests.at(-1).player, "maclc");
  assert.equal(app.requests.at(-1).timeline, null);
  app.warn({ player: "maclc" });
  assert.equal(app.messages.at(-1), "desktop_maclc_sync_failed");
});

test("respects an explicit internal player and YouTube playback", () => {
  const app = loadPlugin();
  app.settings.player = "vlc";
  assert.equal(app.play({ url: "https://youtube.com/watch?v=test" }), false);
  assert.equal(
    app.play({ url: "https://example.com/movie.mp4", launch_player: "inner" }),
    false,
  );
  app.Lampa.Player.runas("inner");
  assert.equal(app.play({ url: "https://example.com/movie.mp4" }), false);
  app.Lampa.Player.listener.send("close", {});
  assert.equal(app.play({ url: "https://example.com/movie.mp4" }), true);
});

test("uses the configured video quality and reports native launch failures", async () => {
  const app = loadPlugin({
    launchResult: { success: false, error: "Missing VLC" },
  });
  app.settings.player = "vlc";
  assert.equal(
    app.play({
      url: "https://example.com/480.mp4",
      quality: { "1080p": "https://example.com/1080.mp4" },
    }),
    true,
  );
  await new Promise(setImmediate);
  assert.deepEqual(app.opened, ["https://example.com/1080.mp4"]);
  assert.equal(app.external.length, 0);
  assert.equal(app.messages.length, 1);
});

test("routes IPTV to VLC only when selected for IPTV", async () => {
  const app = loadPlugin();
  const data = { url: "https://example.com/live.m3u8" };
  app.Lampa.Player.iptv(data);
  assert.equal(app.nativeIptv(), 1);
  app.settings.player_iptv = "vlc";
  app.Lampa.Player.iptv(data);
  await new Promise(setImmediate);
  assert.deepEqual(app.opened, [data.url]);
  assert.equal(app.nativeIptv(), 1);
});

test("waits for the existing IPTV parental-control check before opening VLC", async () => {
  let unlockChannel;
  const app = loadPlugin({
    unlock: (_data, callback) => {
      unlockChannel = callback;
    },
  });
  app.settings.player_iptv = "vlc";
  const data = { url: "https://example.com/locked.m3u8", locked: true };
  app.Lampa.Player.iptv(data);
  assert.equal(app.opened.length, 0);
  unlockChannel();
  await new Promise(setImmediate);
  assert.deepEqual(app.opened, [data.url]);
});

test("waits for app readiness and does not install on other platforms", async () => {
  const app = loadPlugin({ ready: false });
  assert.equal(app.Lampa.Params.values.player.vlc, undefined);
  for (let i = 0; i < 2; i++) app.appEvents[0]({ type: "ready" });
  app.settings.player = "vlc";
  app.reinject();
  assert.equal(app.play({ url: "https://example.com/movie.mp4" }), true);
  await new Promise(setImmediate);
  assert.equal(app.opened.length, 1);
  assert.equal(
    loadPlugin({ mac: false }).Lampa.Params.values.player.vlc,
    undefined,
  );
});

test("reloads saved progress instead of trusting a stale search result", async () => {
  const app = loadPlugin();
  app.settings.player = "vlc";
  app.records.set("file_view:movie", {
    time: 420,
    duration: 1200,
    percent: 35,
  });
  const stale = { hash: "movie", time: 0, duration: 0, percent: 0 };
  app.play({ url: "https://example.com/movie.mp4", timeline: stale });
  await new Promise(setImmediate);
  assert.equal(app.requests[0].startTime, 420);
  assert.equal(app.requests[0].timeline.hash, "movie");
  assert.equal(app.requests[0].timeline.storageKey, "file_view");
  assert.equal(app.requests[0].timeline.handler, undefined);
  assert.equal(stale.time, 420);
});

test("honors again/continue/ask and restarts completed movies from zero", async () => {
  const app = loadPlugin();
  app.settings.player = "vlc";
  app.records.set("file_view:movie", {
    time: 420,
    duration: 1200,
    percent: 35,
  });
  const data = {
    url: "https://example.com/movie.mp4",
    timeline: { hash: "movie" },
  };
  app.settings.player_timecode = "again";
  app.play(data);
  await new Promise(setImmediate);
  assert.equal(app.requests[0].startTime, 0);
  app.settings.player_timecode = "ask";
  app.play(data);
  await new Promise(setImmediate);
  assert.equal(app.requests.length, 1);
  app.prompt().onSelect({ resume: true });
  await new Promise(setImmediate);
  assert.equal(app.requests[1].startTime, 420);
  app.play(data);
  await new Promise(setImmediate);
  app.prompt().onBack();
  await new Promise(setImmediate);
  assert.equal(app.requests.length, 2);
  app.settings.player_timecode = "continue";
  app.records.set("file_view:movie", {
    time: 1195,
    duration: 1200,
    percent: 99,
  });
  app.play(data);
  await new Promise(setImmediate);
  assert.equal(app.requests[2].startTime, 0);
});

test("updates the original timeline callback and in-memory values while watching", async () => {
  const app = loadPlugin();
  app.settings.player = "vlc";
  const timeline = app.Lampa.Timeline.view("movie");
  app.play({ url: "https://example.com/movie.mp4", timeline });
  await new Promise(setImmediate);
  const sample = {
    id: "session-1",
    version: 1,
    time: 400,
    duration: 1000,
    percent: 40,
    updatedAt: Date.now(),
    timeline: { hash: "movie", storageKey: "file_view" },
  };
  app.progress(sample);
  assert.equal(timeline.time, 400);
  assert.equal(app.records.get("file_view:movie").time, 400);
  app.progress({ ...sample, version: 2, time: 100, percent: 10 });
  assert.equal(app.records.get("file_view:movie").time, 100);
  app.progress(sample);
  assert.equal(app.records.get("file_view:movie").time, 100);
  assert.equal(app.acknowledgements.length, 3);
});

test("restores pending progress only to its original profile after a reload", async () => {
  const app = loadPlugin();
  const sample = {
    id: "old-session",
    version: 3,
    time: 400,
    duration: 1000,
    percent: 40,
    updatedAt: Date.now(),
    timeline: { hash: "movie", storageKey: "file_view_2" },
  };
  app.setPending([sample]);
  app.timelineReads[0]();
  await new Promise(setImmediate);
  assert.equal(app.records.size, 0);
  assert.equal(app.acknowledgements.length, 0);
  app.setProfile("file_view_2");
  app.timelineReads[0]();
  await new Promise(setImmediate);
  assert.equal(app.records.get("file_view_2:movie").time, 400);
  assert.equal(app.acknowledgements.length, 1);
});

test("never replays an older checkpoint over a newer Lampa timeline", () => {
  const app = loadPlugin();
  app.records.set("file_view:movie", { time: 900, updated: Date.now() + 1000 });
  app.progress({
    id: "old-session",
    version: 1,
    time: 400,
    duration: 1000,
    percent: 40,
    updatedAt: Date.now(),
    timeline: { hash: "movie", storageKey: "file_view" },
  });
  assert.equal(app.records.get("file_view:movie").time, 900);
  assert.equal(app.acknowledgements.length, 1);
});

test("recording opt-out sends no timeline and rapid clicks launch only the latest item", async () => {
  const app = loadPlugin();
  app.settings.player = "vlc";
  app.play({ url: "https://example.com/old.mp4" });
  app.play({
    url: "https://example.com/new.mp4",
    timeline: { hash: "movie", stop_recording: true },
  });
  await new Promise(setImmediate);
  assert.deepEqual(app.opened, ["https://example.com/new.mp4"]);
  assert.equal(app.requests[0].timeline, null);
  app.warn();
  assert.equal(app.messages[0], "desktop_vlc_sync_failed");
});

test("a profile change while answering the resume dialog cancels the old launch", async () => {
  const app = loadPlugin();
  app.settings.player = "vlc";
  app.settings.player_timecode = "ask";
  app.records.set("file_view:movie", {
    time: 420,
    duration: 1200,
    percent: 35,
  });
  app.play({
    url: "https://example.com/movie.mp4",
    timeline: { hash: "movie" },
  });
  await new Promise(setImmediate);
  app.setProfile("file_view_2");
  app.prompt().onSelect({ resume: true });
  await new Promise(setImmediate);
  assert.equal(app.opened.length, 0);
});

test("rebinds a stale timeline callback to the currently selected profile", async () => {
  const app = loadPlugin();
  app.settings.player = "vlc";
  app.setProfile("file_view_2");
  app.records.set("file_view_2:movie", {
    time: 80,
    duration: 1000,
    percent: 8,
    profile: 2,
  });
  const timeline = {
    hash: "movie",
    profile: 1,
    handler: () => {
      throw new Error("stale profile handler");
    },
  };
  app.play({ url: "https://example.com/movie.mp4", timeline });
  await new Promise(setImmediate);
  assert.equal(app.requests[0].timeline.profile, 2);
  app.progress({
    id: "session-1",
    version: 1,
    time: 85,
    duration: 1000,
    percent: 9,
    updatedAt: Date.now(),
    timeline: { hash: "movie", storageKey: "file_view_2" },
  });
  assert.equal(app.records.get("file_view_2:movie").time, 85);
  assert.equal(app.records.has("file_view:movie"), false);
});
