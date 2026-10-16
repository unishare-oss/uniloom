// Guards for scripts/setup-uniauth.mjs (SETUP.md step 6). Run: bun test scripts/
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkUniauthContract, stopTempServer } from "./setup-uniauth.mjs";

test("stopTempServer: the process is really gone when it resolves", async () => {
  const proc = Bun.spawn(["sleep", "30"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  const pid = proc.pid;
  await stopTempServer(proc);
  expect(proc.signalCode).toBe("SIGTERM");
  expect(() => process.kill(pid, 0)).toThrow();
}, 10_000);

test("stopTempServer: an already-exited process resolves without throwing", async () => {
  const proc = Bun.spawn(["true"], { stdout: "ignore", stderr: "ignore" });
  await proc.exited;
  await stopTempServer(proc);
  expect(proc.exitCode).toBe(0);
}, 10_000);

const makeTree = (files) => {
  const dir = mkdtempSync(join(tmpdir(), "uniauth-"));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
};

test("checkUniauthContract: an empty folder reports every missing piece", () => {
  const problems = checkUniauthContract(makeTree({}));
  const joined = problems.join("\n");
  expect(joined).toContain("apps/server/src/index.ts");
  expect(joined).toContain("apps/server/scripts/create-client.ts");
  expect(joined).toContain('"dev"');
  expect(joined).toContain('"db:migrate"');
});

test("checkUniauthContract: a complete tree reports nothing", () => {
  const dir = makeTree({
    "apps/server/src/index.ts": "",
    "apps/server/scripts/create-client.ts": "",
    "package.json": JSON.stringify({ scripts: { dev: "bun run dev" } }),
    "apps/server/package.json": JSON.stringify({
      scripts: { "db:migrate": "x migrate" },
    }),
  });
  expect(checkUniauthContract(dir)).toEqual([]);
});
