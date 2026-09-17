import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { URL } from "node:url";

const command = process.argv[2];
const args = process.argv.slice(3);
const root = process.cwd();
const state = path.join(root, ".fake-infra");
mkdirSync(state, { recursive: true });

function log(line) {
  appendFileSync(path.join(root, command === "pnpm" ? "pnpm.log" : "infra.log"), `${line}\n`);
}

if (command === "pnpm") {
  let status = 0;
  log(args.join(" "));
  if (args[0] === "install") {
    mkdirSync(path.join(root, "node_modules/.pnpm"), { recursive: true });
    copyFileSync(
      path.join(root, "pnpm-lock.yaml"),
      path.join(root, "node_modules/.pnpm/lock.yaml"),
    );
  }
  if (args[0] === "prisma:seed") {
    if (process.env.FAKE_SEED_DELAY_MS) {
      Atomics.wait(
        new Int32Array(new SharedArrayBuffer(4)),
        0,
        0,
        Number(process.env.FAKE_SEED_DELAY_MS),
      );
    }
    const failure = path.join(state, "fail-seed-once");
    if (existsSync(failure) && readFileSync(failure, "utf8").trim() === "armed") {
      writeFileSync(failure, "failed\n");
      status = 1;
    } else {
      writeFileSync(path.join(state, "seeded"), "seeded\n", { flag: "a" });
      if (process.env.LAZULI_WORKSPACE_INITIALIZATION_KEY) {
        writeFileSync(path.join(state, "workspace-initialization-complete"), "complete\n");
      }
      if (process.env.FAKE_BLOCK_COMPLETION_JOURNAL === "1") {
        const journal = path.join(root, ".lazuli/database-initialization.json");
        rmSync(journal, { force: true });
        mkdirSync(journal);
      }
    }
  }
  process.exitCode = status;
}

function fakeCompose() {
  if (args[1] === "config") {
    process.stdout.write("postgres\nmailpit\nhatchet-lite\nfake-gcs\n");
  } else if (args[1] === "ps") {
    const rows = ["postgres", "mailpit", "hatchet-lite", "fake-gcs"]
      .filter((service) => service !== process.env.FAKE_MISSING_SERVICE)
      .map((service) => ({
        Service: service,
        State: "running",
        Health: service === process.env.FAKE_UNHEALTHY_SERVICE ? "unhealthy" : "healthy",
      }));
    process.stdout.write(`${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
  }
}

function fakeDockerInspect() {
  const name = args.at(-1);
  const service = name === "lazuli-postgres" ? "postgres" : "fake-gcs";
  const labels = {
    "com.docker.compose.project": process.env.FAKE_COMPOSE_PROJECT ?? "lazuli",
    "com.docker.compose.service": process.env.FAKE_COMPOSE_SERVICE ?? service,
    "com.docker.compose.container-number": "1",
  };
  process.stdout.write(JSON.stringify(labels));
}

function fakeDockerExec() {
  if (args.some((argument) => argument.includes("workspace_initializations"))) {
    if (existsSync(path.join(state, "workspace-initialization-complete")))
      process.stdout.write("1\n");
  } else if (args.some((argument) => argument.includes("SELECT 1 FROM pg_database"))) {
    if (existsSync(path.join(state, "database"))) process.stdout.write("1\n");
  } else if (args.some((argument) => argument.includes("ownership_token ||"))) {
    if (existsSync(path.join(state, "database-ownership")))
      process.stdout.write(readFileSync(path.join(state, "database-ownership"), "utf8"));
  } else if (args.some((argument) => argument.includes("DROP DATABASE"))) {
    rmSync(path.join(state, "database"), { force: true });
    rmSync(path.join(state, "database-ownership"), { force: true });
    rmSync(path.join(state, "workspace-initialization-complete"), { force: true });
  } else if (args.includes("ON_ERROR_STOP=1")) {
    writeFileSync(path.join(state, "database"), "exists\n");
    if (args.some((argument) => argument.includes("workspace_ownership"))) {
      const workspace = JSON.parse(readFileSync(path.join(root, ".lazuli/workspace.json"), "utf8"));
      writeFileSync(
        path.join(state, "database-ownership"),
        `${workspace.ownershipToken}|${workspace.identity}|${workspace.initialTechnicalPath}\n`,
      );
    }
  }
}

function fakeDocker() {
  if (process.env.FAKE_DOCKER_UNAVAILABLE === "1") return 127;
  log(args.join(" "));
  if (args[0] === "compose") fakeCompose();
  else if (args[0] === "inspect") fakeDockerInspect();
  else fakeDockerExec();
  return 0;
}

if (command === "docker") {
  process.exitCode = fakeDocker();
}

if (command === "curl") {
  log(args.join(" "));
  const url = args.at(-1);
  const isPost = args.includes("POST");
  const isDelete = args.includes("DELETE");
  const bucketPath = path.join(state, "bucket");
  const objectMatch = /\/storage\/v1\/b\/[^/]+\/o\/([^?]+)/u.exec(url);
  if (isDelete) {
    if (objectMatch) {
      rmSync(
        path.join(state, `object-${decodeURIComponent(objectMatch[1]).replaceAll("/", "_")}`),
        {
          force: true,
        },
      );
    } else {
      rmSync(bucketPath, { force: true });
      rmSync(path.join(state, "bucket-metadata.json"), { force: true });
    }
  } else if (!isPost && /\/storage\/v1\/b\/[^/]+\/o(?:\?|$)/u.test(url)) {
    const items = [];
    for (const entry of readdirSync(state)) {
      if (entry.startsWith("object-")) items.push({ name: entry.slice("object-".length) });
    }
    process.stdout.write(JSON.stringify({ items }));
  } else if (!isPost) {
    const exists = objectMatch
      ? existsSync(
          path.join(state, `object-${decodeURIComponent(objectMatch[1]).replaceAll("/", "_")}`),
        )
      : existsSync(bucketPath);
    if (args.includes("-w")) process.stdout.write(exists ? "200" : "404");
    else if (exists && objectMatch)
      process.stdout.write(
        readFileSync(
          path.join(state, `object-${decodeURIComponent(objectMatch[1]).replaceAll("/", "_")}`),
          "utf8",
        ),
      );
    else if (exists && !objectMatch)
      process.stdout.write(readFileSync(path.join(state, "bucket-metadata.json"), "utf8"));
  } else if (url.includes("/upload/")) {
    const name = new URL(url).searchParams.get("name").replaceAll("/", "_");
    const dataArgument = args[args.indexOf("--data-binary") + 1];
    const data = dataArgument.startsWith("@") ? readFileSync(dataArgument.slice(1)) : dataArgument;
    writeFileSync(path.join(state, `object-${name}`), data);
  } else {
    writeFileSync(bucketPath, "exists\n");
    const data = args[args.indexOf("-d") + 1];
    writeFileSync(path.join(state, "bucket-metadata.json"), `${data}\n`);
  }
}
