import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const client = join(dist, "client");
const server = join(dist, "server");
await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(server, { recursive: true });

// Sites serves public assets from dist/client, following the vinext output
// convention. This app intentionally uses no bundler dependencies: browser
// ES modules are copied unchanged and are cached by the service worker.
for (const item of ["index.html", "manifest.webmanifest", "sw.js", "src"]) {
  await cp(join(root, item), join(client, item), { recursive: true });
}

// Sites also needs the project binding at the build root, not inside client.
await cp(join(root, ".openai"), join(dist, ".openai"), { recursive: true });

// Minimal vinext-compatible RSC entry. Static files are served by the hosting
// runtime from dist/client; the handler supplies the SPA document for `/` and
// any client-side route so the app remains navigable after refreshes.
const documentHtml = await readFile(join(root, "index.html"), "utf8");
const serverEntry = `const appHtml = ${JSON.stringify(documentHtml)};

async function handleRequest(request) {
  const url = new URL(request.url);
  if (url.pathname === "/" || url.pathname === "/index.html" || !url.pathname.includes(".")) {
    return new Response(appHtml, {
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "no-cache"
      }
    });
  }
  return new Response("Not found", { status: 404 });
}

export default {
  fetch: handleRequest
};
`;
await writeFile(join(server, "index.js"), serverEntry, "utf8");

console.log("Sites-compatible production bundle created in dist/");
