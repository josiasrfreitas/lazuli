import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const [mode, environment, image] = process.argv.slice(2);
assert.ok(["smoke", "application"].includes(mode));
assert.ok(["staging", "prod"].includes(environment));
const repository = `413781344359.dkr.ecr.us-east-2.amazonaws.com/lazuli/${environment}`;
assert.ok(
  image.startsWith(`${repository}@sha256:`) && /^[a-f0-9]{64}$/.test(image.split(":").at(-1)),
);
function aws(...args) {
  return JSON.parse(
    execFileSync("aws", [...args, "--region", "us-east-2", "--output", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
}
async function remote(instanceId, filename, args) {
  const script = readFileSync(new URL(filename, import.meta.url)).toString("base64");
  // All args are validated enums or a fixed-account image digest, never secret values.
  const command = aws(
    "ssm",
    "send-command",
    "--instance-ids",
    instanceId,
    "--document-name",
    "AWS-RunShellScript",
    "--parameters",
    JSON.stringify({
      commands: [
        `printf '%s' '${script}' | base64 --decode > /tmp/lazuli-deploy-script.sh`,
        `bash /tmp/lazuli-deploy-script.sh ${args.join(" ")}`,
      ],
      executionTimeout: ["1200"],
    }),
  ).Command.CommandId;
  for (let attempt = 0; attempt < 250; attempt++) {
    await delay(5000);
    let result;
    try {
      result = aws(
        "ssm",
        "get-command-invocation",
        "--command-id",
        command,
        "--instance-id",
        instanceId,
      );
    } catch (error) {
      if (String(error.stderr).includes("InvocationDoesNotExist")) continue;
      throw new Error("Cannot read SSM command status");
    }
    if (["Pending", "InProgress", "Delayed"].includes(result.Status)) continue;
    // Only print known status lines; container/application logs may include personal data.
    for (const line of `${result.StandardOutputContent}\n${result.StandardErrorContent}`.split(
      "\n",
    )) {
      if (line.startsWith("PASS:")) console.log(line);
      if (
        line.startsWith("Missing required environment variable:") ||
        line.startsWith("Remote runtime")
      )
        console.log(line);
    }
    assert.equal(
      result.Status,
      "Success",
      `SSM ${command} failed (${result.Status}); inspect privately in AWS`,
    );
    return;
  }
  throw new Error(`Timed out waiting for SSM ${command}; inspect status before retrying`);
}
async function migrate(instanceId) {
  const directory = mkdtempSync(join(tmpdir(), "lazuli-migration-"));
  let tunnel;
  try {
    const parameter = aws(
      "ssm",
      "get-parameter",
      "--name",
      `/lazuli/${environment}/migration/DATABASE_URL`,
      "--with-decryption",
    );
    const database = new URL(parameter.Parameter.Value);
    assert.equal(database.pathname, `/lazuli_${environment}`);
    const host = database.hostname;
    assert.match(host, /^[a-z0-9.-]+\.rds\.amazonaws\.com$/);
    tunnel = spawn(
      "aws",
      [
        "ssm",
        "start-session",
        "--region",
        "us-east-2",
        "--target",
        instanceId,
        "--document-name",
        "AWS-StartPortForwardingSessionToRemoteHost",
        "--parameters",
        JSON.stringify({ host: [host], portNumber: ["5432"], localPortNumber: ["15432"] }),
      ],
      { stdio: "ignore" },
    );
    // Check the port instead of assuming a fixed startup time.
    const { createConnection } = await import("node:net");
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (tunnel.exitCode !== null) throw new Error("SSM tunnel exited");
      ready = await new Promise((resolve) => {
        const socket = createConnection({ host: "127.0.0.1", port: 15432 });
        socket.setTimeout(1000);
        socket.once("connect", () => {
          socket.destroy();
          resolve(true);
        });
        socket.once("error", () => {
          socket.destroy();
          resolve(false);
        });
        socket.once("timeout", () => {
          socket.destroy();
          resolve(false);
        });
      });
      if (ready) break;
      await delay(1000);
    }
    assert.ok(ready, "SSM tunnel did not open");
    const response = await fetch(
      "https://truststore.pki.rds.amazonaws.com/us-east-2/us-east-2-bundle.pem",
    );
    assert.ok(response.ok, "RDS CA download failed");
    writeFileSync(join(directory, "rds-ca.pem"), await response.text(), { mode: 0o644 });
    database.port = "15432";
    if (process.platform === "darwin") {
      // Colima cannot reach the host's loopback tunnel through Docker host networking.
      // SSM fixes the remote RDS destination; the local client verifies its CA.
      database.hostname = "127.0.0.1";
      database.searchParams.set("sslmode", "verify-ca");
      database.searchParams.set("sslrootcert", join(directory, "rds-ca.pem"));
      database.searchParams.set("uselibpqcompat", "true");
      execFileSync("node", ["infra/deploy/migrate.mjs"], {
        env: { ...process.env, DATABASE_URL: database.href, LAZULI_ENV: environment },
        stdio: "inherit",
        timeout: 660000,
      });
      return;
    }
    database.searchParams.set("sslmode", "verify-full");
    database.searchParams.set("sslrootcert", "/opt/lazuli/rds-ca.pem");
    writeFileSync(
      join(directory, "migration.env"),
      `DATABASE_URL=${database.href}\nLAZULI_ENV=${environment}\n`,
      { mode: 0o600 },
    );
    execFileSync("docker", ["pull", image], { stdio: "ignore" });
    execFileSync(
      "docker",
      [
        "run",
        "--rm",
        "--network",
        "host",
        "--add-host",
        `${host}:127.0.0.1`,
        "--env-file",
        join(directory, "migration.env"),
        "--mount",
        `type=bind,src=${join(directory, "rds-ca.pem")},dst=/opt/lazuli/rds-ca.pem,readonly`,
        image,
        "node",
        "infra/deploy/migrate.mjs",
      ],
      { stdio: "inherit", timeout: 660000 },
    );
  } finally {
    tunnel?.kill("SIGTERM");
    rmSync(directory, { recursive: true, force: true });
  }
}
try {
  assert.equal(aws("sts", "get-caller-identity").Account, "413781344359");
  const instances = aws(
    "ec2",
    "describe-instances",
    "--filters",
    "Name=tag:Project,Values=lazuli",
    `Name=tag:Environment,Values=${environment}`,
    "Name=instance-state-name,Values=running",
  ).Reservations.flatMap((reservation) => reservation.Instances);
  assert.equal(
    instances.length,
    1,
    "Exactly one running EC2 required; set running=true and apply its Pulumi stack first",
  );
  const instanceId = instances[0].InstanceId;
  if (mode === "smoke") await remote(instanceId, "smoke.sh", [environment, image]);
  else {
    await remote(instanceId, "host.sh", ["prepare", environment, image]);
    await migrate(instanceId);
    await remote(instanceId, "host.sh", ["activate", environment, image]);
  }
} catch (error) {
  // Do not dump child process output/arguments, which can contain decrypted values.
  console.error(
    error instanceof assert.AssertionError || error?.constructor === Error
      ? error.message.split("\n")[0]
      : "Deployment failed; inspect the private operation details.",
  );
  process.exitCode = 1;
}
