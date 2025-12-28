/**
 * Development server for Kaski PSP Emulator
 */

import { serve, file } from 'bun';
import { join, extname } from 'path';

const PORT = 3000;
const PUBLIC_DIR = './public';
const DATA_DIR = './data';
const SRC_DIR = './src';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.ts': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.elf': 'application/octet-stream',
  '.pbp': 'application/octet-stream',
  '.iso': 'application/octet-stream',
  '.cso': 'application/octet-stream',
};

// Build the main.ts to main.js
async function buildMain(): Promise<void>
{
  console.log('Building main.ts...');

  const result = await Bun.build({
    entrypoints: ['./public/main.ts'],
    outdir: './public',
    target: 'browser',
    sourcemap: 'inline',
  });

  if (!result.success)
  {
    console.error('Build failed:', result.logs);
    throw new Error('Build failed');
  }

  console.log('Build complete');
}

// Serve files
serve({
  port: PORT,

  async fetch(request)
  {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // Handle root
    if (pathname === '/')
    {
      pathname = '/index.html';
    }

    // Try different paths
    const paths = [
      join(PUBLIC_DIR, pathname),
      join(DATA_DIR, pathname.replace('/data/', '')),
      join(SRC_DIR, pathname.replace('/src/', '')),
      '.' + pathname,
    ];

    for (const path of paths)
    {
      const f = file(path);

      if (await f.exists())
      {
        const ext = extname(path);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        return new Response(f, {
          headers: {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // 404
    return new Response('Not Found', { status: 404 });
  },
});

// Initial build
await buildMain();

console.log(`
╔════════════════════════════════════════╗
║     Kaski PSP Emulator Dev Server      ║
╠════════════════════════════════════════╣
║  http://localhost:${PORT}                  ║
║                                        ║
║  Drag & drop a .elf or .pbp file       ║
║  or cube.elf will auto-load            ║
╚════════════════════════════════════════╝
`);
