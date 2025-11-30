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

type DataTableProps&lt;TData, TValue&gt; = {
  columns: ColumnDef&lt;TData, TValue&gt;[];
  data: TData[];
  pageCount: number;
  totalRows: number;
  state: {
    pageIndex: number;
    pageSize: number;
  };
  onStateChange: (state: { pageIndex: number; pageSize: number }) =&gt; void;
  isLoading?: boolean;
  onBulkAction?: (selectedRows: TData[]) =&gt; void;
};

export function DataTable&lt;TData, TValue&gt;(props: DataTableProps&lt;TData, TValue&gt;) {
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

  const [sorting, setSorting] = React.useState&lt;SortingState&gt;([]);
  const [columnVisibility, setColumnVisibility] = React.useState&lt;VisibilityState&gt;({});
  const [rowSelection, setRowSelection] = React.useState&lt;RowSelectionState&gt;({});

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
    onPaginationChange: (updater) =&gt; {
      const next =
        typeof updater === 'function' ? updater(state) : updater;
      onStateChange(next);
    },
  });

  const selectedRows = React.useMemo(
    () =&gt; table.getSelectedRowModel().rows.map((r) =&gt; r.original),
    [table, rowSelection]
  );

  return (
    &lt;div className="space-y-4"&gt;
      &lt;div className="flex items-center justify-between"&gt;
        &lt;div className="flex items-center gap-2"&gt;
          &lt;span className="text-sm text-muted-foreground"&gt;
            Total: {totalRows.toLocaleString()}
          &lt;/span&gt;
        &lt;/div&gt;
        &lt;div className="flex items-center gap-2"&gt;
          &lt;span className="text-xs text-muted-foreground"&gt;Columns:&lt;/span&gt;
          {table
            .getAllLeafColumns()
            .filter((column) =&gt; column.getCanHide())
            .map((column) =&gt; (
              &lt;label
                key={column.id}
                className="flex items-center gap-1 text-xs text-muted-foreground"
              &gt;
                &lt;input
                  type="checkbox"
                  checked={column.getIsVisible()}
                  onChange={(e) =&gt; column.toggleVisibility(e.target.checked)}
                /&gt;
                {column.id}
              &lt;/label&gt;
            ))}
        &lt;/div&gt;
      &lt;/div&gt;

      &lt;div className="relative rounded-lg bg-background shadow-neo"&gt;
        &lt;table className="w-full border-collapse text-sm"&gt;
          &lt;thead className="bg-muted/60"&gt;
            {table.getHeaderGroups().map((headerGroup) =&gt; (
              &lt;tr key={headerGroup.id}&gt;
                {headerGroup.headers.map((header) =&gt; (
                  &lt;th
                    key={header.id}
                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                  &gt;
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  &lt;/th&gt;
                ))}
              &lt;/tr&gt;
            ))}
          &lt;/thead&gt;
          &lt;tbody&gt;
            {isLoading ? (
              &lt;tr&gt;
                &lt;td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                &gt;
                  Loading...
                &lt;/td&gt;
              &lt;/tr&gt;
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) =&gt; (
                &lt;tr
                  key={row.id}
                  className={cn(
                    'border-b last:border-none transition-colors',
                    row.getIsSelected()
                      ? 'bg-primary/5'
                      : 'hover:bg-muted/40'
                  )}
                &gt;
                  {row.getVisibleCells().map((cell) =&gt; (
                    &lt;td key={cell.id} className="px-3 py-2"&gt;
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    &lt;/td&gt;
                  ))}
                &lt;/tr&gt;
              ))
            ) : (
              &lt;tr&gt;
                &lt;td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                &gt;
                  No results.
                &lt;/td&gt;
              &lt;/tr&gt;
            )}
          &lt;/tbody&gt;
        &lt;/table&gt;

        {selectedRows.length &gt; 0 &amp;&amp; (
          &lt;div className="pointer-events-auto fixed inset-x-0 bottom-4 z-20 mx-auto flex max-w-xl items-center justify-between rounded-full bg-card px-4 py-2 shadow-neo"&gt;
            &lt;div className="flex items-center gap-2"&gt;
              &lt;Checkbox
                checked={table.getIsAllPageRowsSelected()}
                onCheckedChange={(value) =&gt;
                  table.toggleAllPageRowsSelected(!!value)
                }
              /&gt;
              &lt;span className="text-sm"&gt;
                {selectedRows.length} selected
              &lt;/span&gt;
            &lt;/div&gt;
            &lt;div className="flex items-center gap-2"&gt;
              {onBulkAction &amp;&amp; (
                &lt;Button
                  size="sm"
                  variant="default"
                  onClick={() =&gt; onBulkAction(selectedRows)}
                &gt;
                  Apply Bulk Action
                &lt;/Button&gt;
              )}
            &lt;/div&gt;
          &lt;/div&gt;
        )}
      &lt;/div&gt;

      &lt;div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"&gt;
        &lt;div className="flex items-center gap-2"&gt;
          &lt;Button
            size="sm"
            variant="outline"
            disabled={!table.getCanPreviousPage()}
            onClick={() =&gt; table.previousPage()}
          &gt;
            Previous
          &lt;/Button&gt;
          &lt;Button
            size="sm"
            variant="outline"
            disabled={!table.getCanNextPage()}
            onClick={() =&gt; table.nextPage()}
          &gt;
            Next
          &lt;/Button&gt;
        &lt;/div&gt;
        &lt;div className="flex items-center gap-2"&gt;
          &lt;span&gt;
            Page {state.pageIndex + 1} of {pageCount}
          &lt;/span&gt;
          &lt;select
            className="rounded-md border bg-background px-2 py-1"
            value={state.pageSize}
            onChange={(e) =&gt;
              table.setPageSize(Number(e.target.value))
            }
          &gt;
            {[10, 25, 50, 100].map((size) =&gt; (
              &lt;option key={size} value={size}&gt;
                {size} / page
              &lt;/option&gt;
            ))}
          &lt;/select&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  );
}