import { useMemo } from "react";
import { StatusBadge } from "./StatusBadge";

interface TableRow {
  [key: string]: any;
}

interface DataTableProps {
  data: TableRow[];
  headers: string[];
}

export function DataTable({ data, headers }: DataTableProps) {
  const formatValue = (value: any, header: string) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    if (header.toLowerCase().includes("estado")) {
      return <StatusBadge status={String(value)} />;
    }

    if (header.toLowerCase().includes("fecha") && value) {
      const dateValue = typeof value === 'number' 
        ? excelDateToJSDate(value) 
        : new Date(value);
      
      if (!isNaN(dateValue.getTime())) {
        return dateValue.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
    }

    if (typeof value === 'number' && (
      header.toLowerCase().includes('venta') || 
      header.toLowerCase().includes('cuota') ||
      header.toLowerCase().includes('pagado')
    )) {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'USD'
      }).format(value);
    }

    return String(value);
  };

  const excelDateToJSDate = (serial: number) => {
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    return dateInfo;
  };

  const isNumericColumn = (header: string) => {
    return header.toLowerCase().includes('venta') || 
           header.toLowerCase().includes('cuota') ||
           header.toLowerCase().includes('pagado');
  };

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No hay datos para mostrar
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-auto border rounded-md">
      <table className="w-full border-collapse text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead className="sticky top-0 z-10 bg-muted">
          <tr>
            {headers.map((header, idx) => (
              <th
                key={idx}
                className={`px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide border-b whitespace-nowrap ${
                  isNumericColumn(header) ? 'text-right' : ''
                } ${idx < 2 ? 'sticky left-0 z-20 bg-muted' : ''}`}
                style={idx === 0 ? { left: 0 } : idx === 1 ? { left: '120px' } : {}}
                data-testid={`header-${idx}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-b hover-elevate"
              data-testid={`row-${rowIdx}`}
            >
              {headers.map((header, colIdx) => (
                <td
                  key={colIdx}
                  className={`px-4 py-3 whitespace-nowrap ${
                    isNumericColumn(header) ? 'text-right' : ''
                  } ${colIdx < 2 ? 'sticky left-0 z-10 bg-background' : ''} ${
                    rowIdx % 2 === 0 ? 'bg-background' : 'bg-card'
                  }`}
                  style={colIdx === 0 ? { left: 0 } : colIdx === 1 ? { left: '120px' } : {}}
                  data-testid={`cell-${rowIdx}-${colIdx}`}
                >
                  {formatValue(row[header], header)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
