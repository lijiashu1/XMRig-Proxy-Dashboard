import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createTcpServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function getUnusedPort() {
  const listener = createTcpServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}

test("static server only exposes public dashboard assets", { timeout: 15000 }, async t => {
  const port = await getUnusedPort();
  const child = spawn(process.execPath, [join(root, "bin/server.js")], {
    cwd: root,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
    stdio: "ignore",
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise(resolve => {
        child.once("exit", resolve);
        child.kill("SIGTERM");
      });
    }
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  let homepage;
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Static server exited early with code ${child.exitCode}`);
    try {
      homepage = await fetch(baseUrl);
      break;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  assert.ok(homepage, `Static server did not start: ${lastError}`);
  assert.equal(homepage.status, 200);
  assert.match(await homepage.text(), /XMRig Proxy Dashboard/);

  const moduleResponse = await fetch(`${baseUrl}/src/main.js`);
  assert.equal(moduleResponse.status, 200);
  assert.match(moduleResponse.headers.get("content-type"), /javascript/);

  for (const path of [
    "/package.json",
    "/README.md",
    "/.git/config",
    "/src/../package.json",
    "/%2e%2e%2fpackage.json",
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 404, `${path} must not be served`);
    await response.arrayBuffer();
  }

  const postResponse = await fetch(baseUrl, { method: "POST" });
  assert.equal(postResponse.status, 405);
  assert.equal(postResponse.headers.get("allow"), "GET, HEAD");
});
