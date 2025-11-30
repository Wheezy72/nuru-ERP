import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  SortingState,
  VisibilityState,
  RowSelectionState,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageCount: number;
  totalRows: number;
  state: {
    pageIndex: number;
    pageSize: number;
  };
  onStateChange: (state: { pageIndex: number; pageSize: number }) => void;
  isLoading?: boolean;
  onBulkAction?: (selectedRows: TData[]) => void;
};

export function DataTable<TData, TValue>(props: DataTableProps<TData, TValue>) {
  const {
    columns,
    data,
    pageCount,
    totalRows,
    state,
    onStateChange,
    isLoading,
    onBulkAction,
  } = props;

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      pagination: state,
    },
    pageCount,
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater(state) : updater;
      onStateChange(next);
    },
  });

  const selectedRows = React.useMemo(
    () => table.getSelectedRowModel().rows.map((r) => r.original),
    [table, rowSelection]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Total: {totalRows.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Columns:</span>
          {table
            .getAllLeafColumns()
            .filter((column) => column.getCanHide())
            .map((column) => (
              <label
                key={column.id}
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                <input
                  type="checkbox"
                  checked={column.getIsVisible()}
                  onChange={(e) => column.toggleVisibility(e.target.checked)}
                />
                {column.id}
              </label>
            ))}
        </div>
      </div>

      <div className="relative rounded-lg bg-background shadow-neo">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/60">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  Loading...
                </td>
              </tr>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b last:border-none transition-colors',
                    row.getIsSelected()
                      ? 'bg-primary/5'
                      : 'hover:bg-muted/40'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  No results.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {selectedRows.length > 0 && (
          <div className="pointer-events-auto fixed inset-x-0 bottom-4 z-20 mx-auto flex max-w-xl items-center justify-between rounded-full bg-card px-4 py-2 shadow-neo">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={table.getIsAllPageRowsSelected()}
                onCheckedChange={(value) =>
                  table.toggleAllPageRowsSelected(!!value)
                }
              />
              <span className="text-sm">
                {selectedRows.length} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onBulkAction && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onBulkAction(selectedRows)}
                >
                  Apply Bulk Action
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Next
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span>
            Page {state.pageIndex + 1} of {pageCount}
          </span>
          <select
            className="rounded-md border bg-background px-2 py-1"
            value={state.pageSize}
            onChange={(e) =>
              table.setPageSize(Number(e.target.value))
            }
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}