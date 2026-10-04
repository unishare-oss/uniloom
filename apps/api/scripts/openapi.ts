// Writes the API's OpenAPI spec to apps/web/openapi.json, which Orval turns into the web
// app's typed hooks. Run `bun run api:spec` after changing a route or a schema.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Importing the app reads these settings; generating the spec never uses them.
for (const [key, value] of Object.entries({
  DATABASE_URL: 'postgresql://spec:spec@localhost:5432/spec',
  BETTER_AUTH_URL: 'http://127.0.0.1:3013',
  BETTER_AUTH_SECRET: 'spec-only-secret-at-least-thirty-two-characters',
  UNIAUTH_ISSUER: 'http://127.0.0.1:1/api/auth',
  UNIAUTH_CLIENT_ID: 'spec',
  UNIAUTH_CLIENT_SECRET: 'spec',
}))
  process.env[key] ||= value;

const { generateSpecs } = await import('hono-openapi');
const { app } = await import('../src/app.js');
const { specOptions } = await import('../src/openapi.js');

const spec = await generateSpecs(app, specOptions);
const target = fileURLToPath(
  new URL('../../web/openapi.json', import.meta.url),
);
writeFileSync(target, `${JSON.stringify(spec, null, 2)}\n`);
console.log(
  `Wrote ${Object.keys(spec.paths ?? {}).length} paths to apps/web/openapi.json`,
);
process.exit(0);
