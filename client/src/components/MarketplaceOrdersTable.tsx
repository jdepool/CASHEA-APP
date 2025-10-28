import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

interface TableRow {
  [key: string]: any;
}

interface MarketplaceOrdersTableProps {
  data: TableRow[];
  headers: string[];
  fileName?: string;
}

type SortDirection = 'asc' | 'desc' | null;

export function MarketplaceOrdersTable({ data, headers, fileName }: MarketplaceOrdersTableProps) {
  const { toast } = useToast();
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

      // Handle dates
      if (sortColumn.toLowerCase().includes('fecha')) {
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
          return sortDirection === 'asc' 
            ? aDate.getTime() - bDate.getTime()
            : bDate.getTime() - aDate.getTime();
        }
      }

      // Handle numbers
      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Handle strings
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      return sortDirection === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [data, sortColumn, sortDirection]);

  const formatValue = (value: any, header: string) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    // Format dates
    if (header.toLowerCase().includes("fecha") && value) {
      const dateValue = new Date(value);
      if (!isNaN(dateValue.getTime())) {
        return dateValue.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
    }

    // Format currency
    if (typeof value === 'number' && (
      header.toLowerCase().includes('total') || 
      header.toLowerCase().includes('usd') ||
      header.toLowerCase().includes('monto') ||
      header.toLowerCase().includes('bs')
    )) {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: header.toLowerCase().includes('bs') ? 'VES' : 'USD'
      }).format(value);
    }

    return String(value);
  };

  const handleExport = () => {
    if (sortedData.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(sortedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marketplace Orders");
    XLSX.writeFile(wb, `marketplace-orders-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Exportado",
      description: "Los datos se han exportado correctamente",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Marketplace Orders</h3>
          <p className="text-sm text-muted-foreground">
            {sortedData.length} {sortedData.length === 1 ? 'registro' : 'registros'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={sortedData.length === 0}
          data-testid="button-export-marketplace"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      <div className="border rounded-lg overflow-auto" style={{ maxHeight: '70vh' }}>
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-muted shadow-sm">
            <tr className="border-b">
              {headers.map((header, index) => (
                <th
                  key={index}
                  onClick={() => handleSort(header)}
                  className="text-left py-3 px-4 font-semibold text-sm cursor-pointer hover-elevate"
                  data-testid={`header-${header.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-center gap-1">
                    <span>{header}</span>
                    {sortColumn === header ? (
                      sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, rowIndex) => (
              <tr 
                key={rowIndex} 
                className="border-b hover-elevate"
                data-testid={`row-marketplace-${rowIndex}`}
              >
                {headers.map((header, colIndex) => (
                  <td 
                    key={colIndex} 
                    className="py-2 px-4 text-sm"
                    data-testid={`cell-${header.toLowerCase().replace(/\s+/g, '-')}-${rowIndex}`}
                  >
                    {formatValue(row[header], header)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
