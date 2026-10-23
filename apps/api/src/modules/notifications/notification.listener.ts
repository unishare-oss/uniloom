import { Client } from 'pg';

const CHANNEL = 'notification_changed';

/** Every open stream, by the user it belongs to. A stream is just the function that tells it "changed". */
const streams = new Map<string, Set<() => void>>();

/** Adds a stream for this user and returns the function that removes it. */
export const registerStream = (userId: string, send: () => void) => {
  const sends = streams.get(userId) ?? new Set<() => void>();
  sends.add(send);
  streams.set(userId, sends);
  return () => {
    sends.delete(send);
    if (sends.size === 0 && streams.get(userId) === sends)
      streams.delete(userId);
  };
};

/** Tells every open stream of this user that their notifications changed. */
export const signalUser = (userId: string) => {
  for (const send of streams.get(userId) ?? []) send();
};

const signalEveryone = () => {
  for (const sends of streams.values()) for (const send of sends) send();
};

/**
 * One connection per API process listens for `notification_changed`; its payload is the
 * recipient's user id. Streams never hold a database connection. Returns the stop function.
 */
export const startNotificationListener = () => {
  let client: Client | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let failures = 0;
  let connectedAt = 0;

  const reconnect = () => {
    if (stopped || timer) return;
    // Only a connection that stayed up for a minute resets the backoff, so one that drops
    // right after LISTEN doesn't retry every second.
    if (connectedAt && Date.now() - connectedAt > 60_000) failures = 0;
    connectedAt = 0;
    client?.removeAllListeners();
    client?.on('error', () => undefined);
    void client?.end().catch(() => undefined);
    client = null;
    failures++;
    timer = setTimeout(
      () => {
        timer = null;
        void connect();
      },
      Math.min(1_000 * 2 ** (failures - 1), 30_000),
    );
  };

  const connect = async () => {
    const next = new Client({ connectionString: process.env.DATABASE_URL });
    client = next;
    next.on('notification', (message) => {
      if (message.payload) signalUser(message.payload);
    });
    next.on('error', reconnect);
    next.on('end', reconnect);
    try {
      await next.connect();
      await next.query(`LISTEN ${CHANNEL}`);
      connectedAt = Date.now();
      // Signals sent while the connection was down are lost, so every stream catches up.
      signalEveryone();
    } catch {
      reconnect();
    }
  };

  void connect();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    client?.removeAllListeners();
    client?.on('error', () => undefined);
    void client?.end().catch(() => undefined);
  };
};
