import { Fragment } from "react";
import { ActivityState } from "@/components/items/activity-state";
import {
  priorityLabel,
  type Priority,
  type StateCategory,
} from "@/components/items/item-meta";
import type { ListItemActivity200Item } from "@/lib/api/generated/uniloomAPI.schemas";

type Change = Extract<
  ListItemActivity200Item,
  { action: "item.update" }
>["detail"]["changes"][number];

/** A priority code as the label people see; names and keys stay as they are. */
const show = (change: Change, value: string | null | undefined) => {
  if (!value) return "none";
  return change.field === "priority" ? priorityLabel(value as Priority) : value;
};

/** Quoted text (an entry's text) in the muted colour, so the action words stand out. */
const quoted = (text: string) => (
  <span className="text-muted-foreground">&ldquo;{text}&rdquo;</span>
);

const key = (text: string) => <span className="font-mono">{text}</span>;

/**
 * What one change of an update says. The assignee reads as people say it ("claimed it",
 * "assigned it to Ko"); other fields as "changed priority Medium → High".
 */
const describe = (change: Change, person: string) => {
  if (change.field === "description") return "edited the description";
  if (change.field === "assignee") {
    if (change.to === person && !change.from) return "claimed it";
    if (change.from === person && !change.to) return "unclaimed it";
    if (change.to) return `assigned it to ${change.to}`;
    return `unassigned ${change.from}`;
  }
  return (
    <>
      changed {change.field}{" "}
      <span className="text-muted-foreground">
        {show(change, change.from)} → {show(change, change.to)}
      </span>
    </>
  );
};

/** The words after the name: "moved it IN PROGRESS → IN REVIEW", "ticked "It works"". */
export const ActivitySentence = ({
  row,
  itemKey,
  states,
}: {
  row: ListItemActivity200Item;
  itemKey: string;
  states: { name: string; key: string | null; category: StateCategory }[];
}) => {
  const person = row.by.name ?? "Someone";
  switch (row.action) {
    case "item.create":
      return (
        <>
          created {key(itemKey)}
          {row.detail.parent && <> under {key(row.detail.parent)}</>}
        </>
      );
    case "item.update":
      return row.detail.changes.map((change, i, all) => (
        <Fragment key={change.field}>
          {i > 0 && (i === all.length - 1 ? " and " : ", ")}
          {describe(change, person)}
        </Fragment>
      ));
    case "item.move":
      return (
        <>
          moved it <ActivityState name={row.detail.from} states={states} />{" "}
          <span className="text-muted-foreground">→</span>{" "}
          <ActivityState name={row.detail.to} states={states} />
        </>
      );
    case "item.delete":
      return "deleted it";
    case "item.restore":
      return "restored it";
    case "checklist.add":
      return <>added {quoted(row.detail.text)} to the checklist</>;
    case "checklist.edit":
      return (
        <>
          changed {quoted(row.detail.from)} to {quoted(row.detail.to)}
        </>
      );
    case "checklist.tick":
      return <>ticked {quoted(row.detail.text)}</>;
    case "checklist.untick":
      return <>unticked {quoted(row.detail.text)}</>;
    case "checklist.remove":
      return <>removed {quoted(row.detail.text)} from the checklist</>;
    case "checklist.replace":
      return (
        <>
          set the done-when list{" "}
          <span className="text-muted-foreground">
            ({row.detail.count} {row.detail.count === 1 ? "entry" : "entries"})
          </span>
        </>
      );
  }
};
