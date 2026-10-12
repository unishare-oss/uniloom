import { Fragment } from "react";
import { priorityLabel, type Priority } from "@/components/items/item-meta";
import { StateLozenge } from "@/components/items/state-lozenge";
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

/** What one change of an update says: "priority Medium → High", "the description". */
const describe = (change: Change) => {
  if (change.field === "description") return "edited the description";
  return `changed ${change.field} ${show(change, change.from)} → ${show(change, change.to)}`;
};

/** The words after the name: "moved it", "ticked 'It works'". */
export const ActivitySentence = ({ row }: { row: ListItemActivity200Item }) => {
  switch (row.action) {
    case "item.create":
      return row.detail.parent
        ? `created it under ${row.detail.parent}`
        : "created it";
    case "item.update":
      return row.detail.changes.map((change, i, all) => (
        <Fragment key={change.field}>
          {i > 0 && (i === all.length - 1 ? " and " : ", ")}
          {describe(change)}
        </Fragment>
      ));
    case "item.move":
      return (
        <>
          moved it <StateLozenge name={row.detail.from} /> →{" "}
          <StateLozenge name={row.detail.to} />
        </>
      );
    case "item.delete":
      return "deleted it";
    case "item.restore":
      return "restored it";
    case "checklist.add":
      return `added '${row.detail.text}' to the checklist`;
    case "checklist.edit":
      return `changed '${row.detail.from}' to '${row.detail.to}'`;
    case "checklist.tick":
      return `ticked '${row.detail.text}'`;
    case "checklist.untick":
      return `unticked '${row.detail.text}'`;
    case "checklist.remove":
      return `removed '${row.detail.text}' from the checklist`;
  }
};
