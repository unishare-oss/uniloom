/** What Uniloom is. The proxy shows it at `/` to signed-out visitors. */
const Landing = () => {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-6 px-6 py-16">
      <span className="inline-flex w-fit rounded-full border px-3 py-1 text-sm font-medium">
        Uniloom
      </span>
      <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
        Slices are threads. Features are the fabric.
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        A work tracker for building software with a coding agent. Agree the
        design, then review what was built against it.
      </p>
    </main>
  );
};

export default Landing;
