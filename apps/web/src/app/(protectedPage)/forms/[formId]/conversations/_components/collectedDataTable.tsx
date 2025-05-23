import {
  getConversationTableData,
  renderCellValue,
} from "@/components/queryComponents/table/utils";
import { cn } from "@/lib/utils";
import type { Conversation } from "@convoform/db/src/schema";

import { Skeleton } from "@convoform/ui";
import { Table, TableBody, TableCell, TableRow } from "@convoform/ui";
type Props = {
  collectedData: Conversation["collectedData"];
};

export function CollectedDataTable({ collectedData }: Readonly<Props>) {
  const tableData = getConversationTableData(collectedData);
  const tableColumns = Object.keys(tableData);

  return (
    <Table className="font-light">
      <TableBody>
        {tableColumns.map((columnName, index) => {
          const value = tableData[columnName]?.value ?? "";
          const fieldConfig = tableData[columnName]?.config;
          return (
            <TableRow key={`${index}-${columnName}-${value}`}>
              <CollectedDataTableCell className="text-muted-foreground">
                {columnName}
              </CollectedDataTableCell>
              <CollectedDataTableCell>
                {renderCellValue(value, fieldConfig)}
              </CollectedDataTableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

CollectedDataTable.Skeleton = ({ rowsCount = 3 }: { rowsCount?: number }) => {
  return (
    <Table className="">
      <TableBody>
        {Array.from({ length: rowsCount }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
          <TableRow key={index}>
            <CollectedDataTableCell>
              <Skeleton className="h-4 w-full" />
            </CollectedDataTableCell>
            <CollectedDataTableCell>
              <Skeleton className="h-4 w-full" />
            </CollectedDataTableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

function CollectedDataTableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: HTMLTableCellElement["className"];
}) {
  return (
    <TableCell
      className={cn(
        "py-2 align-text-top whitespace-pre-line text-justify",
        className,
      )}
    >
      {children}
    </TableCell>
  );
}
