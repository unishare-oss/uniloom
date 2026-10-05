/** A `next` path to go to. Same-origin only: "https://…", "//…" and "/\…" would leave Uniloom. */
export const safeNext = (next: string | null) => {
  if (!next?.startsWith("/")) return "/";
  const { origin } = window.location;
  return new URL(next, origin).origin === origin ? next : "/";
};
