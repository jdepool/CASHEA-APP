import { useMemo, useState, useEffect } from "react";
import { WeeklyPaymentsTable } from "./WeeklyPaymentsTable";
import { InstallmentsDashboard } from "./InstallmentsDashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Filter, X, Download } from "lucide-react";
import { extractInstallments, filterInstallmentsByDateRange, calculateInstallmentStatus } from "@/lib/installmentUtils";
import { parseExcelDate, parseDDMMYYYY } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

interface AllInstallmentsProps {
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
  dateFieldFilter: string;
  setDateFieldFilter: (field: string) => void;
  masterDateFrom?: string;
  masterDateTo?: string;
  masterOrden?: string;
  masterTienda?: string;
  ordenToTiendaMap?: Map<string, string>;
  onFilteredInstallmentsChange?: (installments: any[]) => void;
}

export function AllInstallments({ 
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
  dateFieldFilter,
  setDateFieldFilter,
  masterDateFrom,
  masterDateTo,
  masterOrden,
  masterTienda,
  ordenToTiendaMap = new Map(),
  onFilteredInstallmentsChange
}: AllInstallmentsProps) {
  const { toast } = useToast();

  // Fetch payment records to cross-reference
  const { data: paymentRecordsData } = useQuery({
    queryKey: ['/api/payment-records'],
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // Helper function to check if an order is cancelled
  const isCancelledOrder = (row: any): boolean => {
    const statusOrden = String(row["STATUS ORDEN"] || "").toLowerCase().trim();
    return statusOrden.includes("cancel");
  };

  // Extract all installments and enrich with payment dates
  const allInstallments = useMemo(() => {
    // Filter out cancelled orders AND orders not in marketplace data
    const validOrders = tableData.filter(row => {
      // Exclude cancelled orders
      if (isCancelledOrder(row)) return false;
      
      // Exclude orders not in marketplace data (ordenToTiendaMap)
      const ordenValue = String(row["Orden"] || '').replace(/^0+/, '') || '0';
      if (!ordenToTiendaMap.has(ordenValue)) return false;
      
      return true;
    });
    let installments = extractInstallments(validOrders);
    const nonCancelledOrders = validOrders; // Use validOrders for payment-based entries lookup

    // Cross-reference with payment records to add payment dates
    const apiData = paymentRecordsData as any;
    const hasPaymentData = apiData?.data?.rows && Array.isArray(apiData.data.rows) && apiData.data.rows.length > 0;
    
    if (hasPaymentData) {
      const paymentRows = apiData.data.rows;
      
      // Step 1: Enrich existing scheduled installments with payment info (for "Fecha Cuota" view)
      // When a payment covers multiple cuotas (e.g., "3,4,5"), ALL those cuotas get the same payment details
      installments = installments.map((installment) => {
        // Find matching payment record - now supports comma-separated cuotas
        const matchingPayment = paymentRows.find((payment: any) => {
          const paymentOrder = String(payment['# Orden'] || payment['#Orden'] || payment['Orden'] || '').trim();
          const paymentInstallmentStr = String(payment['# Cuota Pagada'] || payment['#CuotaPagada'] || payment['Cuota'] || '').trim();
          
          const orderMatches = paymentOrder === String(installment.orden).trim();
          
          // Match by both order and cuota number
          if (paymentInstallmentStr && orderMatches) {
            // Parse comma-separated cuota numbers (e.g., "3,4,5")
            const cuotaParts = paymentInstallmentStr.split(',').map(s => s.trim());
            for (const part of cuotaParts) {
              const parsed = parseInt(part, 10);
              if (!isNaN(parsed) && parsed === installment.numeroCuota) {
                return true; // This cuota is included in the payment
              }
            }
          }
          
          return false;
        });

        if (matchingPayment) {
          // Use transaction date to match PAGO DE CUOTAS filtering
          const fechaTasaCambio = matchingPayment['Fecha de Transaccion'] ||
                                  matchingPayment['FECHA DE TRANSACCION'] ||
                                  matchingPayment['Fecha de Transacción'] ||
                                  matchingPayment['FECHA DE TRANSACCIÓN'];
          
          const parsedDate = fechaTasaCambio ? parseExcelDate(fechaTasaCambio) : null;
          
          if (parsedDate) {
            // Read VERIFICACION from stored data (calculated server-side during upload)
            const verificacion = matchingPayment['VERIFICACION'] || '-';
            
            return { 
              ...installment, 
              fechaPagoReal: parsedDate,
              paymentDetails: {
                referencia: matchingPayment['# Referencia'] || matchingPayment['#Referencia'] || matchingPayment['Referencia'],
                metodoPago: matchingPayment['Método de Pago'] || matchingPayment['Metodo de Pago'] || matchingPayment['MÉTODO DE PAGO'],
                montoPagadoUSD: matchingPayment['Monto Pagado en USD'] || matchingPayment['MONTO PAGADO EN USD'] || matchingPayment['Monto'],
                montoPagadoVES: matchingPayment['Monto Pagado en VES'] || matchingPayment['MONTO PAGADO EN VES'],
                tasaCambio: matchingPayment['Tasa de Cambio'] || matchingPayment['TASA DE CAMBIO']
              },
              verificacion
            };
          }
        }
        
        return installment;
      });
      
      // Step 2: Create payment-based entries for EVERY payment record (for "Fecha de Pago" view)
      // These will have a special flag to identify them
      const paymentBasedEntries: any[] = [];
      
      paymentRows.forEach((payment: any) => {
        const paymentOrder = String(payment['# Orden'] || payment['#Orden'] || payment['Orden'] || '').trim();
        const paymentInstallment = String(payment['# Cuota Pagada'] || payment['#CuotaPagada'] || payment['Cuota'] || '').trim();
        const montoPagado = payment['Monto Pagado en USD'] || payment['MONTO PAGADO EN USD'] || payment['Monto'] || 0;
        
        // Use transaction date to match PAGO DE CUOTAS filtering
        const fechaTasaCambio = payment['Fecha de Transaccion'] ||
                                payment['FECHA DE TRANSACCION'] ||
                                payment['Fecha de Transacción'] ||
                                payment['FECHA DE TRANSACCIÓN'];
        
        const parsedDate = fechaTasaCambio ? parseExcelDate(fechaTasaCambio) : null;
        
        // Include ALL payment records, even those without cuota numbers or parseable dates
        // Match PAGO DE CUOTAS behavior: include all records with order numbers
        if (paymentOrder) {
          // Handle comma-separated cuota numbers (e.g., "3,4,5" means cuotas 3, 4, and 5)
          // Match PAGO DE CUOTAS: each cuota in the list creates a separate entry
          const cuotaNumbers: number[] = [];
          
          if (paymentInstallment) {
            // Split by comma and parse each number
            const cuotaParts = paymentInstallment.split(',').map(s => s.trim());
            for (const part of cuotaParts) {
              const parsed = parseInt(part, 10);
              if (!isNaN(parsed)) {
                cuotaNumbers.push(parsed);
              }
            }
          }
          
          // If no valid cuota numbers found, use -1 as sentinel
          if (cuotaNumbers.length === 0) {
            cuotaNumbers.push(-1);
          }
          
          // Create one entry per cuota number
          cuotaNumbers.forEach((cuotaNumber) => {
            // Look up the scheduled date from the orders file (if exists)
            let fechaCuotaValue = null;
            const matchingOrder = nonCancelledOrders.find((row: any) => 
              String(row['Orden'] || '').trim() === paymentOrder
            );
            
            if (matchingOrder && cuotaNumber >= 0) {
              if (cuotaNumber === 0) {
                const fechaCompra = matchingOrder['FECHA DE COMPRA'] || 
                                   matchingOrder['Fecha de Compra'] || 
                                   matchingOrder['Fecha de compra'] || 
                                   matchingOrder['Fecha Compra'];
                if (fechaCompra) {
                  fechaCuotaValue = parseExcelDate(fechaCompra);
                }
              } else {
                const fechaCuotaRaw = matchingOrder[`Fecha cuota ${cuotaNumber}`];
                if (fechaCuotaRaw) {
                  fechaCuotaValue = parseExcelDate(fechaCuotaRaw);
                }
              }
            }
            
            // Read VERIFICACION from stored data (calculated server-side during upload)
            const verificacion = payment['VERIFICACION'] || '-';
            
            paymentBasedEntries.push({
              orden: paymentOrder,
              fechaCuota: fechaCuotaValue,
              numeroCuota: cuotaNumber,
              monto: typeof montoPagado === 'number' ? montoPagado : parseFloat(String(montoPagado || 0).replace(/[^0-9.-]/g, '')) || 0,
              estadoCuota: 'Done',
              fechaPago: null,
              fechaPagoReal: parsedDate,
              isPaymentBased: true, // Flag to identify payment-based entries
              paymentDetails: {
                referencia: payment['# Referencia'] || payment['#Referencia'] || payment['Referencia'],
                metodoPago: payment['Método de Pago'] || payment['Metodo de Pago'] || payment['MÉTODO DE PAGO'],
                montoPagadoUSD: payment['Monto Pagado en USD'] || payment['MONTO PAGADO EN USD'] || payment['Monto'],
                montoPagadoVES: payment['Monto Pagado en VES'] || payment['MONTO PAGADO EN VES'],
                tasaCambio: payment['Tasa de Cambio'] || payment['TASA DE CAMBIO']
              },
              verificacion
            });
          });
        }
      });
      
      // Combine both sets of installments
      installments = [...installments, ...paymentBasedEntries];
    }

    // Dynamically determine installment status based on payment dates
    // Grace period threshold: 3 days after due date before marking as delayed
    const gracePeriodThreshold = new Date();
    gracePeriodThreshold.setDate(gracePeriodThreshold.getDate() - 3);
    gracePeriodThreshold.setHours(23, 59, 59, 999);
    
    installments = installments.map((installment) => {
      const paymentDateRaw = installment.fechaPagoReal || installment.fechaPago;
      const estadoLower = (installment.estadoCuota || '').trim().toLowerCase();
      const isScheduledOrGraced = estadoLower === 'scheduled' || estadoLower === 'graced';
      const fechaCuota = installment.fechaCuota;
      
      // Parse payment date to handle Excel formats and string dates
      const paymentDate = paymentDateRaw ? parseExcelDate(paymentDateRaw) : null;
      
      // Rule 1: If (Scheduled OR Graced) AND has valid payment date <= scheduled date, mark as "Done"
      if (isScheduledOrGraced && paymentDate && fechaCuota) {
        const cuotaDate = fechaCuota instanceof Date ? fechaCuota : parseExcelDate(fechaCuota);
        
        if (cuotaDate && paymentDate <= cuotaDate) {
          return { ...installment, estadoCuota: 'Done' };
        }
      }
      
      // Rule 2: If (Scheduled OR Graced) AND overdue (with 3-day grace period) AND no payment date, mark as "Delayed"
      if (fechaCuota && isScheduledOrGraced && !paymentDate) {
        const cuotaDate = fechaCuota instanceof Date ? new Date(fechaCuota) : parseExcelDate(fechaCuota);
        
        if (cuotaDate) {
          cuotaDate.setHours(23, 59, 59, 999);
          
          // Only mark as delayed if due date is more than 3 days ago
          if (cuotaDate < gracePeriodThreshold) {
            return { ...installment, estadoCuota: 'Delayed' };
          }
        }
      }
      
      return installment;
    });

    // Add STATUS field to each installment for dashboard calculations
    installments = installments.map((installment) => ({
      ...installment,
      status: calculateInstallmentStatus(installment)
    }));

    return installments;
  }, [tableData, paymentRecordsData, ordenToTiendaMap]);

  // Apply filters to installments
  const filteredInstallments = useMemo(() => {
    // Get list of valid order numbers from tableData
    const validOrderNumbers = new Set(
      tableData.map((row: any) => String(row['Orden'] || '').trim()).filter(Boolean)
    );

    return allInstallments.filter((installment: any) => {
      // ONLY show cuotas for orders that exist in the database (tableData)
      const ordenValue = String(installment.orden || '').trim();
      if (!validOrderNumbers.has(ordenValue)) return false;

      // MASTER FILTERS - Applied FIRST
      // Master date range filter
      if (masterDateFrom || masterDateTo) {
        // Use fechaCuota as the primary date field for master filter
        const effectiveDate = installment.fechaCuota;
        
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
      // HARDCODED: Show ONLY scheduled installments (Fecha Cuota view)
      // Exclude ALL payment-based entries (they belong in CONCILIACION DE PAGOS)
      // Exclude ALL installments without fechaCuota
      if (installment.isPaymentBased) return false;
      if (!installment.fechaCuota) return false;
      
      // Date range filter - only apply if master date filters are NOT active
      // HARDCODED: Use scheduled installment date (fechaCuota)
      if ((dateFrom || dateTo) && !masterDateFrom && !masterDateTo) {
        const effectiveDate = installment.fechaCuota;
        
        // When date filtering is active, exclude cuotas without fechaCuota
        if (!effectiveDate) return false;
        
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
  }, [allInstallments, dateFrom, dateTo, ordenFilter, estadoCuotaFilter, masterDateFrom, masterDateTo, masterOrden, masterTienda, ordenToTiendaMap, tableData]);

  // Notify parent component when filtered installments change
  useEffect(() => {
    if (onFilteredInstallmentsChange) {
      onFilteredInstallmentsChange(filteredInstallments);
    }
  }, [filteredInstallments, onFilteredInstallmentsChange]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setOrdenFilter("");
    setEstadoCuotaFilter("all");
  };

  const hasActiveFilters = dateFrom || dateTo || ordenFilter || (estadoCuotaFilter !== 'all');

  const handleExport = () => {
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

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cuotas");
    XLSX.writeFile(wb, `cuotas_${new Date().toISOString().split('T')[0]}.xlsx`);
    
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
            <h3 className="text-lg font-semibold">Conciliación de Cuotas</h3>
            <p className="text-sm text-muted-foreground">
              Vista de cuotas filtrada por Fecha Cuota (fecha programada)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-installment-filters"
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              data-testid="button-export-installments"
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
                <Label htmlFor="installment-date-from">Fecha Desde</Label>
                <DatePicker
                  id="installment-date-from"
                  value={dateFrom}
                  onChange={setDateFrom}
                  data-testid="input-installment-date-from"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="installment-date-to">Fecha Hasta</Label>
                <DatePicker
                  id="installment-date-to"
                  value={dateTo}
                  onChange={setDateTo}
                  data-testid="input-installment-date-to"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="installment-orden-filter">Orden</Label>
                <Input
                  id="installment-orden-filter"
                  type="text"
                  value={ordenFilter}
                  onChange={(e) => setOrdenFilter(e.target.value)}
                  placeholder="Buscar orden..."
                  data-testid="input-installment-orden-filter"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="installment-estado-filter">Estado Cuota</Label>
                <Select value={estadoCuotaFilter} onValueChange={setEstadoCuotaFilter}>
                  <SelectTrigger id="installment-estado-filter" data-testid="select-installment-estado-filter">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="done">Done (Pagadas)</SelectItem>
                    <SelectItem value="scheduled">Scheduled (Programadas)</SelectItem>
                    <SelectItem value="graced">Graced (En gracia)</SelectItem>
                    <SelectItem value="delayed">Delayed (Atrasadas)</SelectItem>
                    <SelectItem value="cancelled">Cancelled (Canceladas)</SelectItem>
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
                  data-testid="button-clear-installment-filters"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
        )}

        <InstallmentsDashboard installments={filteredInstallments} />
      </div>

      <WeeklyPaymentsTable installments={filteredInstallments} />
    </div>
  );
}
