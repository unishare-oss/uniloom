// Prints where to open Uniloom once the web app answers. Next.js prints localhost:3013,
// which breaks sign-in, so this line gives the right address. Used by `bun run dev:local`.
// Returns 0 when ready, 1 on timeout, so concurrently's --kill-others-on-fail stops a
// broken session instead of idling.
export const waitForReady = async (fetchImpl = fetch, budgetSeconds = 180) => {
  for (let second = 0; second < budgetSeconds; second++) {
    const login = await fetchImpl("http://127.0.0.1:3013/login").catch(
      () => null,
    );
    if (login?.ok) return 0;
    await Bun.sleep(1000);
  }
  return 1;
};

if (import.meta.main) {
  const code = await waitForReady();
  if (code === 0) {
    console.log("");
    console.log(
      "  Uniloom is ready. Open http://127.0.0.1:3013 in your browser.",
    );
    console.log(
      "  (Not the localhost:3013 address above: sign-in only works on 127.0.0.1.)",
    );
    console.log("  Press Ctrl+C here to stop everything.");
    console.log("");
  } else {
    console.log(
      "The web app didn't answer within 3 minutes. Look at the [web] and [api] lines above.",
    );
  }
  process.exit(code);
}
