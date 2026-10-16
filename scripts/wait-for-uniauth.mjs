// Waits until the local uniAuth answers, so the API (which checks uniAuth once when it
// starts) doesn't start too early. Used by `bun run dev:local`.
const discovery =
  "http://localhost:3002/api/auth/.well-known/openid-configuration";

for (let second = 0; second < 120; second++) {
  const response = await fetch(discovery).catch(() => null);
  if (response?.ok) process.exit(0);
  await Bun.sleep(1000);
}
console.log(
  "uniAuth didn't start within 2 minutes. Look at the [uniauth] lines above.",
);
process.exit(1);
