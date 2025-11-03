import { useMemo, useState, useCallback } from "react";
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
import { normalizeNumber } from "@shared/numberUtils";

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
  masterOrden
}: AllInstallmentsProps) {
  const { toast } = useToast();

  // Fetch payment records to cross-reference
  const { data: paymentRecordsData } = useQuery({
    queryKey: ['/api/payment-records'],
    refetchOnWindowFocus: false,
  });

  // Fetch bank statements for verification
  const { data: bankStatementData } = useQuery({
    queryKey: ['/api/bank-statements'],
    refetchOnWindowFocus: false,
  });

  // Extract bank statement data
  const bankApiData = bankStatementData as any;
  const bankStatementRows = bankApiData?.data?.rows || [];
  const bankStatementHeaders = bankApiData?.data?.headers || [];

  // Function to verify payment in bank statement
  const verifyPaymentInBankStatement = useCallback((paymentRecord: any): 'SI' | 'NO' | '-' => {
    if (!paymentRecord) return '-';
    if (!bankStatementRows || bankStatementRows.length === 0) {
      return '-';
    }

    const paymentRef = paymentRecord['# Referencia'] || paymentRecord['#Referencia'] || paymentRecord['Referencia'];
    const paymentAmountVES = paymentRecord['Monto Pagado en VES'] || paymentRecord['Monto pagado en VES'] || paymentRecord['MONTO PAGADO EN VES'];
    const paymentAmountUSD = paymentRecord['Monto Pagado en USD'] || paymentRecord['Monto pagado en USD'] || paymentRecord['MONTO PAGADO EN USD'];

    // If no reference or amounts, can't verify
    if (!paymentRef || (!paymentAmountVES && !paymentAmountUSD)) {
      return '-';
    }

    // Find bank statement column headers (case-insensitive)
    const referenciaHeader = bankStatementHeaders.find((h: string) => 
      h.toLowerCase().includes('referencia')
    );
    const debeHeader = bankStatementHeaders.find((h: string) => 
      h.toLowerCase().includes('debe')
    );
    const haberHeader = bankStatementHeaders.find((h: string) => 
      h.toLowerCase().includes('haber')
    );

    if (!referenciaHeader) {
      return '-';
    }

    // Normalize payment reference (remove spaces, leading zeros)
    const normalizedPaymentRef = String(paymentRef).replace(/\s+/g, '').replace(/^0+/, '').toLowerCase();

    // Normalize payment amounts
    const normalizedVES = paymentAmountVES ? normalizeNumber(paymentAmountVES) : null;
    const normalizedUSD = paymentAmountUSD ? normalizeNumber(paymentAmountUSD) : null;

    // Search bank statements for matching reference and amount
    const found = bankStatementRows.some((bankRow: any) => {
      // Check reference match
      const bankRef = bankRow[referenciaHeader];
      if (!bankRef) return false;
      
      const normalizedBankRef = String(bankRef).replace(/\s+/g, '').replace(/^0+/, '').toLowerCase();
      if (normalizedBankRef !== normalizedPaymentRef) {
        return false; // Reference doesn't match
      }

      // Reference matches, now check amount
      let amountFound = false;

      if (debeHeader) {
        const debeAmount = bankRow[debeHeader];
        if (debeAmount) {
          const normalizedDebe = normalizeNumber(debeAmount);
          if (!isNaN(normalizedDebe)) {
            // Check against both VES and USD amounts (bank could have either)
            if (normalizedVES !== null && Math.abs(normalizedDebe - normalizedVES) < 0.01) {
              amountFound = true;
            }
            if (normalizedUSD !== null && Math.abs(normalizedDebe - normalizedUSD) < 0.01) {
              amountFound = true;
            }
          }
        }
      }

      if (haberHeader && !amountFound) {
        const haberAmount = bankRow[haberHeader];
        if (haberAmount) {
          const normalizedHaber = normalizeNumber(haberAmount);
          if (!isNaN(normalizedHaber)) {
            // Check against both VES and USD amounts
            if (normalizedVES !== null && Math.abs(normalizedHaber - normalizedVES) < 0.01) {
              amountFound = true;
            }
            if (normalizedUSD !== null && Math.abs(normalizedHaber - normalizedUSD) < 0.01) {
              amountFound = true;
            }
          }
        }
      }

      return amountFound;
    });

    return found ? 'SI' : 'NO';
  }, [bankStatementRows, bankStatementHeaders]);

  // Helper function to check if an order is cancelled
  const isCancelledOrder = (row: any): boolean => {
    const statusOrden = String(row["STATUS ORDEN"] || "").toLowerCase().trim();
    return statusOrden.includes("cancel");
  };

  // Extract all installments and enrich with payment dates
  const allInstallments = useMemo(() => {
    // Filter out cancelled orders before extracting installments
    const nonCancelledOrders = tableData.filter(row => !isCancelledOrder(row));
    let installments = extractInstallments(nonCancelledOrders);

    // Cross-reference with payment records to add payment dates
    const apiData = paymentRecordsData as any;
    const hasPaymentData = apiData?.data?.rows && Array.isArray(apiData.data.rows) && apiData.data.rows.length > 0;
    
    if (hasPaymentData) {
      const paymentRows = apiData.data.rows;
      
      // Step 1: Enrich existing scheduled installments with payment info (for "Fecha Cuota" view)
      // Track which payment records have been used to prevent reusing the same payment for multiple installments
      const matchedPaymentIndices = new Set<number>();
      
      installments = installments.map((installment) => {
        // Find first unused matching payment record
        const matchingPaymentIndex = paymentRows.findIndex((payment: any, index: number) => {
          // Skip if this payment has already been used for another installment
          if (matchedPaymentIndices.has(index)) return false;
          
          const paymentOrder = String(payment['# Orden'] || payment['#Orden'] || payment['Orden'] || '').trim();
          const paymentInstallmentStr = String(payment['# Cuota Pagada'] || payment['#CuotaPagada'] || payment['Cuota'] || '').trim();
          
          const orderMatches = paymentOrder === String(installment.orden).trim();
          
          // Match by both order and cuota number if available
          if (paymentInstallmentStr) {
            const paymentCuotaNum = parseInt(paymentInstallmentStr, 10);
            return orderMatches && !isNaN(paymentCuotaNum) && paymentCuotaNum === installment.numeroCuota;
          }
          
          // If no cuota number in payment, don't match (prevent incorrect associations)
          return false;
        });

        if (matchingPaymentIndex !== -1) {
          matchedPaymentIndices.add(matchingPaymentIndex);
          const matchingPayment = paymentRows[matchingPaymentIndex];
          
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
  }, [tableData, paymentRecordsData]);

  // Apply filters to installments
  const filteredInstallments = useMemo(() => {
    return allInstallments.filter((installment: any) => {
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

      // TAB-SPECIFIC FILTERS - Applied AFTER master filters
      // Filter based on which date field is selected
      if (dateFieldFilter === 'fechaPago') {
        // When "Fecha de Pago" is selected, only show payment-based entries
        // Match PAGO DE CUOTAS: don't require a parseable payment date
        if (!installment.isPaymentBased) return false;
      } else {
        // When "Fecha Cuota" is selected, show scheduled installments
        // BUT also show OTRO ALIADO entries (payment-based with no scheduled cuota date)
        // OTRO ALIADO entries have isPaymentBased=true and fechaCuota=null
        const isOtroAliado = installment.isPaymentBased && !installment.fechaCuota;
        if (installment.isPaymentBased && !isOtroAliado) return false;
      }
      
      // Date range filter
      if (dateFrom || dateTo) {
        // Determine the effective date to use for filtering based on user selection
        let effectiveDate;
        
        if (dateFieldFilter === 'fechaCuota') {
          // Use scheduled installment date
          effectiveDate = installment.fechaCuota;
        } else {
          // Use payment date (priority: fechaPagoReal from payment records > fechaPago from order file)
          effectiveDate = installment.fechaPagoReal || installment.fechaPago;
        }
        
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

      // Orden filter
      if (ordenFilter) {
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
  }, [allInstallments, dateFrom, dateTo, ordenFilter, estadoCuotaFilter, dateFieldFilter, masterDateFrom, masterDateTo, masterOrden]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setOrdenFilter("");
    setEstadoCuotaFilter("all");
    setDateFieldFilter("fechaCuota");
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
            <h3 className="text-lg font-semibold">Todas las Cuotas</h3>
            <p className="text-sm text-muted-foreground">
              Vista completa de cuotas programadas y pagadas
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
            <div className="space-y-2">
              <Label htmlFor="installment-date-field">Filtrar fechas por</Label>
              <Select value={dateFieldFilter} onValueChange={setDateFieldFilter}>
                <SelectTrigger id="installment-date-field" data-testid="select-installment-date-field" className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fechaPago">Fecha de Pago (fecha real de pago)</SelectItem>
                  <SelectItem value="fechaCuota">Fecha Cuota (fecha programada)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
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
