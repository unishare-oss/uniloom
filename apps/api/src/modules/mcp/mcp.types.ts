/** Who is calling /mcp: the Uniloom user, and the OAuth client (the agent) and its name from the token. */
export interface Agent {
  userId: string;
  clientId: string | null;
  /** The client's registered name, self-declared: shown to people, never used for access. */
  clientName: string | null;
}
