import { useMemo, useState, useEffect } from "react";
import { WeeklyPaymentsTable } from "./WeeklyPaymentsTable";
import { ConciliacionPagosDashboard } from "./ConciliacionPagosDashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Filter, X, Download } from "lucide-react";
import { filterInstallmentsByDateRange, calculateInstallmentStatus } from "@/lib/installmentUtils";
import { parseExcelDate, parseDDMMYYYY } from "@/lib/dateUtils";
import { useToast } from "@/hooks/use-toast";

interface ConciliacionPagosTableProps {
  tableData: any[];
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  dateFrom: string;
  setDateFrom: (date: string) => void;
  dateTo: string;
  setDateTo: (date: string) => void;
  ordenFilter: string;
  setOrdenFilter: (orden: string) => void;
  estadoCuotaFilter: string;
  setEstadoCuotaFilter: (estado: string) => void;
  masterDateFrom?: string;
  masterDateTo?: string;
  masterOrden?: string;
  masterTienda?: string;
  ordenToTiendaMap?: Map<string, string>;
  // Pre-processed data from Home.tsx to avoid recalculation on tab switch
  preProcessedPaymentInstallments?: any[];
}

export function ConciliacionPagosTable({ 
  tableData,
  showFilters,
  setShowFilters,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  ordenFilter,
  setOrdenFilter,
  estadoCuotaFilter,
  setEstadoCuotaFilter,
  masterDateFrom,
  masterDateTo,
  masterOrden,
  masterTienda,
  ordenToTiendaMap = new Map(),
  preProcessedPaymentInstallments = []
}: ConciliacionPagosTableProps) {
  const { toast } = useToast();

  // Use pre-processed payment installments data from Home.tsx (avoids recalculation on tab switch)
  const allInstallments = useMemo(() => {
    // Add STATUS field to each installment for dashboard calculations
    return preProcessedPaymentInstallments.map((installment) => ({
      ...installment,
      status: calculateInstallmentStatus(installment)
    }));
  }, [preProcessedPaymentInstallments]);

  // Apply filters to installments - HARDCODED to filter by Fecha de Pago
  const filteredInstallments = useMemo(() => {
    return allInstallments.filter((installment: any) => {
      // MASTER FILTERS - Applied FIRST
      // Master date range filter
      if (masterDateFrom || masterDateTo) {
        // Use fechaPagoReal (payment date) for master filter in this tab
        const effectiveDate = installment.fechaPagoReal || installment.fechaPago;
        
        if (effectiveDate) {
          const installmentDate = typeof effectiveDate === 'string' ? parseExcelDate(effectiveDate) : effectiveDate;
          
          if (installmentDate) {
            const normalizedInstallmentDate = new Date(installmentDate);
            normalizedInstallmentDate.setHours(0, 0, 0, 0);
            
            if (masterDateFrom) {
              const fromDate = parseDDMMYYYY(masterDateFrom);
              if (fromDate) {
                fromDate.setHours(0, 0, 0, 0);
                if (normalizedInstallmentDate < fromDate) return false;
              }
            }
            if (masterDateTo) {
              const toDate = parseDDMMYYYY(masterDateTo);
              if (toDate) {
                toDate.setHours(23, 59, 59, 999);
                if (normalizedInstallmentDate > toDate) return false;
              }
            }
          }
        }
      }

      // Master orden filter
      if (masterOrden) {
        const ordenValue = String(installment.orden || '').toLowerCase();
        if (!ordenValue.includes(masterOrden.toLowerCase())) return false;
      }

      // Master tienda filter - match order to tienda using ordenToTiendaMap
      if (masterTienda && masterTienda !== 'all') {
        const ordenValue = String(installment.orden || '').replace(/^0+/, '') || '0';
        const rowTienda = ordenToTiendaMap.get(ordenValue);
        if (!rowTienda || rowTienda !== masterTienda) return false;
      }

      // TAB-SPECIFIC FILTERS - Applied AFTER master filters
      // HARDCODED: Only show payment-based entries (Fecha de Pago view)
      if (!installment.isPaymentBased) return false;
      
      // Date range filter - only apply if master date filters are NOT active
      if ((dateFrom || dateTo) && !masterDateFrom && !masterDateTo) {
        // Use payment date (priority: fechaPagoReal from payment records > fechaPago from order file)
        const effectiveDate = installment.fechaPagoReal || installment.fechaPago;
        
        if (effectiveDate) {
          const installmentDate = typeof effectiveDate === 'string' ? parseExcelDate(effectiveDate) : effectiveDate;
          
          if (installmentDate) {
            // Normalize installment date to midnight for date-only comparison
            const normalizedInstallmentDate = new Date(installmentDate);
            normalizedInstallmentDate.setHours(0, 0, 0, 0);
            
            if (dateFrom) {
              const fromDate = parseDDMMYYYY(dateFrom);
              if (fromDate) {
                fromDate.setHours(0, 0, 0, 0);
                if (normalizedInstallmentDate < fromDate) return false;
              }
            }
            if (dateTo) {
              const toDate = parseDDMMYYYY(dateTo);
              if (toDate) {
                toDate.setHours(23, 59, 59, 999);
                if (normalizedInstallmentDate > toDate) return false;
              }
            }
          }
        }
      }

      // Orden filter - only apply if master orden filter is NOT active
      if (ordenFilter && !masterOrden) {
        const ordenValue = String(installment.orden || '').toLowerCase();
        if (!ordenValue.includes(ordenFilter.toLowerCase())) return false;
      }

      // Estado Cuota filter
      if (estadoCuotaFilter && estadoCuotaFilter !== 'all') {
        const estado = (installment.estadoCuota || '').trim().toLowerCase();
        if (estado !== estadoCuotaFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [allInstallments, dateFrom, dateTo, ordenFilter, estadoCuotaFilter, masterDateFrom, masterDateTo, masterOrden, masterTienda, ordenToTiendaMap]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setOrdenFilter("");
    setEstadoCuotaFilter("all");
  };

  const hasActiveFilters = dateFrom || dateTo || ordenFilter || (estadoCuotaFilter !== 'all');

  const handleExport = async () => {
    if (filteredInstallments.length === 0) {
      toast({
        title: "No hay datos para exportar",
        variant: "destructive",
      });
      return;
    }

    // Convert installments to a format suitable for Excel
    const exportData = filteredInstallments.map((inst: any) => {
      // Helper to safely format dates
      const formatDate = (dateValue: any): string => {
        if (!dateValue) return '';
        if (dateValue instanceof Date) {
          return dateValue.toLocaleDateString('es-ES');
        }
        // Try to parse as date if it's a string or number
        const parsed = parseExcelDate(dateValue);
        return parsed ? parsed.toLocaleDateString('es-ES') : '';
      };

      return {
        'Orden': inst.orden,
        'Número Cuota': inst.numeroCuota,
        'Fecha Cuota': formatDate(inst.fechaCuota),
        'Monto': inst.monto,
        'Estado': inst.estadoCuota,
        'Fecha Pago Real': formatDate(inst.fechaPagoReal),
        'Fecha Pago': formatDate(inst.fechaPago),
        'Referencia': inst.paymentDetails?.referencia || '',
        'Verificacion': inst.verificacion || '-',
      };
    });

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cuotas Pagos");
    XLSX.writeFile(wb, `conciliacion_pagos_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Archivo exportado",
      description: "Los datos se han descargado exitosamente",
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Conciliación de Pagos</h3>
            <p className="text-sm text-muted-foreground">
              Vista de cuotas filtrada por Fecha de Pago (fecha real de pago)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-payment-filters"
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              data-testid="button-export-payments"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="bg-muted/50 border rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment-date-from">Fecha Desde</Label>
                <DatePicker
                  id="payment-date-from"
                  value={dateFrom}
                  onChange={setDateFrom}
                  data-testid="input-payment-date-from"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-date-to">Fecha Hasta</Label>
                <DatePicker
                  id="payment-date-to"
                  value={dateTo}
                  onChange={setDateTo}
                  data-testid="input-payment-date-to"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-orden-filter">Orden</Label>
                <Input
                  id="payment-orden-filter"
                  type="text"
                  value={ordenFilter}
                  onChange={(e) => setOrdenFilter(e.target.value)}
                  placeholder="Buscar orden..."
                  data-testid="input-payment-orden-filter"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-estado-filter">Estado Cuota</Label>
                <Select value={estadoCuotaFilter} onValueChange={setEstadoCuotaFilter}>
                  <SelectTrigger id="payment-estado-filter" data-testid="select-payment-estado-filter">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="done">Done (Pagadas)</SelectItem>
                    <SelectItem value="scheduled">Scheduled (Programadas)</SelectItem>
                    <SelectItem value="graced">Graced (En gracia)</SelectItem>
                    <SelectItem value="delayed">Delayed (Atrasadas)</SelectItem>
                    <SelectItem value="cancelled">Cancelled (Canceladas)</SelectItem>
                    <SelectItem value="inicial">INICIAL (Pago Inicial)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  {filteredInstallments.length} de {allInstallments.length} cuotas
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  data-testid="button-clear-payment-filters"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConciliacionPagosDashboard installments={filteredInstallments} />

      <WeeklyPaymentsTable installments={filteredInstallments} />
    </div>
  );
}
