import type { ReactNode } from "react";

/** A table that scrolls sideways on small screens. Cells may hold any content. */
export const GuideTable = ({
  head,
  rows,
}: {
  head: string[];
  rows: ReactNode[][];
}) => {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {head.map((title, index) => (
              <th key={index} className="px-4 py-3 font-medium">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex} className="border-b align-top last:border-b-0">
              {cells.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-4 py-3 ${cellIndex === 0 ? "font-medium" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
