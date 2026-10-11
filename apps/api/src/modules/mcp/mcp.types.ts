/** Who is calling /mcp: the Uniloom user, and the OAuth client (the agent) from the token. */
export interface Agent {
  userId: string;
  clientId: string | null;
}
