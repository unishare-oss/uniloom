import { timeAgo } from "@/lib/time";

/**
 * The text behind "Copy invite message". The time left is worked out now, so a link
 * copied five hours before it expires says so.
 */
export const inviteMessage = ({
  invitedBy,
  projectName,
  url,
  expiresAt,
}: {
  invitedBy: string | null;
  projectName: string;
  url: string;
  expiresAt: string;
}) => {
  const opening = invitedBy
    ? `${invitedBy} invited you to join ${projectName} on Uniloom.`
    : `You're invited to join ${projectName} on Uniloom.`;
  return `${opening}\n${url}\nThis link expires ${timeAgo(expiresAt)}.`;
};
