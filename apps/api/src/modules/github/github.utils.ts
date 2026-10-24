import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FoundKey } from './github.types.js';

/** True when `header` (`sha256=<hex>`) is the HMAC-SHA256 of the raw `body` made with `secret`. */
export const verifySignature = (
  body: string,
  header: string | undefined,
  secret: string,
) => {
  if (!header) return false;
  const expected = Buffer.from(
    `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
  );
  const given = Buffer.from(header);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
};

const KEY = /\b([A-Za-z]+)-(\d+)\b/g;
const CLOSING_WORD = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s*\[?$/i;

/**
 * The keys of `prefixes` (UN) named in `text`, in any letter case, as `UN-42`. A key counts as
 * closing when a closing word comes right before it (`Closes UN-42`, `Closes [UN-42](https://…)`).
 */
export const findKeys = (text: string, prefixes: string[]): FoundKey[] => {
  const found = new Map<string, boolean>();
  for (const match of text.matchAll(KEY)) {
    const prefix = prefixes.find(
      (p) => p.toLowerCase() === match[1].toLowerCase(),
    );
    if (!prefix) continue;
    const key = `${prefix}-${Number(match[2])}`;
    const before = text.slice(0, match.index);
    const closes = CLOSING_WORD.test(before);
    found.set(key, found.get(key) || closes);
  }
  return [...found].map(([key, closes]) => ({ key, closes }));
};
