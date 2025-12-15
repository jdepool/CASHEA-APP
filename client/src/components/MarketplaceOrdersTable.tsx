import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { parseDDMMYYYY, parseExcelDate } from "@/lib/dateUtils";
import { MarketplaceDashboard } from "@/components/MarketplaceDashboard";
import { Badge } from "@/components/ui/badge";
import { verifyInBankStatements } from "@/lib/verificationUtils";

interface TableRow {
  [key: string]: any;
}

interface MarketplaceOrdersTableProps {
  data: TableRow[];
  headers: string[];
  fileName?: string;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  dateFrom: string;
  setDateFrom: (date: string) => void;
  dateTo: string;
  setDateTo: (date: string) => void;
  estadoFilter: string;
  setEstadoFilter: (estado: string) => void;
  ordenFilter: string;
  setOrdenFilter: (orden: string) => void;
  estadoEntregaFilter: string;
  setEstadoEntregaFilter: (estado: string) => void;
  referenciaFilter: string;
  setReferenciaFilter: (ref: string) => void;
  masterDateFrom?: string;
  masterDateTo?: string;
  masterOrden?: string;
  masterTienda?: string;
  uniqueTiendas?: string[];
  bankStatementRows?: any[];
  bankStatementHeaders?: string[];
}

type SortDirection = 'asc' | 'desc' | null;

export function MarketplaceOrdersTable({ 
  data, 
  headers, 
  fileName,
  showFilters,
  setShowFilters,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  estadoFilter,
  setEstadoFilter,
  ordenFilter,
  setOrdenFilter,
  estadoEntregaFilter,
  setEstadoEntregaFilter,
  referenciaFilter,
  setReferenciaFilter,
  masterDateFrom,
  masterDateTo,
  masterOrden,
  masterTienda,
  uniqueTiendas = [],
  bankStatementRows = [],
  bankStatementHeaders = []
}: MarketplaceOrdersTableProps) {
  const { toast } = useToast();
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Find the column names (case-insensitive)
  const findColumn = (name: string) => {
    return headers.find(h => h.toLowerCase().includes(name.toLowerCase())) || name;
  };

  const estadoColumn = findColumn("estado pago");
  const ordenColumn = findColumn("# orden") || findColumn("orden");
  const estadoEntregaColumn = findColumn("estado de entrega") || findColumn("entrega");
  const referenciaColumn = findColumn("# referencia") || findColumn("referencia");
  const montoColumn = findColumn("monto en bs");
  // Find any date column - prioritize common names
  const dateColumn = findColumn("fecha") || findColumn("date") || headers.find(h => h.toLowerCase().includes("fecha"));

  // Create extended headers array with VERIFICACION column
  const extendedHeaders = useMemo(() => {
    const referenciaIndex = headers.findIndex(h => 
      h.toLowerCase().includes('referencia')
    );
    
    if (referenciaIndex === -1) {
      // If no referencia column, just append VERIFICACION at the end
      return [...headers, 'VERIFICACION'];
    }
    
    // Insert VERIFICACION after # Referencia
    const newHeaders = [...headers];
    newHeaders.splice(referenciaIndex + 1, 0, 'VERIFICACION');
    return newHeaders;
  }, [headers]);

  // Create extended data array with verification values and deduplication
  const extendedData = useMemo(() => {
    // First, add verification values
    const withVerification = data.map(row => {
      const reference = row[referenciaColumn];
      const amount = row[montoColumn];
      
      const verificacion = verifyInBankStatements(
        {
          reference: reference,
          amountVES: amount,
          amountUSD: null, // Marketplace orders only have Monto en Bs
        },
        bankStatementRows,
        bankStatementHeaders
      );
      
      const extendedRow: TableRow = {
        ...row,
        VERIFICACION: verificacion
      };
      return extendedRow;
    });

    // Then, deduplicate by order number (keep first occurrence)
    if (withVerification.length === 0) return [];
    
    const seenOrdens = new Map<string, any>();
    withVerification.forEach((row: any) => {
      const ordenValue = String(row[ordenColumn] || '').trim();
      if (ordenValue && !seenOrdens.has(ordenValue)) {
        seenOrdens.set(ordenValue, row);
      }
    });
    
    return Array.from(seenOrdens.values());
  }, [data, referenciaColumn, montoColumn, ordenColumn, bankStatementRows, bankStatementHeaders]);

  // Get unique values for dropdowns
  const uniqueEstados = useMemo(() => {
    const estados = new Set<string>();
    extendedData.forEach(row => {
      const estado = row[estadoColumn];
      if (estado) estados.add(String(estado));
    });
    return Array.from(estados).sort();
  }, [extendedData, estadoColumn]);

  const uniqueEstadosEntrega = useMemo(() => {
    const estados = new Set<string>();
    extendedData.forEach(row => {
      const estado = row[estadoEntregaColumn];
      if (estado) estados.add(String(estado));
    });
    return Array.from(estados).sort();
  }, [extendedData, estadoEntregaColumn]);

  // Apply filters
  const filteredData = useMemo(() => {
    return extendedData.filter(row => {
      // MASTER FILTERS - Applied FIRST
      // Master date filter
      if (dateColumn && (masterDateFrom || masterDateTo)) {
        const rowDate = row[dateColumn];
        if (rowDate) {
          let rowDateObj: Date | null = null;
          if (typeof rowDate === 'string') {
            const parsedDate = parseDDMMYYYY(rowDate);
            if (parsedDate) {
              rowDateObj = parsedDate;
            } else {
              rowDateObj = new Date(rowDate);
              if (isNaN(rowDateObj.getTime())) {
                rowDateObj = null;
              }
            }
          } else if (rowDate instanceof Date) {
            rowDateObj = rowDate;
          } else if (typeof rowDate === 'number') {
            const excelDate = parseExcelDate(rowDate);
            if (excelDate) {
              rowDateObj = excelDate;
            } else {
              rowDateObj = new Date(rowDate);
            }
          }

          if (rowDateObj && !isNaN(rowDateObj.getTime())) {
            if (masterDateFrom) {
              const fromDate = parseDDMMYYYY(masterDateFrom);
              if (fromDate && rowDateObj < fromDate) return false;
            }
            if (masterDateTo) {
              const toDate = parseDDMMYYYY(masterDateTo);
              if (toDate) {
                const endOfDay = new Date(toDate);
                endOfDay.setHours(23, 59, 59, 999);
                if (rowDateObj > endOfDay) return false;
              }
            }
          }
        }
      }

      // Master orden filter
      if (masterOrden) {
        const rowOrden = String(row[ordenColumn] || "").toLowerCase();
        if (!rowOrden.includes(masterOrden.toLowerCase())) return false;
      }

      // Master tienda filter - match directly against TIENDA column
      if (masterTienda && masterTienda !== 'all') {
        const tiendaColumn = headers.find((h: string) => h.toLowerCase() === 'tienda');
        if (tiendaColumn) {
          const rowTienda = String(row[tiendaColumn] || '').trim();
          if (rowTienda !== masterTienda) return false;
        }
      }

      // TAB-SPECIFIC FILTERS - Applied AFTER master filters
      // Date filter (if date column exists) - only apply if master date filters are NOT active
      if (dateColumn && (dateFrom || dateTo) && !masterDateFrom && !masterDateTo) {
        const rowDate = row[dateColumn];
        if (rowDate) {
          // Try to parse the row date
          let rowDateObj: Date | null = null;
          if (typeof rowDate === 'string') {
            // Try DD/MM/YYYY format first
            const parsedDate = parseDDMMYYYY(rowDate);
            if (parsedDate) {
              rowDateObj = parsedDate;
            } else {
              // Try standard Date parsing
              rowDateObj = new Date(rowDate);
              if (isNaN(rowDateObj.getTime())) {
                rowDateObj = null;
              }
            }
          } else if (rowDate instanceof Date) {
            rowDateObj = rowDate;
          } else if (typeof rowDate === 'number') {
            // Handle Excel serial numbers
            const excelDate = parseExcelDate(rowDate);
            if (excelDate) {
              rowDateObj = excelDate;
            } else {
              // Fallback to timestamp
              rowDateObj = new Date(rowDate);
            }
          }

          if (rowDateObj && !isNaN(rowDateObj.getTime())) {
            if (dateFrom) {
              const fromDate = parseDDMMYYYY(dateFrom);
              if (fromDate && rowDateObj < fromDate) return false;
            }
            if (dateTo) {
              const toDate = parseDDMMYYYY(dateTo);
              if (toDate) {
                // Set toDate to end of day (23:59:59.999) to include all records on that day
                const endOfDay = new Date(toDate);
                endOfDay.setHours(23, 59, 59, 999);
                if (rowDateObj > endOfDay) return false;
              }
            }
          }
        }
      }

      // Estado filter
      if (estadoFilter !== "all") {
        const rowEstado = String(row[estadoColumn] || "");
        if (rowEstado !== estadoFilter) return false;
      }

      // Orden filter - only apply if master orden filter is NOT active
      if (ordenFilter && !masterOrden) {
        const rowOrden = String(row[ordenColumn] || "").toLowerCase();
        if (!rowOrden.includes(ordenFilter.toLowerCase())) return false;
      }

      // Estado de entrega filter
      if (estadoEntregaFilter !== "all") {
        const rowEstadoEntrega = String(row[estadoEntregaColumn] || "");
        if (rowEstadoEntrega !== estadoEntregaFilter) return false;
      }

      // Referencia filter
      if (referenciaFilter) {
        const rowReferencia = String(row[referenciaColumn] || "").toLowerCase();
        if (!rowReferencia.includes(referenciaFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [extendedData, dateFrom, dateTo, estadoFilter, ordenFilter, estadoEntregaFilter, referenciaFilter, dateColumn, estadoColumn, ordenColumn, estadoEntregaColumn, referenciaColumn, masterDateFrom, masterDateTo, masterOrden]);

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
    if (!sortColumn || !sortDirection) return filteredData;

    return [...filteredData].sort((a, b) => {
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
  }, [filteredData, sortColumn, sortDirection]);

  const formatValue = (value: any, header: string) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    const headerLower = header.toLowerCase();

    // Check if this is a Referencia column - prevent scientific notation
    if (headerLower.includes('referencia')) {
      const valueStr = String(value);
      // Check if it's in scientific notation
      if (valueStr.includes('E') || valueStr.includes('e')) {
        // Convert scientific notation to full number
        // Reference numbers should be integers, use round to handle floating point errors
        try {
          const scientificValue = Number(valueStr);
          if (!isNaN(scientificValue) && Math.abs(scientificValue) < Number.MAX_SAFE_INTEGER) {
            // For safe integers, round and convert to string
            // Use round instead of floor to handle floating point representation errors
            return Math.round(scientificValue).toString();
          } else {
            // For very large numbers, keep original
            return valueStr;
          }
        } catch (e) {
          return valueStr;
        }
      }
      return valueStr;
    }

    // Format dates
    if (headerLower.includes("fecha") && value) {
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
      headerLower.includes('total') || 
      headerLower.includes('usd') ||
      headerLower.includes('monto') ||
      headerLower.includes('bs')
    )) {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: headerLower.includes('bs') ? 'VES' : 'USD'
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

  const hasActiveFilters = dateFrom !== "" || dateTo !== "" || estadoFilter !== "all" || ordenFilter !== "" || estadoEntregaFilter !== "all" || referenciaFilter !== "";

  const handleClearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setEstadoFilter("all");
    setOrdenFilter("");
    setEstadoEntregaFilter("all");
    setReferenciaFilter("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Marketplace Orders</h3>
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters && sortedData.length !== extendedData.length ? (
              <>
                {sortedData.length} de {extendedData.length} {extendedData.length === 1 ? 'registro' : 'registros'}
              </>
            ) : (
              <>
                {sortedData.length} {sortedData.length === 1 ? 'registro' : 'registros'}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
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
      </div>

      {showFilters && (
        <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Desde (DD/MM/YYYY)</label>
              <DatePicker
                id="marketplace-date-from"
                value={dateFrom}
                onChange={setDateFrom}
                placeholder="DD/MM/YYYY"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Hasta (DD/MM/YYYY)</label>
              <DatePicker
                id="marketplace-date-to"
                value={dateTo}
                onChange={setDateTo}
                placeholder="DD/MM/YYYY"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger data-testid="select-estado-filter">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueEstados.map((estado) => (
                    <SelectItem key={estado} value={estado}>
                      {estado}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Orden</label>
              <Input
                type="text"
                placeholder="Filtrar por orden..."
                value={ordenFilter}
                onChange={(e) => setOrdenFilter(e.target.value)}
                data-testid="input-orden-filter"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Estado de Entrega</label>
              <Select value={estadoEntregaFilter} onValueChange={setEstadoEntregaFilter}>
                <SelectTrigger data-testid="select-estado-entrega-filter">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueEstadosEntrega.map((estado) => (
                    <SelectItem key={estado} value={estado}>
                      {estado}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium"># Referencia</label>
              <Input
                type="text"
                placeholder="Filtrar por referencia..."
                value={referenciaFilter}
                onChange={(e) => setReferenciaFilter(e.target.value)}
                data-testid="input-referencia-filter"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                data-testid="button-clear-filters"
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Dashboard */}
      <MarketplaceDashboard data={filteredData} headers={headers} />

      <div className="border rounded-lg overflow-auto" style={{ maxHeight: '70vh' }}>
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-muted shadow-sm">
            <tr className="border-b">
              {extendedHeaders.map((header, index) => (
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
                {extendedHeaders.map((header, colIndex) => (
                  <td 
                    key={colIndex} 
                    className="py-2 px-4 text-sm"
                    data-testid={`cell-${header.toLowerCase().replace(/\s+/g, '-')}-${rowIndex}`}
                  >
                    {header === 'VERIFICACION' ? (
                      <Badge 
                        variant={row[header] === 'SI' ? 'default' : 'secondary'}
                        className={row[header] === 'SI' ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        {row[header]}
                      </Badge>
                    ) : (
                      formatValue(row[header], header)
                    )}
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
