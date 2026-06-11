import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(url, { attempts = 4, asBuffer = false } = {}) {
  let delay = 500;
  let bustCache = false;
  for (let attempt = 1; ; attempt++) {
    // CDNs sometimes cache an upstream 5xx; a throwaway query param makes the
    // retry fetch a fresh copy instead of replaying the poisoned cache entry.
    const attemptUrl = bustCache ? `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}` : url;
    let res;
    try {
      res = await fetch(attemptUrl, { headers: { 'user-agent': 'local-pokedex-builder/1.0' } });
    } catch (err) {
      if (attempt >= attempts) throw new Error(`network error for ${url}: ${err.message}`);
      await sleep(delay + Math.random() * 250);
      delay *= 3;
      continue;
    }
    if (res.status === 404) return { notFound: true };
    if (res.status === 429 || res.status >= 500) {
      if (res.status >= 500) bustCache = true;
      if (attempt >= attempts) throw new Error(`HTTP ${res.status} for ${url}`);
      const retryAfter = Number(res.headers.get('retry-after')) || 0;
      await sleep(retryAfter ? retryAfter * 1000 : delay + Math.random() * 250);
      delay *= 3;
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    if (asBuffer) return { buffer: Buffer.from(await res.arrayBuffer()) };
    return { json: await res.json() };
  }
}

// Disk-cache-first JSON fetch. 404s are cached as { __notFound: true } so they
// are not retried on every run.
export async function cachedFetchJson(url, cachePath, { maxAgeMs = Infinity, force = false } = {}) {
  if (!force) {
    try {
      const st = await stat(cachePath);
      if (maxAgeMs === Infinity || Date.now() - st.mtimeMs < maxAgeMs) {
        return JSON.parse(await readFile(cachePath, 'utf8'));
      }
    } catch {
      // cache miss
    }
  }
  const result = await fetchWithRetry(url);
  const value = result.notFound ? { __notFound: true } : result.json;
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(value));
  return value;
}

export async function downloadFile(url, destPath) {
  try {
    const st = await stat(destPath);
    if (st.size > 0) return false;
  } catch {
    // not downloaded yet
  }
  const result = await fetchWithRetry(url, { asBuffer: true });
  if (result.notFound) return false;
  await mkdir(path.dirname(destPath), { recursive: true });
  await writeFile(destPath, result.buffer);
  return true;
}

// Simple promise pool with progress output. Collects per-item errors instead of
// aborting the whole run; callers decide whether errors are fatal.
export async function pool(items, limit, worker, label) {
  const results = new Array(items.length);
  const errors = [];
  let next = 0;
  let done = 0;
  let lastPrint = 0;

  async function run() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        errors.push({ item: items[i], error: err.message });
      }
      done++;
      const now = Date.now();
      if (label && (now - lastPrint > 1000 || done === items.length)) {
        lastPrint = now;
        process.stdout.write(`\r[${label}] ${done}/${items.length}   `);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, run));
  if (label && items.length) process.stdout.write('\n');
  if (errors.length) {
    console.warn(`[${label ?? 'pool'}] ${errors.length} item(s) failed:`);
    for (const e of errors.slice(0, 10)) {
      console.warn(`  - ${JSON.stringify(e.item).slice(0, 100)}: ${e.error}`);
    }
  }
  return { results, errors };
}
