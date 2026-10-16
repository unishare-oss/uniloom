// Prints where to open Uniloom once the web app answers. Next.js prints localhost:3013,
// which breaks sign-in, so this line gives the right address. Used by `bun run dev:local`.
for (let second = 0; second < 180; second++) {
  const login = await fetch("http://127.0.0.1:3013/login").catch(() => null);
  if (login?.ok) {
    console.log("");
    console.log(
      "  Uniloom is ready. Open http://127.0.0.1:3013 in your browser.",
    );
    console.log(
      "  (Not the localhost:3013 address above: sign-in only works on 127.0.0.1.)",
    );
    console.log("  Press Ctrl+C here to stop everything.");
    console.log("");
    process.exit(0);
  }
  await Bun.sleep(1000);
}
console.log(
  "The web app didn't answer within 3 minutes. Look at the [web] and [api] lines above.",
);
