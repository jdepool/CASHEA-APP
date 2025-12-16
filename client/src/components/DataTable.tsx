import { useMemo, useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface TableRow {
  [key: string]: any;
}

interface DataTableProps {
  data: TableRow[];
  headers: string[];
}

export function DataTable({ data, headers }: DataTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
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

    // Check if this is a count column (not currency)
    const headerLower = header.toLowerCase();
    if (headerLower.includes('numero de cuotas') || headerLower.includes('# cuotas')) {
      return new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.round(value));
    }

    if (typeof value === 'number' && (
      headerLower.includes('venta') || 
      headerLower.includes('cuota') ||
      headerLower.includes('pagado') ||
      headerLower.includes('pago inicial')
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
           header.toLowerCase().includes('pagado') ||
           header.toLowerCase().includes('pago inicial');
  };

  const handleSort = (header: string) => {
    if (sortColumn === header) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(header);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Handle dates
      if (sortColumn.toLowerCase().includes('fecha')) {
        const aDate = typeof aVal === 'number' ? excelDateToJSDate(aVal) : new Date(aVal);
        const bDate = typeof bVal === 'number' ? excelDateToJSDate(bVal) : new Date(bVal);
        
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
          return sortDirection === 'asc' 
            ? aDate.getTime() - bDate.getTime()
            : bDate.getTime() - aDate.getTime();
        }
      }

      // Handle numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Handle strings
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [data, sortColumn, sortDirection]);

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
                onClick={() => handleSort(header)}
                className={`px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide border-b whitespace-nowrap cursor-pointer hover-elevate ${
                  isNumericColumn(header) ? 'text-right' : ''
                } ${idx === 0 ? 'sticky left-0 z-20 bg-muted' : ''}`}
                data-testid={`header-${idx}`}
              >
                <div className={`flex items-center gap-1 ${isNumericColumn(header) ? 'justify-end' : 'justify-start'}`}>
                  <span>{header}</span>
                  {sortColumn === header ? (
                    sortDirection === 'asc' ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-40" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIdx) => (
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
