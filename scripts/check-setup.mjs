// Checks a local setup made with SETUP.md: uniAuth, the Uniloom API and web app, and a
// sign-in between them. Needs no install and runs the same on every OS:
//
//   bun run check:setup           # everything
//   bun run check:setup uniauth   # only uniAuth (before Uniloom runs)
const UNIAUTH = "http://localhost:3002";
const ISSUER = `${UNIAUTH}/api/auth`;
const API = "http://127.0.0.1:3011";
const WEB = "http://127.0.0.1:3013";

let failed = false;
const ok = (name, detail) => console.log(`OK    ${name}: ${detail}`);
const fail = (name, detail) => {
  failed = true;
  console.log(`FAIL  ${name}: ${detail}`);
};
// Next.js compiles a page on its first request, which can take a while.
const request = (url, init = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(90_000) }).catch(
    () => null,
  );

const discovery = await request(`${ISSUER}/.well-known/openid-configuration`);
const issuer = discovery?.ok ? (await discovery.json()).issuer : undefined;
if (!discovery)
  fail(
    "uniAuth",
    `nothing answers at ${UNIAUTH}. Start it with bun run uniauth:dev (SETUP.md step 7).`,
  );
else if (issuer !== ISSUER)
  fail(
    "uniAuth",
    `its issuer is ${issuer}, not ${ISSUER}. Check BETTER_AUTH_URL in uniAuth/apps/server/.env.`,
  );
else ok("uniAuth", `running at ${UNIAUTH}`);

if (process.argv[2] !== "uniauth") {
  const health = await request(`${API}/health`);
  if (health?.ok) ok("Uniloom API", `running at ${API}`);
  else
    fail(
      "Uniloom API",
      `nothing answers at ${API}. Start it (SETUP.md step 13) and read its terminal for errors.`,
    );

  const login = await request(`${WEB}/login`);
  if (login?.ok) ok("Uniloom web app", `running at ${WEB}`);
  else
    fail(
      "Uniloom web app",
      `nothing answers at ${WEB}. Start it (SETUP.md step 13) and read its terminal for errors.`,
    );

  // The first half of a sign-in, as the browser does it: Uniloom asks uniAuth to sign the
  // person in, and uniAuth accepts the client and its redirect.
  if (health?.ok && login?.ok && issuer === ISSUER) {
    const start = await request(`${WEB}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: WEB },
      body: JSON.stringify({ provider: "uniauth", callbackURL: "/" }),
    });
    const body = (await start?.json().catch(() => null)) ?? {};
    const authorize = body.url
      ? await request(body.url, { redirect: "manual" })
      : null;
    const next = authorize?.headers.get("location") ?? "";
    if (!body.url)
      fail(
        "Sign-in",
        `Uniloom couldn't start a sign-in (${start?.status}). Check uniloom/apps/api/.env.`,
      );
    else if (authorize && authorize.status < 400 && next.includes("/login"))
      ok("Sign-in", "uniAuth accepts Uniloom's client and redirect");
    else
      fail(
        "Sign-in",
        `uniAuth refused it: ${next || (await authorize?.text())?.slice(0, 200)}. Check the client id and secret, and that every Uniloom address is 127.0.0.1:3013.`,
      );
  }
}

process.exit(failed ? 1 : 0);
