import { readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const configurationPath = process.argv[process.argv.indexOf("--config") + 1];
let configuration = JSON.parse(await readFile(configurationPath, "utf8"));
const adminPort = Number(configuration.admin.listen.split(":").at(-1));
const serverName = "lazuli_storybook_proxy_v1";
const httpPort = Number(configuration.apps.http.servers[serverName].listen[0].split(":").at(-1));

function routes() {
  return configuration.apps.http.servers[serverName].routes;
}

const admin = http.createServer(async (request, response) => {
  if (request.headers.origin !== `http://127.0.0.1:${adminPort}`) {
    response.writeHead(403).end('{"error":"client is not allowed to access from origin \'\'"}');
    return;
  }
  if (request.method === "GET" && request.url === "/config/") {
    response.writeHead(200).end(JSON.stringify(configuration));
    return;
  }
  if (request.method === "POST" && request.url === `/config/apps/http/servers/${serverName}`) {
    let body = "";
    for await (const chunk of request) body += chunk;
    configuration.apps.http.servers[serverName] = JSON.parse(body);
    response.writeHead(200).end();
    return;
  }
  if (request.method === "POST" && request.url === "/config/apps/http/servers/unrelated") {
    let body = "";
    for await (const chunk of request) body += chunk;
    configuration.apps.http.servers.unrelated = JSON.parse(body);
    response.writeHead(200).end();
    return;
  }
  response.writeHead(404).end();
});

const proxy = http.createServer((request, response) => {
  const hostname = request.headers.host?.split(":")[0];
  const route = routes().find((candidate) => candidate.match?.[0]?.host?.includes(hostname));
  if (route === undefined) {
    response.writeHead(404).end();
    return;
  }
  const [, port] = route.handle[0].upstreams[0].dial.split(":");
  const upstream = http.request(
    { host: "127.0.0.1", port: Number(port), path: request.url, method: request.method },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on("error", () => response.writeHead(502).end());
  request.pipe(upstream);
});

await new Promise((resolve) => admin.listen(adminPort, "127.0.0.1", resolve));
await new Promise((resolve) => proxy.listen(httpPort, "127.0.0.1", resolve));
await writeFile(path.join(process.env.LAZULI_PROXY_STATE_DIR, "fake-caddy.pid"), `${process.pid}\n`);

function stop() {
  admin.closeAllConnections();
  proxy.closeAllConnections();
  admin.close();
  proxy.close(() => {
    process.exitCode = 0;
  });
}

process.once("SIGTERM", stop);
process.once("SIGINT", stop);
