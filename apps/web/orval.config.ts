import { defineConfig } from "orval";

// Typed fetch functions and TanStack Query hooks from the API's OpenAPI spec
// (apps/web/openapi.json, written by `bun run api:spec`). Regenerate with
// `bun run api:generate`; the output is not committed.
export default defineConfig({
  uniloom: {
    input: { target: "./openapi.json" },
    output: {
      mode: "tags-split",
      target: "src/lib/api/generated",
      client: "react-query",
      httpClient: "fetch",
      override: {
        mutator: { path: "./src/lib/api/fetcher.ts", name: "customFetch" },
      },
    },
  },
});
