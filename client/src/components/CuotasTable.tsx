import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Filter, Download, ArrowUpDown, ArrowUp, ArrowDown, DollarSign, FileText } from "lucide-react";
import { extractInstallments } from "@/lib/installmentUtils";
import { parseDDMMYYYY, formatDate, parseExcelDate } from "@/lib/dateUtils";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

interface CuotasTableProps {
  tableData: any[];
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  dateFrom: string;
  setDateFrom: (date: string) => void;
  dateTo: string;
  setDateTo: (date: string) => void;
  ordenFilter: string;
  setOrdenFilter: (orden: string) => void;
  estadoFilter: string;
  setEstadoFilter: (estado: string) => void;
  masterDateFrom?: string;
  masterDateTo?: string;
  masterOrden?: string;
}

type SortField = 'orden' | 'cuota' | 'fecha' | 'monto' | 'estado';
type SortDirection = 'asc' | 'desc' | null;

export function CuotasTable({ 
  tableData, 
  showFilters, 
  setShowFilters,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  ordenFilter,
  setOrdenFilter,
  estadoFilter,
  setEstadoFilter,
  masterDateFrom,
  masterDateTo,
  masterOrden
}: CuotasTableProps) {
  const { toast } = useToast();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Helper function to check if an order is cancelled
  const isCancelledOrder = (row: any): boolean => {
    const statusOrden = String(row["STATUS ORDEN"] || "").toLowerCase().trim();
    return statusOrden.includes("cancel");
  };

  // Extract all installments from orders, excluding cancelled orders
  const allCuotas = useMemo(() => {
    const nonCancelledOrders = tableData.filter(row => !isCancelledOrder(row));
    return extractInstallments(nonCancelledOrders);
  }, [tableData]);

  // Filter cuotas
  const filteredCuotas = useMemo(() => {
    let filtered = [...allCuotas];

    // MASTER FILTERS - Applied FIRST
    // Master date range filter
    if (masterDateFrom || masterDateTo) {
      const fromDate = masterDateFrom ? parseDDMMYYYY(masterDateFrom) : null;
      const toDate = masterDateTo ? parseDDMMYYYY(masterDateTo) : null;
      
      if (toDate) {
        toDate.setHours(23, 59, 59, 999);
      }

      filtered = filtered.filter((cuota) => {
        if (!cuota.fechaCuota) return false;
        const cuotaDate = typeof cuota.fechaCuota === 'string' ? parseExcelDate(cuota.fechaCuota) : cuota.fechaCuota;
        if (!cuotaDate || isNaN(cuotaDate.getTime())) return false;

        if (fromDate && cuotaDate < fromDate) return false;
        if (toDate && cuotaDate > toDate) return false;
        return true;
      });
    }

    // Master orden filter
    if (masterOrden) {
      filtered = filtered.filter((cuota) => 
        String(cuota.orden).toLowerCase().includes(masterOrden.toLowerCase())
      );
    }

    // TAB-SPECIFIC FILTERS - Applied AFTER master filters
    // Filter by date range
    if (dateFrom || dateTo) {
      const fromDate = dateFrom ? parseDDMMYYYY(dateFrom) : null;
      const toDate = dateTo ? parseDDMMYYYY(dateTo) : null;
      
      if (toDate) {
        toDate.setHours(23, 59, 59, 999);
      }

      filtered = filtered.filter((cuota) => {
        if (!cuota.fechaCuota) return false;
        const cuotaDate = typeof cuota.fechaCuota === 'string' ? parseExcelDate(cuota.fechaCuota) : cuota.fechaCuota;
        if (!cuotaDate || isNaN(cuotaDate.getTime())) return false;

        if (fromDate && cuotaDate < fromDate) return false;
        if (toDate && cuotaDate > toDate) return false;
        return true;
      });
    }

    // Filter by orden
    if (ordenFilter) {
      filtered = filtered.filter((cuota) => 
        String(cuota.orden).toLowerCase().includes(ordenFilter.toLowerCase())
      );
    }

    // Filter by estado
    if (estadoFilter && estadoFilter !== 'all') {
      filtered = filtered.filter((cuota) => {
        const estado = String(cuota.estadoCuota || '').toLowerCase();
        return estado === estadoFilter.toLowerCase();
      });
    }

    // Sort
    if (sortField && sortDirection) {
      filtered.sort((a, b) => {
        let aValue, bValue;

        switch (sortField) {
          case 'orden':
            aValue = String(a.orden);
            bValue = String(b.orden);
            break;
          case 'cuota':
            aValue = a.numeroCuota;
            bValue = b.numeroCuota;
            break;
          case 'fecha':
            aValue = a.fechaCuota ? (typeof a.fechaCuota === 'string' ? parseExcelDate(a.fechaCuota) : a.fechaCuota)?.getTime() || 0 : 0;
            bValue = b.fechaCuota ? (typeof b.fechaCuota === 'string' ? parseExcelDate(b.fechaCuota) : b.fechaCuota)?.getTime() || 0 : 0;
            break;
          case 'monto':
            aValue = a.monto || 0;
            bValue = b.monto || 0;
            break;
          case 'estado':
            aValue = String(a.estadoCuota || '').toLowerCase();
            bValue = String(b.estadoCuota || '').toLowerCase();
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [allCuotas, dateFrom, dateTo, ordenFilter, estadoFilter, sortField, sortDirection, masterDateFrom, masterDateTo, masterOrden]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 ml-1" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="h-4 w-4 ml-1" />;
    }
    return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
  };

  const handleExport = () => {
    if (filteredCuotas.length === 0) return;

    const exportData = filteredCuotas.map((cuota) => ({
      'Orden': cuota.orden,
      'Cuota': `Cuota ${cuota.numeroCuota}`,
      'Fecha': cuota.fechaCuota ? formatDate(cuota.fechaCuota) : '',
      'Monto': cuota.monto,
      'Estado': cuota.estadoCuota || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cuotas");
    XLSX.writeFile(wb, `cuotas_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Archivo exportado",
      description: "Las cuotas se han descargado exitosamente",
    });
  };

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setOrdenFilter("");
    setEstadoFilter("all");
  };

  const hasActiveFilters = dateFrom || dateTo || ordenFilter || (estadoFilter && estadoFilter !== 'all');

  // Calculate period metrics (for cuotas in the date range)
  const periodMetrics = useMemo(() => {
    if (!dateFrom && !dateTo) {
      // No date range specified, return null
      return null;
    }

    const fromDate = dateFrom ? parseDDMMYYYY(dateFrom) : null;
    const toDate = dateTo ? parseDDMMYYYY(dateTo) : null;
    
    if (toDate) {
      toDate.setHours(23, 59, 59, 999);
    }

    // Filter cuotas within the date range
    const cuotasInPeriod = allCuotas.filter((cuota) => {
      if (!cuota.fechaCuota) return false;
      const cuotaDate = typeof cuota.fechaCuota === 'string' ? parseExcelDate(cuota.fechaCuota) : cuota.fechaCuota;
      if (!cuotaDate || isNaN(cuotaDate.getTime())) return false;

      if (fromDate && cuotaDate < fromDate) return false;
      if (toDate && cuotaDate > toDate) return false;
      return true;
    });

    const totalCuotas = cuotasInPeriod.length;
    const totalAmount = cuotasInPeriod.reduce((sum, cuota) => sum + (cuota.monto || 0), 0);

    return {
      totalCuotas,
      totalAmount
    };
  }, [allCuotas, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            Todas las Cuotas
          </h3>
          <p className="text-sm text-muted-foreground">
            {filteredCuotas.length} de {allCuotas.length} {filteredCuotas.length === 1 ? 'cuota' : 'cuotas'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filteredCuotas.length === 0}
            data-testid="button-export"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {periodMetrics && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">CUOTAS DEL PERIODO</p>
                  <p className="text-2xl font-bold mt-2" data-testid="metric-cuotas-periodo">
                    {periodMetrics.totalCuotas}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dateFrom && dateTo 
                      ? `${dateFrom} - ${dateTo}`
                      : dateFrom 
                      ? `Desde ${dateFrom}`
                      : `Hasta ${dateTo}`}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">CUENTAS POR PAGAR</p>
                  <p className="text-2xl font-bold mt-2" data-testid="metric-cuentas-por-pagar">
                    ${periodMetrics.totalAmount.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dateFrom && dateTo 
                      ? `${dateFrom} - ${dateTo}`
                      : dateFrom 
                      ? `Desde ${dateFrom}`
                      : `Hasta ${dateTo}`}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showFilters && (
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-from">Fecha Desde</Label>
              <DatePicker
                id="date-from"
                value={dateFrom}
                onChange={setDateFrom}
                data-testid="input-date-from"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date-to">Fecha Hasta</Label>
              <DatePicker
                id="date-to"
                value={dateTo}
                onChange={setDateTo}
                data-testid="input-date-to"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="orden-filter">Orden</Label>
              <Input
                id="orden-filter"
                type="text"
                placeholder="Buscar orden..."
                value={ordenFilter}
                onChange={(e) => setOrdenFilter(e.target.value)}
                className="w-full"
                data-testid="input-orden-filter"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="estado-filter">Estado</Label>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger id="estado-filter" className="w-full" data-testid="select-estado-filter">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {hasActiveFilters && (
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                data-testid="button-clear-filters"
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th 
                  className="text-left p-4 font-medium cursor-pointer hover-elevate active-elevate-2"
                  onClick={() => handleSort('orden')}
                  data-testid="header-orden"
                  aria-sort={sortField === 'orden' ? (sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none') : 'none'}
                >
                  <div className="flex items-center">
                    Orden
                    {getSortIcon('orden')}
                  </div>
                </th>
                <th 
                  className="text-left p-4 font-medium cursor-pointer hover-elevate active-elevate-2"
                  onClick={() => handleSort('cuota')}
                  data-testid="header-cuota"
                  aria-sort={sortField === 'cuota' ? (sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none') : 'none'}
                >
                  <div className="flex items-center">
                    Cuota
                    {getSortIcon('cuota')}
                  </div>
                </th>
                <th 
                  className="text-left p-4 font-medium cursor-pointer hover-elevate active-elevate-2"
                  onClick={() => handleSort('fecha')}
                  data-testid="header-fecha"
                  aria-sort={sortField === 'fecha' ? (sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none') : 'none'}
                >
                  <div className="flex items-center">
                    Fecha de Vencimiento
                    {getSortIcon('fecha')}
                  </div>
                </th>
                <th 
                  className="text-right p-4 font-medium cursor-pointer hover-elevate active-elevate-2"
                  onClick={() => handleSort('monto')}
                  data-testid="header-monto"
                  aria-sort={sortField === 'monto' ? (sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none') : 'none'}
                >
                  <div className="flex items-center justify-end">
                    Monto
                    {getSortIcon('monto')}
                  </div>
                </th>
                <th 
                  className="text-left p-4 font-medium cursor-pointer hover-elevate active-elevate-2"
                  onClick={() => handleSort('estado')}
                  data-testid="header-estado"
                  aria-sort={sortField === 'estado' ? (sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none') : 'none'}
                >
                  <div className="flex items-center">
                    Estado
                    {getSortIcon('estado')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCuotas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-muted-foreground">
                    No hay cuotas que coincidan con los filtros
                  </td>
                </tr>
              ) : (
                filteredCuotas.map((cuota, index) => (
                  <tr 
                    key={`${cuota.orden}-${cuota.numeroCuota}-${index}`}
                    className="border-b last:border-b-0 hover-elevate"
                    data-testid={`row-cuota-${index}`}
                  >
                    <td className="p-4" data-testid={`cell-orden-${index}`}>
                      {cuota.orden}
                    </td>
                    <td className="p-4" data-testid={`cell-cuota-${index}`}>
                      Cuota {cuota.numeroCuota}
                    </td>
                    <td className="p-4" data-testid={`cell-fecha-${index}`}>
                      {cuota.fechaCuota ? formatDate(cuota.fechaCuota) : '-'}
                    </td>
                    <td className="p-4 text-right font-medium" data-testid={`cell-monto-${index}`}>
                      ${cuota.monto?.toFixed(2) || '0.00'}
                    </td>
                    <td className="p-4" data-testid={`cell-estado-${index}`}>
                      <span 
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                          cuota.estadoCuota?.toLowerCase() === 'done' 
                            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                            : cuota.estadoCuota?.toLowerCase() === 'pendiente'
                            ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : cuota.estadoCuota?.toLowerCase() === 'vencido'
                            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                            : 'bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
                        }`}
                      >
                        {cuota.estadoCuota || 'Sin estado'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
