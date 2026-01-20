import React, { useState, useMemo } from "react";
import { FileSpreadsheet, Download, ChevronUp, ChevronDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { parseExcelDate, parseDDMMYYYY } from "@/lib/dateUtils";
import { Badge } from "@/components/ui/badge";

interface BankStatementsTableProps {
  masterDateFrom?: string;
  masterDateTo?: string;
  masterOrden?: string;
  masterTienda?: string;
  ordenToTiendaMap?: Map<string, string>;
  // Pre-processed data from Home.tsx to avoid recalculation on tab switch
  preProcessedBankData?: {
    headers: string[];
    rows: any[];
    extendedHeaders: string[];
  };
}

type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  column: string | null;
  direction: SortDirection;
}

export const BankStatementsTable = React.memo(function BankStatementsTable({
  masterDateFrom = "",
  masterDateTo = "",
  masterOrden = "",
  masterTienda = "",
  ordenToTiendaMap = new Map(),
  preProcessedBankData,
}: BankStatementsTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: null, direction: null });
  const [showFilters, setShowFilters] = useState(false);
  const [referenciaFilter, setReferenciaFilter] = useState("");
  const { toast } = useToast();

  // Use pre-processed data from Home.tsx (avoids recalculation on tab switch)
  const headers = useMemo(() => {
    return preProcessedBankData?.headers || [];
  }, [preProcessedBankData]);

  const extendedHeaders = useMemo(() => {
    return preProcessedBankData?.extendedHeaders || [];
  }, [preProcessedBankData]);

  const rowsWithConciliado = useMemo(() => {
    return preProcessedBankData?.rows || [];
  }, [preProcessedBankData]);

  // Apply master filters and local filters
  const filteredData = useMemo(() => {
    if (!rowsWithConciliado || rowsWithConciliado.length === 0) return [];

    return rowsWithConciliado.filter((row: any) => {
      // MASTER FILTERS - Applied FIRST
      // Master date range filter
      if (masterDateFrom || masterDateTo) {
        const fechaHeader = headers.find((h: string) => h.toLowerCase().includes('fecha'));
        if (fechaHeader) {
          const fechaValue = row[fechaHeader];
          const rowDate = parseExcelDate(fechaValue);

          if (rowDate && !isNaN(rowDate.getTime())) {
            if (masterDateFrom) {
              const fromDate = parseDDMMYYYY(masterDateFrom);
              if (fromDate && rowDate < fromDate) return false;
            }
            if (masterDateTo) {
              const toDate = parseDDMMYYYY(masterDateTo);
              if (toDate) {
                toDate.setHours(23, 59, 59, 999);
                if (rowDate > toDate) return false;
              }
            }
          }
        }
      }

      // Master orden filter (search in any text field)
      if (masterOrden) {
        const searchLower = masterOrden.toLowerCase();
        const hasMatch = Object.values(row).some((value: any) => 
          String(value || '').toLowerCase().includes(searchLower)
        );
        if (!hasMatch) return false;
      }

      // Master tienda filter - match order to tienda using ordenToTiendaMap
      // For bank statements, search for order numbers in the row and check if any matches the tienda
      if (masterTienda && masterTienda !== 'all') {
        // Bank statements don't have direct order numbers, so we search for any orden that matches the tienda
        // This is less precise but allows filtering by tienda if order number is present in any field
        const allValues = Object.values(row).map(v => String(v || '')).join(' ');
        let hasMatchingTienda = false;
        ordenToTiendaMap.forEach((tienda, orden) => {
          if (tienda === masterTienda && allValues.includes(orden)) {
            hasMatchingTienda = true;
          }
        });
        if (!hasMatchingTienda) return false;
      }

      // TAB-SPECIFIC FILTERS - Applied AFTER master filters
      // Referencia filter
      if (referenciaFilter) {
        const referenciaHeader = headers.find((h: string) => 
          h.toLowerCase().includes('referencia')
        );
        if (referenciaHeader) {
          const referenciaValue = String(row[referenciaHeader] || '').toLowerCase();
          if (!referenciaValue.includes(referenciaFilter.toLowerCase())) return false;
        }
      }

      return true;
    });
  }, [rowsWithConciliado, headers, masterDateFrom, masterDateTo, masterOrden, masterTienda, ordenToTiendaMap, referenciaFilter]);

  // Apply sorting
  const sortedData = useMemo(() => {
    if (!sortConfig.column || !sortConfig.direction) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.column!];
      const bVal = b[sortConfig.column!];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined || aVal === '') return 1;
      if (bVal === null || bVal === undefined || bVal === '') return -1;

      // Check if this is a date column
      const isDateColumn = sortConfig.column!.toLowerCase().includes('fecha');
      
      if (isDateColumn) {
        // Parse dates and compare by timestamp
        const aDate = parseExcelDate(aVal);
        const bDate = parseExcelDate(bVal);
        
        // Handle invalid dates
        if (!aDate || isNaN(aDate.getTime())) return 1;
        if (!bDate || isNaN(bDate.getTime())) return -1;
        
        const comparison = aDate.getTime() - bDate.getTime();
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      const comparison = String(aVal).localeCompare(String(bVal), 'es', { numeric: true });
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortConfig]);

  const handleSort = (column: string) => {
    setSortConfig((prev) => {
      if (prev.column !== column) {
        return { column, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { column, direction: 'desc' };
      }
      if (prev.direction === 'desc') {
        return { column: null, direction: null };
      }
      return { column, direction: 'asc' };
    });
  };

  const getSortIcon = (column: string) => {
    if (sortConfig.column !== column) return null;
    if (sortConfig.direction === 'asc') return <ChevronUp className="h-4 w-4 inline ml-1" />;
    if (sortConfig.direction === 'desc') return <ChevronDown className="h-4 w-4 inline ml-1" />;
    return null;
  };

  const handleExport = async () => {
    if (sortedData.length === 0) return;

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(sortedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estado de Cuenta");
    XLSX.writeFile(wb, `estado-cuenta-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Exportado",
      description: "Los datos del estado de cuenta se han exportado correctamente",
    });
  };

  if (!preProcessedBankData || preProcessedBankData.rows.length === 0) {
    return (
      <div className="text-center py-12">
        <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No hay estado de cuenta cargado</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Carga un archivo de estado de cuenta desde la pestaña "CARGAR DATOS"
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Estado de Cuenta Bancario</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {sortedData.length} {sortedData.length === 1 ? 'registro' : 'registros'}
                {sortedData.length !== rowsWithConciliado.length && ` (filtrado de ${rowsWithConciliado.length})`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-toggle-bank-filters"
              >
                <Filter className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleExport}
                variant="outline"
                size="sm"
                disabled={sortedData.length === 0}
                data-testid="button-export-bank"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showFilters && (
            <div className="bg-card border rounded-lg p-6 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank-referencia-filter">Referencia</Label>
                  <Input
                    id="bank-referencia-filter"
                    type="text"
                    placeholder="Buscar referencia..."
                    value={referenciaFilter}
                    onChange={(e) => setReferenciaFilter(e.target.value)}
                    className="w-full"
                    data-testid="input-bank-referencia-filter"
                  />
                </div>
              </div>
              
              {referenciaFilter && (
                <div className="flex justify-end pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReferenciaFilter("")}
                    data-testid="button-clear-bank-filters"
                  >
                    Limpiar filtros
                  </Button>
                </div>
              )}
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  {extendedHeaders.map((header: string, idx: number) => (
                    <th
                      key={idx}
                      className="px-4 py-3 text-left text-sm font-semibold cursor-pointer hover-elevate"
                      onClick={() => handleSort(header)}
                      data-testid={`header-${header.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {header}
                      {getSortIcon(header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedData.length > 0 ? (
                  sortedData.map((row: any, rowIdx: number) => (
                    <tr 
                      key={rowIdx} 
                      className="border-b hover-elevate"
                      data-testid={`row-bank-${rowIdx}`}
                    >
                      {extendedHeaders.map((header: string, cellIdx: number) => {
                        const value = row[header];
                        
                        // Check if this is the CONCILIADO column
                        const isConciliadoColumn = header === 'CONCILIADO';
                        
                        // Check if this is a Referencia column
                        const isReferenciaColumn = header.toLowerCase().includes('referencia');
                        
                        // Check if this is a numeric column (Debe, Haber, Saldo)
                        const isNumericColumn = header.toLowerCase().includes('debe') || 
                                                header.toLowerCase().includes('haber') || 
                                                header.toLowerCase().includes('saldo');
                        
                        // Format values
                        let displayValue = value;
                        
                        // Format Referencia to avoid scientific notation
                        if (isReferenciaColumn && value != null) {
                          // Convert to string and check if it's in scientific notation
                          const valueStr = String(value);
                          if (valueStr.includes('E') || valueStr.includes('e')) {
                            // Convert scientific notation to full number
                            // Reference numbers should be integers, use round to handle floating point errors
                            try {
                              const scientificValue = Number(valueStr);
                              if (!isNaN(scientificValue) && Math.abs(scientificValue) < Number.MAX_SAFE_INTEGER) {
                                // For safe integers, round and convert to string
                                // Use round instead of floor to handle floating point representation errors
                                displayValue = Math.round(scientificValue).toString();
                              } else {
                                // For very large numbers, keep original
                                displayValue = valueStr;
                              }
                            } catch (e) {
                              displayValue = valueStr;
                            }
                          } else {
                            displayValue = valueStr;
                          }
                        }
                        // Format numeric currency values
                        else if (isNumericColumn && value && !isNaN(parseFloat(String(value).replace(/,/g, '')))) {
                          const numValue = parseFloat(String(value).replace(/,/g, ''));
                          displayValue = new Intl.NumberFormat('es-ES', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(numValue);
                        }

                        return (
                          <td 
                            key={cellIdx} 
                            className={`px-4 py-3 text-sm ${isNumericColumn ? 'text-right font-mono' : ''} ${isConciliadoColumn ? 'text-center' : ''}`}
                            data-testid={`cell-${rowIdx}-${header.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {isConciliadoColumn ? (
                              <Badge 
                                variant={value === 'SI' ? 'default' : 'secondary'}
                                className={value === 'SI' ? 'bg-green-600 hover:bg-green-700' : ''}
                                data-testid={`badge-conciliado-${value?.toLowerCase()}`}
                              >
                                {value}
                              </Badge>
                            ) : (
                              displayValue || ''
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={extendedHeaders.length} className="px-4 py-8 text-center text-muted-foreground">
                      No hay registros que coincidan con los filtros
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
