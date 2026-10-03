import React from "react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  align?: "right" | "center" | "left";
  dir?: "rtl" | "ltr";
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  caption?: string;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  caption,
  className = "",
}: DataTableProps<T>) {
  return (
    <div className={`ho-table-container ${className}`}>
      <table className="ho-data-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`ho-th ho-th-${col.align || "right"}`}
                dir={col.dir}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="ho-td-empty">
                لا توجد بيانات متاحة
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr key={keyExtractor(item)} className="ho-tr">
                {columns.map((col) => {
                  const val = (item as Record<string, unknown>)[col.key];
                  return (
                    <td
                      key={col.key}
                      className={`ho-td ho-td-${col.align || "right"}`}
                      dir={col.dir}
                    >
                      {col.render ? col.render(item) : (val !== null && val !== undefined ? String(val) : "—")}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
