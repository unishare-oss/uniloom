import { createAuthClient } from "better-auth/react";

// Same origin: the web app proxies /api to the API (next.config.ts).
export const authClient = createAuthClient();
