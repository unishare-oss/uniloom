export interface UniauthEvent {
  sub: string;
  data: Record<string, unknown>;
}

export type EventVerifier = (
  token: string,
  event: string,
) => Promise<UniauthEvent | null>;
