const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { EventEmitter } = require("node:events");
const { existsSync } = require("node:fs");
const net = require("node:net");
const { homedir } = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const { MacLcControl } = require("./macLcControl");

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function findExecutable(name) {
  return ["/Applications", path.join(homedir(), "Applications")]
    .map((directory) =>
      path.join(directory, `${name}.app/Contents/MacOS/${name}`),
    )
    .find((executable) => existsSync(executable));
}

function validateRequest(input) {
  const request = typeof input === "string" ? { url: input } : input;
  if (
    !request ||
    typeof request.url !== "string" ||
    /\p{Cc}/u.test(request.url) ||
    !["http:", "https:"].includes(new URL(request.url).protocol)
  ) {
    throw new Error("Only HTTP and HTTPS video URLs are supported");
  }
  const timeline = request.timeline;
  const player = request.player ?? "vlc";
  if (!["vlc", "maclc"].includes(player)) {
    throw new Error("Unsupported macOS player");
  }
  if (
    timeline &&
    !(
      ["string", "number"].includes(typeof timeline.hash) &&
      String(timeline.hash).length <= 128 &&
      typeof timeline.storageKey === "string" &&
      timeline.storageKey.length <= 128
    )
  ) {
    throw new Error("Invalid timeline");
  }
  return {
    id: randomBytes(16).toString("hex"),
    player,
    url: request.url,
    startTime:
      Number.isFinite(request.startTime) && request.startTime > 0
        ? request.startTime
        : 0,
    fullscreen: request.fullscreen === true,
    timeline: timeline
      ? Object.fromEntries(
          ["hash", "storageKey", "profile", "card", "season", "episode"]
            .filter((key) =>
              ["string", "number"].includes(typeof timeline[key]),
            )
            .map((key) => [key, timeline[key]]),
        )
      : null,
  };
}

function playlistItem(playlist, url) {
  if (playlist.uri && new URL(playlist.uri).href === new URL(url).href) {
    return playlist;
  }
  for (const child of playlist.children || []) {
    const item = playlistItem(child, url);
    if (item) return item;
  }
  return null;
}

class MacVlcPlayer extends EventEmitter {
  constructor(dependencies = {}) {
    super();
    this.platform = dependencies.platform ?? process.platform;
    this.findExecutable = dependencies.findExecutable ?? findExecutable;
    this.allocatePort = dependencies.availablePort ?? availablePort;
    this.spawn = dependencies.spawn ?? spawn;
    this.fetch = dependencies.fetch ?? fetch;
    this.pollInterval = dependencies.pollInterval ?? 1000;
    this.startupTimeout = dependencies.startupTimeout ?? 15000;
    this.requestTimeout = dependencies.requestTimeout ?? 2000;
    this.createMacLcControl =
      dependencies.createMacLcControl ??
      (() => new MacLcControl(this.requestTimeout));
    this.playerId = null;
    this.name = "VLC";
    this.control = null;
    this.child = null;
    this.session = null;
    this.timer = null;
    this.polling = null;
    this.queue = Promise.resolve();
    this.disposed = false;
    this.changing = false;
  }

  open(input) {
    const operation = this.queue.then(() => this.openSession(input));
    this.queue = operation.catch(() => {});
    return operation.catch((error) => ({
      success: false,
      error: error.message,
    }));
  }

  async request(parameters = {}, resource = "status.json") {
    if (this.control) return this.control.request(parameters, resource);
    const url = new URL(`http://127.0.0.1:${this.port}/requests/${resource}`);
    for (const [key, value] of Object.entries(parameters)) {
      url.searchParams.set(key, value);
    }
    const response = await this.fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`:${this.password}`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(this.requestTimeout),
    });
    if (!response.ok) throw new Error(`VLC HTTP interface: ${response.status}`);
    return response.json();
  }

  async waitUntil(check) {
    const deadline = Date.now() + this.startupTimeout;
    while (this.child && !this.disposed && Date.now() < deadline) {
      const result = await check().catch(() => null);
      if (result) return result;
      await delay(100);
    }
    throw new Error(`${this.name} did not become ready in time`);
  }

  async ensureProcess() {
    if (this.child) {
      try {
        await this.request();
        return;
      } catch {
        // Replace only our own instance if its control interface cannot recover.
        await this.stopProcess();
      }
    }
    const executable = this.findExecutable(this.name);
    if (!executable) throw new Error(`${this.name} is not installed`);
    let controlArguments;
    if (this.control) controlArguments = this.control.start();
    else {
      this.port = await this.allocatePort();
      this.password = randomBytes(24).toString("hex");
      controlArguments = [
        "--extraintf=http",
        "--http-host=127.0.0.1",
        `--http-port=${this.port}`,
        `--http-password=${this.password}`,
      ];
    }
    const child = this.spawn(
      executable,
      [
        ...controlArguments,
        "--no-playlist-autostart",
        "--no-loop",
        "--no-repeat",
      ],
      { stdio: "ignore" },
    );
    this.child = child;
    const closed = () => {
      if (this.child !== child) return;
      this.child = null;
      this.finish("closed");
      this.control?.dispose();
    };
    child.once("error", closed);
    child.once("exit", closed);
    try {
      await this.waitUntil(() => this.request());
    } catch (error) {
      if (this.child === child) {
        await this.stopProcess();
      }
      throw error;
    }
  }

  async openSession(input) {
    if (this.platform !== "darwin") throw new Error("macOS is required");
    if (this.disposed)
      throw new Error("macOS player controller is shutting down");
    const next = validateRequest(input);
    this.changing = true;
    clearTimeout(this.timer);
    await this.polling;
    await this.sample();
    this.finish("replaced");
    try {
      if (this.playerId !== next.player) {
        await this.stopProcess();
        this.playerId = next.player;
        this.name = next.player === "maclc" ? "MacLC" : "VLC";
        this.control =
          next.player === "maclc" ? this.createMacLcControl() : null;
      }
      await this.ensureProcess();
      await this.request({ command: "pl_empty" });
      // URLSearchParams encodes one HTTP query layer; VLC receives the original MRL.
      await this.request({ command: "in_play", input: next.url });
      const item = await this.waitUntil(async () =>
        playlistItem(await this.request({}, "playlist.json"), next.url),
      );
      next.itemId = String(item.id);
      let status = await this.waitUntil(async () => {
        const value = await this.request();
        return String(value.currentplid) === next.itemId &&
          ["playing", "paused"].includes(value.state)
          ? value
          : null;
      });
      if (next.startTime > 0) {
        // Wait for the demuxer before seeking; never save the initial zero position.
        status = await this.waitUntil(async () => {
          const value = await this.request();
          return String(value.currentplid) === next.itemId && value.length > 0
            ? value
            : null;
        });
        const target = Math.min(next.startTime, Math.max(0, status.length - 1));
        await this.request({ command: "seek", val: target });
        status = await this.waitUntil(async () => {
          const value = await this.request();
          return String(value.currentplid) === next.itemId &&
            value.length > 0 &&
            Math.abs(value.time - target) <= 1 &&
            (target === 0 || value.time > 0)
            ? value
            : null;
        });
      }
      if (next.fullscreen && !status.fullscreen) {
        await this.request({ command: "fullscreen" });
      }
      this.session = {
        ...next,
        version: 0,
        last: null,
        publishedAt: 0,
        failures: 0,
      };
      this.acceptStatus(status, this.session);
      return { success: true, id: next.id };
    } catch (error) {
      // Do not leave an untracked movie playing if setup or resume failed.
      await this.request({ command: "pl_stop" }).catch(() => {});
      throw error;
    } finally {
      this.changing = false;
      this.schedule();
    }
  }

  acceptStatus(status, session) {
    if (this.session !== session) return;
    if (String(status.currentplid) !== session.itemId) {
      this.finish(status.state === "stopped" ? "stopped" : "changed");
      return;
    }
    if (status.state === "stopped") {
      this.finish("stopped");
      return;
    }
    if (!["playing", "paused"].includes(status.state)) return;
    const time = Number(status.time);
    const duration = Number(status.length);
    if (
      !Number.isFinite(time) ||
      !Number.isFinite(duration) ||
      time < 0 ||
      duration <= 0
    )
      return;
    const previous = session.last;
    // VLC can briefly report a playing/paused zero while processing a seek.
    // A deliberate rewind to zero is accepted once it remains stable.
    if (time === 0 && previous?.time > 0) {
      session.zeroSince ??= Date.now();
      if (Date.now() - session.zeroSince < 1000) return;
    } else session.zeroSince = null;
    session.last = {
      time: Math.min(time, duration),
      duration,
      percent: Math.min(100, Math.round((time / duration) * 100)),
      state: status.state,
    };
    if (
      !previous ||
      previous.state !== status.state ||
      Math.abs(previous.time - time) > 3 ||
      (status.state === "paused" && previous.time !== time) ||
      (Date.now() - session.publishedAt >= 5000 &&
        (session.published?.time !== time ||
          session.published?.duration !== duration))
    ) {
      this.publish(session);
    }
  }

  publish(session, reason, ended = false) {
    session.publishedAt = Date.now();
    session.published = session.last;
    if (!session.timeline) return;
    this.emit("progress", {
      ...session.last,
      player: session.player,
      id: session.id,
      version: ++session.version,
      timeline: session.timeline,
      updatedAt: session.publishedAt,
      ended,
      reason,
    });
  }

  finish(reason) {
    clearTimeout(this.timer);
    const session = this.session;
    if (!session) return;
    this.session = null;
    this.publish(session, reason, true);
  }

  sample() {
    if (this.polling) return this.polling;
    const operation = this.readSample();
    this.polling = operation;
    void operation.then(() => {
      if (this.polling === operation) this.polling = null;
    });
    return operation;
  }

  async readSample() {
    const session = this.session;
    if (!session) return;
    try {
      const status = await this.request();
      session.failures = 0;
      this.acceptStatus(status, session);
    } catch {
      if (this.session === session && ++session.failures === 5) {
        this.publish(session, "disconnected");
        this.emit("warning", { player: session.player });
      }
    }
  }

  schedule() {
    clearTimeout(this.timer);
    if (!this.session || this.disposed || this.changing) return;
    this.timer = setTimeout(async () => {
      await this.sample();
      this.schedule();
    }, this.pollInterval);
    this.timer.unref();
  }

  async dispose() {
    this.disposed = true;
    await this.queue;
    clearTimeout(this.timer);
    await this.polling;
    await this.sample();
    this.finish("shutdown");
    await this.stopProcess();
  }

  async stopProcess() {
    const child = this.child;
    const control = this.control;
    this.child = null;
    if (!child) {
      control?.dispose();
      return;
    }
    // MacLC may still be tearing down its interface. Wait before
    // launching a replacement, and bound shutdown if an owned process is stuck.
    await new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        child.removeListener("exit", done);
        child.removeListener("error", done);
        resolve();
      };
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        done();
      }, 5000);
      child.once("exit", done);
      child.once("error", done);
      if (control?.command) {
        void control.command("quit").catch(() => child.kill());
      } else child.kill();
    });
    control?.dispose();
  }
}

const macVlcPlayer = new MacVlcPlayer();
module.exports = { MacVlcPlayer, macVlcPlayer, validateRequest };
