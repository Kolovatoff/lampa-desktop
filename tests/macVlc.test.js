const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { MacVlcPlayer, validateRequest } = require("../src/modules/macVlc");

const timeline = { hash: "movie", storageKey: "file_view", profile: 0 };
const url = "http://localhost:8090/stream/Серия%201.mkv?play&token=a%2Bb%26c";

function fixture(t, options = {}) {
  const state = { state: "stopped", currentplid: -1, time: 0, length: 0 };
  const calls = [];
  const children = [];
  const progress = [];
  const warnings = [];
  let nextItem = 0;
  let unavailable = false;
  let heldRequest = null;
  let deferredSeek = null;
  let seekPolls = 0;
  const player = new MacVlcPlayer({
    platform: "darwin",
    findExecutable: () => "/Applications/VLC.app/Contents/MacOS/VLC",
    availablePort: async () => 54321,
    pollInterval: 60000,
    startupTimeout: 100,
    spawn: (executable, args, settings) => {
      const child = new EventEmitter();
      child.kill = () => {
        child.killed = true;
        child.emit("exit", 0);
      };
      children.push({ child, executable, args, settings });
      return child;
    },
    fetch: async (request, settings) => {
      if (unavailable) throw new Error("VLC temporarily unavailable");
      const parsed = new URL(request);
      const command = parsed.searchParams.get("command");
      calls.push({ url: parsed, settings });
      if (command === "pl_empty" || command === "pl_stop") {
        Object.assign(state, {
          state: "stopped",
          currentplid: -1,
          time: 0,
          length: 0,
        });
      } else if (command === "in_play") {
        Object.assign(state, {
          state: "playing",
          currentplid: ++nextItem,
          time: 0,
          length: 1200,
          uri: parsed.searchParams.get("input"),
        });
      } else if (command === "seek") {
        if (options.delaySeekPolls) {
          deferredSeek = Number(parsed.searchParams.get("val"));
          seekPolls = options.delaySeekPolls;
          state.time = 0;
        } else state.time = Number(parsed.searchParams.get("val"));
      } else if (command === "fullscreen") state.fullscreen = true;

      if (!command && deferredSeek !== null && --seekPolls <= 0) {
        state.time = deferredSeek;
        deferredSeek = null;
      }

      const snapshot = parsed.pathname.endsWith("playlist.json")
        ? { children: [{ id: state.currentplid, uri: state.uri }] }
        : { ...state };
      if (heldRequest && !command && parsed.pathname.endsWith("status.json")) {
        const held = heldRequest;
        heldRequest = null;
        held.started();
        await held.promise;
      }
      return { ok: true, json: async () => snapshot };
    },
    ...options,
  });
  player.on("progress", (sample) => progress.push(sample));
  player.on("warning", (message) => warnings.push(message));
  t.after(() => player.dispose());
  return {
    player,
    state,
    calls,
    children,
    progress,
    warnings,
    fail: (value) => {
      unavailable = value;
    },
    holdNextStatus: () => {
      let release;
      let started;
      const pending = new Promise((resolve) => {
        started = resolve;
      });
      const promise = new Promise((resolve) => {
        release = resolve;
      });
      heldRequest = { promise, started };
      return { pending, release };
    },
  };
}

test("launches an owned VLC on loopback with a fresh secret and intact signed MRL", async (t) => {
  const app = fixture(t);
  assert.equal((await app.player.open({ url, timeline })).success, true);
  const launch = app.children[0];
  assert.equal(launch.executable, "/Applications/VLC.app/Contents/MacOS/VLC");
  assert.ok(launch.args.includes("--http-host=127.0.0.1"));
  assert.ok(launch.args.includes("--http-port=54321"));
  assert.equal(launch.settings.stdio, "ignore");
  assert.equal(app.state.uri, url);
  const password = launch.args
    .find((argument) => argument.startsWith("--http-password="))
    .split("=")[1];
  assert.match(password, /^[a-f0-9]{48}$/);
  assert.equal(
    app.calls[0].settings.headers.Authorization,
    `Basic ${Buffer.from(`:${password}`).toString("base64")}`,
  );
});

test("rejects malformed input and unsupported platforms before starting VLC", async (t) => {
  const app = fixture(t);
  for (const input of [
    null,
    "--args",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://example.com/x\n--args",
    { url, timeline: { hash: {}, storageKey: "file_view" } },
    { url, player: "../../OtherApp" },
  ]) {
    assert.equal((await app.player.open(input)).success, false);
  }
  assert.equal(app.children.length, 0);
  assert.equal(
    (await fixture(t, { platform: "linux" }).player.open(url)).success,
    false,
  );
  assert.equal(
    (await fixture(t, { findExecutable: () => null }).player.open(url)).success,
    false,
  );
});

test("resumes only after seek completes and never records startup zero over saved progress", async (t) => {
  const app = fixture(t);
  assert.equal(
    (await app.player.open({ url, timeline, startTime: 420 })).success,
    true,
  );
  assert.equal(app.progress[0].time, 420);
  assert.equal(app.progress[0].percent, 35);
  assert.ok(app.progress.every((sample) => sample.time >= 420));
});

test("preserves timeline identifiers without transferring callbacks", () => {
  const request = validateRequest({
    url,
    timeline: {
      ...timeline,
      card: "tv_123",
      season: 2,
      episode: 3,
      handler: () => {},
      password: "secret",
    },
    startTime: NaN,
  });
  assert.deepEqual(request.timeline, {
    ...timeline,
    card: "tv_123",
    season: 2,
    episode: 3,
  });
  assert.equal(request.startTime, 0);
});

test("saves pause, forward seek and rewind including a genuine zero position", async (t) => {
  const app = fixture(t);
  await app.player.open({ url, timeline, startTime: 420 });
  Object.assign(app.state, { time: 640, state: "paused" });
  await app.player.sample();
  assert.equal(app.progress.at(-1).time, 640);
  app.state.time = 0;
  await app.player.sample();
  assert.equal(app.progress.at(-1).time, 640);
  app.player.session.zeroSince -= 1001;
  await app.player.sample();
  assert.equal(app.progress.at(-1).time, 0);
  assert.equal(app.progress.at(-1).percent, 0);
});

test("stop and process exit retain the last valid position instead of VLC's reset zero", async (t) => {
  const app = fixture(t);
  await app.player.open({ url, timeline, startTime: 420 });
  Object.assign(app.state, {
    state: "stopped",
    time: 0,
    length: 0,
    currentplid: -1,
  });
  await app.player.sample();
  assert.equal(app.player.session, null);
  assert.equal(app.progress.at(-1).time, 420);
  assert.equal(app.progress.at(-1).ended, true);
  await app.player.open({ url, timeline, startTime: 420 });
  app.children[0].child.emit("exit", 0);
  assert.equal(app.progress.at(-1).time, 420);
  assert.equal(app.progress.at(-1).reason, "closed");
});

test("EOF retains completion and live streams never create a fake timecode", async (t) => {
  const app = fixture(t);
  await app.player.open({ url, timeline, startTime: 1199 });
  Object.assign(app.state, {
    state: "stopped",
    time: 0,
    length: 0,
    currentplid: -1,
  });
  await app.player.sample();
  assert.equal(app.progress.at(-1).percent, 100);
  await app.player.open(url);
  app.state.length = 0;
  const count = app.progress.length;
  await app.player.sample();
  assert.equal(app.progress.length, count);
});

test("a file opened manually in VLC cannot overwrite the tracked movie", async (t) => {
  const app = fixture(t);
  await app.player.open({ url, timeline, startTime: 420 });
  Object.assign(app.state, { currentplid: 999, time: 900 });
  await app.player.sample();
  assert.equal(app.player.session, null);
  assert.equal(app.progress.at(-1).time, 420);
  assert.equal(app.progress.at(-1).reason, "changed");
});

test("reuses its VLC process and flushes the previous file before switching", async (t) => {
  const app = fixture(t);
  const first = await app.player.open({ url, timeline, startTime: 420 });
  app.state.time = 425;
  const second = await app.player.open({
    url: url + "&next",
    timeline: { ...timeline, hash: "next" },
  });
  assert.equal(app.children.length, 1);
  assert.notEqual(first.id, second.id);
  assert.equal(app.progress.find((sample) => sample.ended).time, 425);
  assert.equal(app.progress.at(-1).timeline.hash, "next");
  assert.equal(app.progress.at(-1).time, 0);
});

test("serializes a new launch with a delayed old poll and ignores stale process exit", async (t) => {
  const app = fixture(t);
  await app.player.open({ url, timeline, startTime: 420 });
  const held = app.holdNextStatus();
  const poll = app.player.sample();
  await held.pending;
  const launch = app.player.open({
    url: url + "&next",
    timeline: { ...timeline, hash: "next" },
  });
  held.release();
  await poll;
  assert.equal((await launch).success, true);
  assert.equal(app.progress.at(-1).timeline.hash, "next");
  assert.equal(app.progress.at(-1).time, 0);
  const old = app.children[0].child;
  old.emit("exit", 0);
  await app.player.open({ url, timeline });
  old.emit("exit", 0);
  assert.ok(app.player.session);
  assert.equal(app.children.length, 2);
});

test("temporary HTTP failures warn once and recover without losing the session", async (t) => {
  const app = fixture(t);
  await app.player.open({ url, timeline, startTime: 420 });
  app.fail(true);
  for (let i = 0; i < 7; i++) await app.player.sample();
  assert.equal(app.warnings.length, 1);
  assert.ok(app.player.session);
  app.fail(false);
  app.state.time = 440;
  await app.player.sample();
  assert.equal(app.progress.at(-1).time, 440);
});

test("shutdown flushes progress, kills only its own process and rejects later launches", async (t) => {
  const app = fixture(t);
  await app.player.open({ url, timeline, startTime: 420 });
  app.state.time = 423;
  await app.player.dispose();
  assert.equal(app.progress.at(-1).time, 423);
  assert.equal(app.children[0].child.killed, true);
  assert.equal((await app.player.open(url)).success, false);
});

test("waits through transient zero samples even when resuming only one second in", async (t) => {
  const app = fixture(t, { delaySeekPolls: 2, startupTimeout: 500 });
  assert.equal(
    (await app.player.open({ url, timeline, startTime: 1 })).success,
    true,
  );
  assert.ok(app.progress.every((sample) => sample.time === 1));
});

test("HTTP timeouts and shutdown during startup clean up the owned process", async (t) => {
  const app = fixture(t, {
    requestTimeout: 10,
    startupTimeout: 20,
    fetch: (_url, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        }),
      ),
  });
  // The timer emulates a live child process keeping Node's event loop active.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    assert.equal((await app.player.open(url)).success, false);
    assert.equal(app.children[0].child.killed, true);
    const launch = app.player.open(url);
    await new Promise(setImmediate);
    await app.player.dispose();
    assert.equal((await launch).success, false);
    assert.equal(app.children[1].child.killed, true);
  } finally {
    clearInterval(keepAlive);
  }
});

test("a new launch replaces an unresponsive owned HTTP instance", async (t) => {
  const app = fixture(t);
  await app.player.open({ url, timeline, startTime: 420 });
  app.fail(true);
  const spawn = app.player.spawn;
  app.player.spawn = (...args) => {
    app.fail(false);
    return spawn(...args);
  };
  assert.equal((await app.player.open({ url, timeline })).success, true);
  assert.equal(app.children.length, 2);
  assert.equal(app.children[0].child.killed, true);
});

test("an idle pause does not repeatedly persist the same sample", async (t) => {
  const app = fixture(t);
  await app.player.open({ url, timeline, startTime: 420 });
  app.state.state = "paused";
  await app.player.sample();
  const count = app.progress.length;
  app.player.session.publishedAt -= 6000;
  await app.player.sample();
  assert.equal(app.progress.length, count);
  app.state.time = 421;
  await app.player.sample();
  assert.equal(app.progress.at(-1).time, 421);
});

test("switches between VLC and MacLC after flushing progress and releases only the owned process", async (t) => {
  let starts = 0;
  let cleanups = 0;
  const control = {
    start: () => {
      starts++;
      return ["--extraintf=rc", "--rc-unix=/private/control.sock"];
    },
    dispose: () => cleanups++,
    request: async (parameters = {}, resource = "status.json") => {
      const request = new URL(`http://test/requests/${resource}`);
      for (const [key, value] of Object.entries(parameters))
        request.searchParams.set(key, value);
      return (await app.player.fetch(request, {})).json();
    },
  };
  const app = fixture(t, {
    createMacLcControl: () => control,
    findExecutable: (name) =>
      `/Applications/${name}.app/Contents/MacOS/${name}`,
  });
  await app.player.open({ url, timeline, startTime: 120 });
  const vlc = app.children[0];
  assert.equal(
    (await app.player.open({ player: "maclc", url, timeline, startTime: 420 }))
      .success,
    true,
  );
  assert.equal(vlc.child.killed, true);
  assert.equal(app.progress.find((sample) => sample.ended).time, 120);
  assert.equal(
    app.children[1].executable,
    "/Applications/MacLC.app/Contents/MacOS/MacLC",
  );
  assert.ok(app.children[1].args.includes("--extraintf=rc"));
  assert.ok(app.children[1].args.every((arg) => !arg.includes("--http")));
  assert.equal(app.progress.at(-1).player, "maclc");
  assert.equal(app.progress.at(-1).time, 420);
  assert.equal(starts, 1);
  await app.player.open({ player: "maclc", url, timeline });
  assert.equal(app.children.length, 2);
  await app.player.open({ player: "vlc", url, timeline });
  assert.equal(app.children[1].child.killed, true);
  assert.equal(cleanups, 1);
  assert.equal(
    app.children[2].executable,
    "/Applications/VLC.app/Contents/MacOS/VLC",
  );
  assert.equal(app.progress.at(-1).player, "vlc");
});

test("requests a graceful MacLC quit before removing its private control files", async (t) => {
  const app = fixture(t);
  await app.player.open({ url, timeline, startTime: 120 });
  const child = app.children[0].child;
  let disposed = false;
  app.player.control = {
    request: async () => ({ ...app.state }),
    command: async (command) => {
      assert.equal(command, "quit");
      assert.equal(disposed, false);
      child.emit("exit", 0);
    },
    dispose: () => {
      disposed = true;
    },
  };
  await app.player.dispose();
  assert.notEqual(child.killed, true);
  assert.equal(disposed, true);
  assert.equal(app.progress.at(-1).reason, "shutdown");
  assert.equal(app.progress.at(-1).time, 120);
});
