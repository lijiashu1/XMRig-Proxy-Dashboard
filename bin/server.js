#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = await realpath(resolve(fileURLToPath(new URL("..", import.meta.url))));
const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || "127.0.0.1";

const allowedRootFiles = new Set(["index.html", "styles.css", "panel.png"]);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function isWithinRoot(candidate) {
  const pathFromRoot = relative(root, candidate);
  return Boolean(pathFromRoot) &&
    pathFromRoot !== ".." &&
    !pathFromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromRoot);
}

function resolvePublicFile(pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (decodedPath.includes("\\") || decodedPath.includes("\0")) return null;
  const requestPath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  if (!requestPath) return null;

  const filePath = resolve(root, requestPath);
  const relativePath = relative(root, filePath);
  if (!isWithinRoot(filePath)) return null;

  const isRootAsset = allowedRootFiles.has(relativePath);
  const isApplicationModule = /^src\/[A-Za-z0-9._-]+\.js$/.test(relativePath);
  if (!isRootAsset && !isApplicationModule) return null;

  return filePath;
}

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Allow": "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method Not Allowed");
    return;
  }

  try {
    const requestPath = new URL(req.url || "/", "http://localhost").pathname;
    const filePath = resolvePublicFile(requestPath);
    if (!filePath) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    // The allowlist prevents metadata exposure; realpath containment also
    // prevents an allowed-looking symlink from escaping the package root.
    const realFilePath = await realpath(filePath);
    if (!isWithinRoot(realFilePath)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const data = await readFile(realFilePath);
    res.writeHead(200, {
      "Content-Type": mime[extname(realFilePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
});

server.listen(port, host, () => {
  console.log(`XMRig Proxy Dashboard: http://${host}:${port}`);
});
