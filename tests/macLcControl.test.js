const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync, statSync } = require("node:fs");
const net = require("node:net");
const { fileURLToPath } = require("node:url");
const { MacLcControl } = require("../src/modules/macLcControl");

async function fixture(t, respond) {
  const control = new MacLcControl(200);
  const args = control.start();
  const connections = new Set();
  const server = net.createServer({ allowHalfOpen: true }, (socket) => {
    connections.add(socket);
    socket.on("close", () => connections.delete(socket));
    let input = "";
    socket.setEncoding("utf8");
    socket.on("data", (data) => (input += data));
    socket.on("end", () => {
      const results = input.trimEnd().split("\n").map(respond);
      if (results.every((result) => result !== null))
        socket.end(results.join(""));
    });
  });
  t.after(async () => {
    for (const socket of connections) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
    control.dispose();
  });
  await new Promise((resolve) => server.listen(control.socketPath, resolve));
  return { control, args };
}

function status(uri, state = "play") {
  return `status change: ( new input: ${uri} )\nstatus change: ( ${state} state: 3 )\n`;
}

test("uses a private Unix socket and waits for the whole response after sending EOF", async (t) => {
  const app = await fixture(t, (command) => `${command}: done\n`);
  assert.deepEqual(app.args, [
    "--extraintf=rc",
    `--rc-unix=${app.control.socketPath}`,
    "--no-media-library",
  ]);
  assert.equal(statSync(app.control.directory).mode & 0o777, 0o700);
  assert.equal(await app.control.command("status"), "status: done\n");
});

test("normalizes RC status and ignores asynchronous notifications in numeric replies", async (t) => {
  const uri = "https://example.com/movie.mp4?token=a%2Bb%26c";
  const app = await fixture(t, (command) => {
    if (command === "status") return status(uri, "pause");
    return `status change: ( audio volume: 100 )\n${command === "get_time" ? 420 : 1200}\n`;
  });
  const sample = await app.control.request();
  assert.equal(sample.state, "paused");
  assert.equal(sample.currentplid, uri);
  assert.equal(sample.time, 420);
  assert.equal(sample.length, 1200);
  assert.deepEqual(await app.control.request({}, "playlist.json"), {
    children: [{ id: uri, uri }],
  });
});

test("cannot combine the time and duration of different movies during a manual change", async (t) => {
  let reads = 0;
  const app = await fixture(t, (command) => {
    if (command === "status")
      return status(`https://example.com/${++reads}.mp4`);
    return "120\n";
  });
  const sample = await app.control.status();
  assert.equal(sample.currentplid, "https://example.com/2.mp4");
  assert.equal(sample.time, 0);
  assert.equal(sample.length, 0);
});

test("keeps long signed URLs and shell syntax verbatim in a private playlist", async (t) => {
  const url =
    "https://example.com/video.mp4?token=a%2Bb%26c&code=$(touch nope)`x`'\"&long=" +
    "x".repeat(4096);
  let playlist;
  const commands = [];
  const app = await fixture(t, (command) => {
    commands.push(command);
    if (command.startsWith("add ")) playlist = fileURLToPath(command.slice(4));
    if (command === "status") return status(url);
    return "0\n";
  });
  await app.control.request({ command: "in_play", input: url });
  assert.equal(readFileSync(playlist, "utf8"), `#EXTM3U\n${url}\n`);
  assert.equal(statSync(playlist).mode & 0o777, 0o600);
  assert.ok(commands.every((command) => Buffer.byteLength(command) < 1024));
  assert.ok(commands.every((command) => !command.includes("$(touch")));
  const directory = app.control.directory;
  app.control.dispose();
  assert.equal(existsSync(directory), false);
});

test("handles absent duration at stop and rejects unsupported or unsafe commands", async (t) => {
  const commands = [];
  const app = await fixture(t, (command) => {
    commands.push(command);
    return command === "status" ? "status change: ( stop state: 5 )\n" : "";
  });
  assert.equal((await app.control.request()).state, "stopped");
  assert.equal((await app.control.request()).length, 0);
  await app.control.request({ command: "fullscreen" });
  assert.ok(commands.includes("fullscreen on"));
  for (const val of [-1, NaN, "12\nquit"]) {
    await assert.rejects(app.control.request({ command: "seek", val }));
  }
  await assert.rejects(app.control.request({ command: "quit" }));
});

test("bounds stalled requests and oversized responses", async (t) => {
  const app = await fixture(t, (command) =>
    command === "status" ? null : "x".repeat(70000),
  );
  await assert.rejects(app.control.command("status"), /timed out/);
  await assert.rejects(app.control.command("get_time"), /too large/);
});

test("serializes concurrent commands and retries only refused connections", async () => {
  const control = new MacLcControl();
  let active = 0;
  let maximum = 0;
  let attempts = 0;
  control.sendCommand = async (command) => {
    attempts++;
    if (attempts === 1) {
      throw Object.assign(new Error("backlog full"), { code: "ECONNREFUSED" });
    }
    maximum = Math.max(maximum, ++active);
    await new Promise(setImmediate);
    active--;
    return command;
  };
  const commands = ["status", "get_time", "seek 120"];
  assert.deepEqual(
    await Promise.all(commands.map((command) => control.command(command))),
    commands,
  );
  assert.equal(maximum, 1);
  assert.equal(attempts, 4);
  control.sendCommand = async () => {
    throw Object.assign(new Error("response lost"), { code: "ECONNRESET" });
  };
  await assert.rejects(control.command("pause"), /response lost/);
});
