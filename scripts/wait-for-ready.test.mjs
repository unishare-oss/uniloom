// Guards for scripts/wait-for-ready.mjs (used by `bun run dev:local`).
// Run: bun test scripts/
import { expect, test } from "bun:test";
import { waitForReady } from "./wait-for-ready.mjs";

test("returns 0 as soon as the web app answers", async () => {
  const answering = () => Promise.resolve({ ok: true });
  await expect(waitForReady(answering, 30)).resolves.toBe(0);
});

test("returns 1 when the web app never answers", async () => {
  const silent = () => Promise.resolve(null);
  await expect(waitForReady(silent, 1)).resolves.toBe(1);
}, 10_000);
