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
  joinApproval,
}: {
  invitedBy: string | null;
  projectName: string;
  url: string;
  expiresAt: string;
  joinApproval: boolean;
}) => {
  const opening = invitedBy
    ? `${invitedBy} invited you to join ${projectName} on Uniloom.`
    : `You're invited to join ${projectName} on Uniloom.`;
  const approval = joinApproval
    ? "\nAn owner or manager approves each request."
    : "";
  return `${opening}\n${url}\nThis link expires ${timeAgo(expiresAt)}.${approval}`;
};

/** Requests outlive their link: said in the dialogs that replace or delete one. */
export const waitingNote = (waiting: number) => {
  if (waiting === 0) return "";
  return waiting === 1
    ? " The 1 join request stays in the list."
    : ` The ${waiting} join requests stay in the list.`;
};
