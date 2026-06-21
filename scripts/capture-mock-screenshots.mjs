#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const mockDir = path.join(root, "tmp", "mock");
const screenshotsDir = path.join(mockDir, "screenshots");
const desktopViewport = { width: 1440, height: 900, scale: 1 };
const mobileViewport = { width: 390, height: 844, scale: 1 };

const desktopScreens = [
  ["login.html", "02-login.png"],
  ["admin-dashboard.html", "03-admin-dashboard.png"],
  ["students-list.html", "04-students-list.png"],
  ["student-profile.html", "05-student-profile.png"],
  ["classes-list.html", "06-classes-list.png"],
  ["receivables.html", "07-receivables.png"],
];

const mobileScreens = [
  ["teacher-home.html", "08-teacher-home-mobile.png"],
  ["teacher-attendance.html", "09-teacher-attendance-mobile.png"],
  ["teacher-history.html", "10-teacher-history-mobile.png"],
];

class McpClient {
  constructor() {
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";
    this.server = spawn(
      "npm",
      [
        "exec",
        "chrome-devtools-mcp@latest",
        "--",
        "--headless",
        "--isolated",
        "--viewport",
        `${desktopViewport.width}x${desktopViewport.height}`,
        "--screenshotFormat",
        "png",
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: "1",
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    this.server.stdout.setEncoding("utf8");
    this.server.stderr.setEncoding("utf8");
    this.server.stdout.on("data", (chunk) => this.onData(chunk));
    this.server.stderr.on("data", (chunk) => process.stderr.write(chunk));
    this.server.on("exit", (code, signal) => {
      for (const { reject } of this.pending.values()) {
        reject(new Error(`chrome-devtools-mcp exited with ${code ?? signal}`));
      }
      this.pending.clear();
    });
  }

  onData(chunk) {
    this.buffer += chunk;
    for (;;) {
      const newlineIndex = this.buffer.indexOf("\n");
      if (newlineIndex === -1) return;
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) continue;

      const message = JSON.parse(line);
      if (message.id == null) continue;

      const pending = this.pending.get(message.id);
      if (!pending) continue;

      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result);
      }
    }
  }

  send(message) {
    this.server.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(method, params = {}) {
    const id = this.nextId++;
    const message = { jsonrpc: "2.0", id, method, params };
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.send(message);
    return promise;
  }

  notify(method, params = {}) {
    this.send({ jsonrpc: "2.0", method, params });
  }

  async initialize() {
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "lazuli-mock-screenshot-capture",
        version: "1.0.0",
      },
    });
    this.notify("notifications/initialized");
  }

  async callTool(name, args = {}) {
    return this.request("tools/call", { name, arguments: args });
  }

  async close() {
    this.server.stdin.end();
    this.server.kill("SIGTERM");
  }
}

function fileUrl(fileName) {
  return pathToFileURL(path.join(mockDir, fileName)).href;
}

async function capture(client, fileName, outputName) {
  const outputPath = path.join(screenshotsDir, outputName);
  await client.callTool("navigate_page", {
    type: "url",
    url: fileUrl(fileName),
    timeout: 10000,
  });
  await client.callTool("take_screenshot", {
    filePath: outputPath,
    format: "png",
  });
  console.log(outputPath);
}

await mkdir(screenshotsDir, { recursive: true });

const client = new McpClient();

try {
  await client.initialize();

  await client.callTool("resize_page", {
    width: desktopViewport.width,
    height: desktopViewport.height,
  });
  await client.callTool("emulate", {
    colorScheme: "light",
    viewport: `${desktopViewport.width}x${desktopViewport.height}x${desktopViewport.scale}`,
  });
  for (const [fileName, outputName] of desktopScreens) {
    await capture(client, fileName, outputName);
  }

  await client.callTool("emulate", {
    colorScheme: "light",
    viewport: `${mobileViewport.width}x${mobileViewport.height}x${mobileViewport.scale},mobile,touch`,
  });
  for (const [fileName, outputName] of mobileScreens) {
    await capture(client, fileName, outputName);
  }
} finally {
  await client.close();
}
