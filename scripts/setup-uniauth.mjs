// Connects Uniloom to your local uniAuth (SETUP.md step 6). It signs in to uniAuth with
// your account, or creates the account if it doesn't exist yet, registers Uniloom as a
// sign-in client with uniAuth's own create-client script, and saves the client's id and
// secret in apps/api/.env. If uniAuth isn't running, it starts it for the moment.
//
//   bun run setup:uniauth
//
// It asks for your email, password and name. To skip the questions, set
// UNIAUTH_ADMIN_EMAIL, UNIAUTH_ADMIN_PASSWORD and UNIAUTH_ADMIN_NAME first.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const UNIAUTH = "http://localhost:3002";
const root = resolve(import.meta.dir, "..");
const apiEnvPath = resolve(root, "apps/api/.env");
const uniauthServer = resolve(root, "../uniAuth/apps/server");

let tempUniauth = null;
const finish = (code, message) => {
  if (message) console.log(message);
  tempUniauth?.kill();
  process.exit(code);
};

if (!existsSync(apiEnvPath) || !existsSync(resolve(uniauthServer, ".env")))
  finish(
    1,
    "The .env files are missing. Run bun run setup first (SETUP.md step 5).",
  );

const discovery = `${UNIAUTH}/api/auth/.well-known/openid-configuration`;
if (!(await fetch(discovery).catch(() => null))?.ok) {
  console.log("Starting uniAuth for a moment...");
  tempUniauth = Bun.spawn([process.execPath, "src/index.ts"], {
    cwd: uniauthServer,
    stdout: "ignore",
    stderr: "ignore",
  });
  for (let second = 0; second < 60; second++) {
    if ((await fetch(discovery).catch(() => null))?.ok) break;
    await Bun.sleep(1000);
  }
  if (!(await fetch(discovery).catch(() => null))?.ok)
    finish(
      1,
      "uniAuth didn't start. Run bun run uniauth:dev to see its error.",
    );
}

console.log("Use the email and password you want for signing in to Uniloom.");
console.log(
  "(Local only: the email isn't checked. The password shows as you type.)",
);
const email = process.env.UNIAUTH_ADMIN_EMAIL || prompt("Email:");
const password =
  process.env.UNIAUTH_ADMIN_PASSWORD ||
  prompt("Password (8 or more characters):");
if (!email || !password) finish(1, "An email and a password are both needed.");

const post = (path, body) =>
  fetch(`${UNIAUTH}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: UNIAUTH },
    body: JSON.stringify(body),
  });

let account = await post("/sign-in/email", { email, password });
if (account.status === 401) {
  console.log(`Creating a uniAuth account for ${email}.`);
  const name =
    process.env.UNIAUTH_ADMIN_NAME || prompt("Your name (shown in Uniloom):");
  if (!name) finish(1, "A name is needed to create the account.");
  account = await post("/sign-up/email", { email, password, name });
}
const accountBody = await account.json().catch(() => ({}));
if (!account.ok && accountBody.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")
  finish(
    1,
    `${email} already has a uniAuth account, with a different password. Run this again with that password.`,
  );
if (!account.ok || !accountBody.user?.id)
  finish(1, `uniAuth refused: ${accountBody.message ?? account.status}`);

// uniAuth only lets admins create clients. Passing the id here makes this account one,
// for this command only; uniAuth's .env stays as it is.
const create = Bun.spawnSync(
  [
    process.execPath,
    "scripts/create-client.ts",
    "--name",
    "Uniloom",
    "--origin",
    "http://127.0.0.1:3013",
    "--local",
  ],
  {
    cwd: uniauthServer,
    env: {
      ...process.env,
      UNIAUTH_ADMIN_EMAIL: email,
      UNIAUTH_ADMIN_PASSWORD: password,
      UNIAUTH_ADMIN_USER_IDS: accountBody.user.id,
    },
  },
);
const client = JSON.parse(
  create.stdout.toString().match(/\{[\s\S]*\}/)?.[0] ?? "{}",
);
if (create.exitCode !== 0 || !client.client_id || !client.client_secret)
  finish(
    1,
    `uniAuth couldn't create the client:\n${create.stderr.toString()}${create.stdout.toString()}`,
  );

let apiEnv = readFileSync(apiEnvPath, "utf8");
for (const [key, value] of [
  ["UNIAUTH_CLIENT_ID", client.client_id],
  ["UNIAUTH_CLIENT_SECRET", client.client_secret],
]) {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  apiEnv = pattern.test(apiEnv)
    ? apiEnv.replace(pattern, line)
    : `${apiEnv.trimEnd()}\n${line}\n`;
}
writeFileSync(apiEnvPath, apiEnv);

finish(
  0,
  `Done. Uniloom is registered with uniAuth, and apps/api/.env has its client id and secret.
Sign in to Uniloom later with ${email} and the password you just typed.`,
);
