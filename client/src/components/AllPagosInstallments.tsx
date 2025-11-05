import { useMemo, useEffect } from "react";
import { extractInstallments, calculateInstallmentStatus } from "@/lib/installmentUtils";
import { parseExcelDate, parseDDMMYYYY } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";
import { calculatePaymentSplits } from "@/lib/paymentUtils";

interface AllPagosInstallmentsProps {
  tableData: any[];
  dateFrom: string;
  dateTo: string;
  ordenFilter: string;
  estadoCuotaFilter: string;
  masterDateFrom?: string;
  masterDateTo?: string;
  masterOrden?: string;
  onFilteredInstallmentsChange?: (installments: any[]) => void;
}

export function AllPagosInstallments({ 
  tableData,
  dateFrom,
  dateTo,
  ordenFilter,
  estadoCuotaFilter,
  masterDateFrom,
  masterDateTo,
  masterOrden,
  onFilteredInstallmentsChange
}: AllPagosInstallmentsProps) {

  // Fetch payment records to cross-reference
  const { data: paymentRecordsData } = useQuery({
    queryKey: ['/api/payment-records'],
    refetchOnWindowFocus: false,
  });

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
      
      // Step 1: Enrich existing scheduled installments with payment info
      const matchedPaymentIndices = new Set<number>();
      
      installments = installments.map((installment) => {
        // Find first unused matching payment record
        const matchingPaymentIndex = paymentRows.findIndex((payment: any, index: number) => {
          if (matchedPaymentIndices.has(index)) return false;
          
          const paymentOrder = String(payment['# Orden'] || payment['#Orden'] || payment['Orden'] || '').trim();
          const paymentInstallmentStr = String(payment['# Cuota Pagada'] || payment['#CuotaPagada'] || payment['Cuota'] || '').trim();
          
          const orderMatches = paymentOrder === String(installment.orden).trim();
          
          if (paymentInstallmentStr) {
            const paymentCuotaNum = parseInt(paymentInstallmentStr, 10);
            return orderMatches && !isNaN(paymentCuotaNum) && paymentCuotaNum === installment.numeroCuota;
          }
          
          return false;
        });

        if (matchingPaymentIndex !== -1) {
          matchedPaymentIndices.add(matchingPaymentIndex);
          const matchingPayment = paymentRows[matchingPaymentIndex];
          
          // Use transaction date
          const fechaTasaCambio = matchingPayment['Fecha de Transaccion'] ||
                                  matchingPayment['FECHA DE TRANSACCION'] ||
                                  matchingPayment['Fecha de Transacción'] ||
                                  matchingPayment['FECHA DE TRANSACCIÓN'];
          
          const parsedDate = fechaTasaCambio ? parseExcelDate(fechaTasaCambio) : null;
          
          if (parsedDate) {
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
      
      // Step 2: Create payment-based entries for EVERY payment record
      const paymentBasedEntries: any[] = [];
      
      // Calculate payment splits for multi-cuota payments
      const paymentHeaders = apiData.data.headers || [];
      const paymentSplitsMap = calculatePaymentSplits(paymentRows, paymentHeaders, nonCancelledOrders);
      
      paymentRows.forEach((payment: any) => {
        const paymentOrder = String(payment['# Orden'] || payment['#Orden'] || payment['Orden'] || '').trim();
        const paymentInstallment = String(payment['# Cuota Pagada'] || payment['#CuotaPagada'] || payment['Cuota'] || '').trim();
        const montoPagado = payment['Monto Pagado en USD'] || payment['MONTO PAGADO EN USD'] || payment['Monto'] || 0;
        
        const fechaTasaCambio = payment['Fecha de Transaccion'] ||
                                payment['FECHA DE TRANSACCION'] ||
                                payment['Fecha de Transacción'] ||
                                payment['FECHA DE TRANSACCIÓN'];
        
        const parsedDate = fechaTasaCambio ? parseExcelDate(fechaTasaCambio) : null;
        
        if (paymentOrder) {
          const cuotaNumbers: number[] = [];
          
          if (paymentInstallment) {
            const cuotaParts = paymentInstallment.split(',').map(s => s.trim());
            for (const part of cuotaParts) {
              const parsed = parseInt(part, 10);
              if (!isNaN(parsed)) {
                cuotaNumbers.push(parsed);
              }
            }
          }
          
          if (cuotaNumbers.length === 0) {
            cuotaNumbers.push(-1);
          }
          
          cuotaNumbers.forEach((cuotaNumber) => {
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
            
            const verificacion = payment['VERIFICACION'] || '-';
            
            // Get split amount if this is a multi-cuota payment
            const referencia = payment['# Referencia'] || payment['#Referencia'] || payment['Referencia'];
            const splitKey = `${referencia}-${paymentOrder}-${cuotaNumber}`;
            const splitInfo = paymentSplitsMap.get(splitKey);
            
            // Use split amount if available, otherwise use full payment amount
            const displayAmount = splitInfo?.splitAmount || (typeof montoPagado === 'number' ? montoPagado : parseFloat(String(montoPagado || 0).replace(/[^0-9.-]/g, '')) || 0);
            
            paymentBasedEntries.push({
              orden: paymentOrder,
              fechaCuota: fechaCuotaValue,
              numeroCuota: cuotaNumber,
              monto: displayAmount,
              estadoCuota: 'Done',
              fechaPago: null,
              fechaPagoReal: parsedDate,
              isPaymentBased: true,
              splitInfo: splitInfo || null,
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
      
      installments = [...installments, ...paymentBasedEntries];
    }

    // Determine installment status
    const gracePeriodThreshold = new Date();
    gracePeriodThreshold.setDate(gracePeriodThreshold.getDate() - 3);
    gracePeriodThreshold.setHours(23, 59, 59, 999);
    
    installments = installments.map((installment) => {
      const paymentDateRaw = installment.fechaPagoReal || installment.fechaPago;
      const estadoLower = (installment.estadoCuota || '').trim().toLowerCase();
      const isScheduledOrGraced = estadoLower === 'scheduled' || estadoLower === 'graced';
      const fechaCuota = installment.fechaCuota;
      
      const paymentDate = paymentDateRaw ? parseExcelDate(paymentDateRaw) : null;
      
      if (isScheduledOrGraced && paymentDate && fechaCuota) {
        const cuotaDate = fechaCuota instanceof Date ? fechaCuota : parseExcelDate(fechaCuota);
        
        if (cuotaDate && paymentDate <= cuotaDate) {
          return { ...installment, estadoCuota: 'Done' };
        }
      }
      
      if (fechaCuota && isScheduledOrGraced && !paymentDate) {
        const cuotaDate = fechaCuota instanceof Date ? new Date(fechaCuota) : parseExcelDate(fechaCuota);
        
        if (cuotaDate) {
          cuotaDate.setHours(23, 59, 59, 999);
          
          if (cuotaDate < gracePeriodThreshold) {
            return { ...installment, estadoCuota: 'Delayed' };
          }
        }
      }
      
      return installment;
    });

    // Add STATUS field to each installment
    installments = installments.map((installment) => ({
      ...installment,
      status: calculateInstallmentStatus(installment)
    }));

    return installments;
  }, [tableData, paymentRecordsData]);

  // Apply filters to installments - FILTER BY PAYMENT DATE (fechaPagoReal/fechaPago)
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
      // Master date range filter - USE PAYMENT DATE (fechaPagoReal/fechaPago)
      if (masterDateFrom || masterDateTo) {
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

      // TAB-SPECIFIC FILTERS - Applied AFTER master filters
      // Date range filter - USE PAYMENT DATE (fechaPagoReal/fechaPago)
      if ((dateFrom || dateTo) && !masterDateFrom && !masterDateTo) {
        const effectiveDate = installment.fechaPagoReal || installment.fechaPago;
        
        // When date filtering is active, exclude cuotas without payment date
        if (!effectiveDate) return false;
        
        const installmentDate = typeof effectiveDate === 'string' ? parseExcelDate(effectiveDate) : effectiveDate;
        
        if (installmentDate) {
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

      // CRITICAL: Only include payment-based entries (matching ConciliacionPagosTable logic)
      // This ensures consistency between AllPagosInstallments and ConciliacionPagosTable
      if (!installment.isPaymentBased) return false;

      return true;
    });
  }, [allInstallments, dateFrom, dateTo, ordenFilter, estadoCuotaFilter, masterDateFrom, masterDateTo, masterOrden, tableData]);

  // Notify parent component when filtered installments change
  useEffect(() => {
    if (onFilteredInstallmentsChange) {
      onFilteredInstallmentsChange(filteredInstallments);
    }
  }, [filteredInstallments, onFilteredInstallmentsChange]);

  // This component doesn't render anything - it just provides data
  return null;
}
