const { mkdtempSync, chmodSync, rmSync } = require("node:fs");
const { writeFile } = require("node:fs/promises");
const net = require("node:net");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { setTimeout: delay } = require("node:timers/promises");

function parseStatus(output) {
  const uri = [
    ...output.matchAll(/^status change: \( new input: (.*) \)$/gm),
  ].at(-1)?.[1];
  const state = [
    ...output.matchAll(/^status change: \( (\w+) state: \d+ \)$/gm),
  ].at(-1)?.[1];
  return {
    uri,
    currentplid: uri ? new URL(uri).href : "-1",
    state:
      { play: "playing", pause: "paused", stop: "stopped" }[state] || "opening",
  };
}

class MacLcControl {
  constructor(timeout = 2000) {
    this.timeout = timeout;
    this.directory = null;
    this.queue = Promise.resolve();
  }

  start() {
    this.dispose();
    // Keep the socket below macOS's path limit and inaccessible to other users.
    this.directory = mkdtempSync("/tmp/lampa-maclc-");
    chmodSync(this.directory, 0o700);
    this.socketPath = path.join(this.directory, "control.sock");
    return [
      "--extraintf=rc",
      `--rc-unix=${this.socketPath}`,
      "--no-media-library",
    ];
  }

  command(command) {
    const operation = this.queue.then(async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await this.sendCommand(command);
        } catch (error) {
          // RC's listen backlog is one. Retry a refused connection before any
          // command was sent, without replaying commands after a lost response.
          if (error.code !== "ECONNREFUSED" || attempt >= 3) throw error;
          await delay(50);
        }
      }
    });
    this.queue = operation.catch(() => {});
    return operation;
  }

  sendCommand(command) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.socketPath);
      let output = "";
      let complete = false;
      socket.setEncoding("utf8");
      socket.setTimeout(this.timeout, () => {
        socket.destroy(new Error("MacLC control request timed out"));
      });
      // The server processes each line before closing its half of the connection.
      socket.on("connect", () => socket.end(`${command}\n`));
      socket.on("data", (data) => {
        output += data;
        if (output.length > 65536) {
          socket.destroy(new Error("MacLC control response is too large"));
        }
      });
      socket.on("error", reject);
      socket.on("end", () => {
        complete = true;
        resolve(output);
      });
      socket.on("close", () => {
        if (!complete) reject(new Error("MacLC control connection closed"));
      });
    });
  }

  async status() {
    const output = await this.command("status\nget_time\nget_length\nstatus");
    const after = parseStatus(output);
    const values = [...output.matchAll(/^(\d+)$/gm)].map((match) =>
      Number(match[1]),
    );
    const inputs = [
      ...output.matchAll(/^status change: \( new input: (.*) \)$/gm),
    ];
    // A manual file change between queries must never mix two movies' timecodes.
    const same =
      values.length === 2 &&
      inputs.length >= 2 &&
      inputs.every((match) => new URL(match[1]).href === after.currentplid);
    return {
      ...after,
      time: same ? values[0] : 0,
      length: same ? values[1] : 0,
    };
  }

  async request(parameters = {}, resource = "status.json") {
    switch (parameters.command) {
      case "pl_empty":
        await this.command("clear");
        break;
      case "pl_stop":
        await this.command("stop");
        break;
      case "in_play": {
        // RC has a 1024-byte line limit and may expand shell syntax. A private
        // M3U keeps long signed URLs intact and out of the command parser.
        const playlist = path.join(this.directory, "stream.m3u");
        await writeFile(playlist, `#EXTM3U\n${parameters.input}\n`, {
          mode: 0o600,
        });
        await this.command(`add ${pathToFileURL(playlist).href}`);
        break;
      }
      case "seek":
        if (!Number.isFinite(parameters.val) || parameters.val < 0) {
          throw new Error("Invalid MacLC seek position");
        }
        await this.command(`seek ${parameters.val}`);
        break;
      case "fullscreen":
        await this.command("fullscreen on");
        break;
      case undefined:
        break;
      default:
        throw new Error("Unsupported MacLC command");
    }
    if (parameters.command !== undefined) return {};
    const status = await this.status();
    return resource === "playlist.json"
      ? {
          children: status.uri
            ? [{ id: status.currentplid, uri: status.uri }]
            : [],
        }
      : status;
  }

  dispose() {
    if (this.directory)
      rmSync(this.directory, { recursive: true, force: true });
    this.directory = null;
  }
}

module.exports = { MacLcControl };
