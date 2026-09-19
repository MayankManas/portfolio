/**
 * static-server.ts - serves dist/ over localhost for the scripts that need a
 * real HTTP origin: PDF generation, screenshots, the smoke test and
 * Lighthouse. All of them must run against the BUILT output rather than a dev
 * server, so that what is measured is what would deploy.
 *
 * Nothing here is reachable off the machine: it binds 127.0.0.1 on an
 * ephemeral port.
 */
import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import type { AddressInfo } from 'node:net';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
};

async function resolveFile(root: string, url: string): Promise<string | undefined> {
  // normalize then strip leading separators, so nothing outside root is servable
  const rel = normalize(decodeURIComponent(url.split('?')[0] ?? '/')).replace(/^[/\\]+/, '');
  const direct = join(root, rel);

  const info = await stat(direct).catch(() => undefined);
  if (info?.isFile()) return direct;
  if (info?.isDirectory()) {
    const index = join(direct, 'index.html');
    return (await stat(index).catch(() => undefined))?.isFile() ? index : undefined;
  }

  // extensionless path -> directory index (Astro's default route shape)
  if (!extname(direct)) {
    const index = join(root, rel, 'index.html');
    if ((await stat(index).catch(() => undefined))?.isFile()) return index;
  }
  return undefined;
}

export interface StaticServer {
  origin: string;
  close: () => Promise<void>;
}

export async function startStaticServer(root: string): Promise<StaticServer> {
  const server: Server = createServer((req, res) => {
    void (async () => {
      // The file is read BEFORE any header is written. Writing the 200 first
      // and reading inside res.end() meant a missing file threw after the
      // headers were already sent, and the 404 path crashed the process.
      const filePath = await resolveFile(root, req.url ?? '/');

      if (filePath === undefined) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('not found');
        return;
      }

      try {
        const body = await readFile(filePath);
        res.writeHead(200, {
          'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
          'Content-Length': body.byteLength,
        });
        res.end(body);
      } catch (error) {
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`read failed: ${(error as Error).message}`);
      }
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
