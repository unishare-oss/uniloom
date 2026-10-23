"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getGetNotificationsQueryKey } from "@/lib/api/generated/notifications/notifications";
import { getGetReviewsQueryKey } from "@/lib/api/generated/reviews/reviews";

/**
 * Keeps one server-sent-events stream open while the user is signed in and has consented.
 * The stream carries no data: on `ready` (first connect and every reconnect) and `changed`
 * it refetches the Inbox queries. EventSource reconnects by itself; a closed stream stays closed.
 */
export const useNotificationStream = (enabled: boolean) => {
  const client = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource("/api/notifications/stream");
    const refetch = () => {
      void client.invalidateQueries({ queryKey: getGetReviewsQueryKey() });
      void client.invalidateQueries({
        queryKey: getGetNotificationsQueryKey(),
      });
      void client.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("/api/notifications/items/"),
      });
    };
    source.addEventListener("ready", refetch);
    source.addEventListener("changed", refetch);
    return () => source.close();
  }, [enabled, client]);
};
