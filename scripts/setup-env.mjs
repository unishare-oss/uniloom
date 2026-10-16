// Creates the .env files a local setup needs (SETUP.md), each with a fresh secret:
// uniAuth's, and Uniloom's API and web app. A file that already exists is left alone.
// Part of `bun run setup`.
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const secret = () => crypto.randomUUID() + crypto.randomUUID();

if (!existsSync(resolve(root, "../uniAuth/apps/server"))) {
  console.log(
    "uniAuth isn't next to uniloom. Both repos must be in the same folder (SETUP.md step 3).",
  );
  process.exit(1);
}

const files = [
  {
    path: "../uniAuth/apps/server/.env",
    content: `# Local uniAuth, made by bun run setup in uniloom (see uniloom's SETUP.md)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/uniauth
BETTER_AUTH_SECRET=${secret()}
BETTER_AUTH_URL=http://localhost:3002
COOKIE_PREFIX=uniauth
UNISHARE_ORIGIN=http://localhost:3000
UNIGYM_ORIGIN=http://localhost:3003
UNILOOM_ORIGIN=http://127.0.0.1:3013
UNIAUTH_ADMIN_USER_IDS=
GUEST_EMAIL_DOMAIN=guest.unishare.app
`,
  },
  {
    path: "apps/api/.env",
    content: `# Local setup, made by bun run setup (see SETUP.md)
DATABASE_URL="postgresql://uniloom:uniloom@127.0.0.1:5434/uniloom"
PORT=3011
BETTER_AUTH_URL="http://127.0.0.1:3013"
BETTER_AUTH_SECRET="${secret()}"
UNIAUTH_ISSUER="http://localhost:3002/api/auth"
# Filled in by bun run setup:uniauth
UNIAUTH_CLIENT_ID="not-registered-yet"
UNIAUTH_CLIENT_SECRET="not-registered-yet"
MCP_RESOURCE="http://127.0.0.1:3013/mcp"
`,
  },
  {
    path: "apps/web/.env",
    content: `# Local setup, made by bun run setup (see SETUP.md)
API_URL="http://127.0.0.1:3011"
NEXT_PUBLIC_UNIAUTH_URL="http://localhost:3002"
`,
  },
];

for (const file of files) {
  const fullPath = resolve(root, file.path);
  if (existsSync(fullPath)) {
    console.log(`kept     ${file.path} (it already exists)`);
    continue;
  }
  writeFileSync(fullPath, file.content);
  console.log(`created  ${file.path}`);
}
