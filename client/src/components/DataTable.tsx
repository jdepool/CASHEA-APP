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
  const formatValue = (value: any, header: string, row?: TableRow) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    if (header.toLowerCase().includes("estado")) {
      // Check if this is a payment installment status (e.g., "Estado cuota 1")
      const match = header.match(/Estado cuota (\d+)/i);
      const isDone = String(value).toLowerCase() === 'done';
      
      if (match && isDone && row) {
        const cuotaNumber = match[1];
        const fechaPagoKey = `Fecha de pago cuota ${cuotaNumber}`;
        const fechaPago = row[fechaPagoKey];
        
        if (fechaPago) {
          const dateValue = typeof fechaPago === 'number' 
            ? excelDateToJSDate(fechaPago) 
            : new Date(fechaPago);
          
          if (!isNaN(dateValue.getTime())) {
            const formattedDate = dateValue.toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
            
            return (
              <div className="flex flex-col gap-1">
                <StatusBadge status={String(value)} />
                <span className="text-xs text-muted-foreground">
                  Pagado: {formattedDate}
                </span>
              </div>
            );
          }
        }
      }
      
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
    <div className="relative w-full border rounded-md overflow-auto" style={{ maxHeight: '70vh' }}>
      <table className="w-full border-collapse text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <thead className="sticky top-0 z-10 bg-muted shadow-sm">
          <tr>
            {headers.map((header, idx) => (
              <th
                key={idx}
                className={`px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide border-b whitespace-nowrap ${
                  isNumericColumn(header) ? 'text-right' : ''
                } ${idx === 0 ? 'sticky left-0 z-20 bg-muted' : ''}`}
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
                  } ${colIdx === 0 ? 'sticky left-0 z-10' : ''} ${
                    rowIdx % 2 === 0 ? 'bg-background' : 'bg-card'
                  }`}
                  data-testid={`cell-${rowIdx}-${colIdx}`}
                >
                  {formatValue(row[header], header, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
