import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";
import { normalizeNumber } from "@shared/numberUtils";
import { parseDDMMYYYY, parseExcelDate } from "@/lib/dateUtils";
import { calculateInstallmentStatus } from "@/lib/installmentUtils";

interface MonthlyReportProps {
  marketplaceData: any;
  dateFrom: string;
  dateTo: string;
  estadoFilter: string;
  ordenFilter: string;
  estadoEntregaFilter: string;
  referenciaFilter: string;
  masterDateFrom?: string;
  masterDateTo?: string;
  masterOrden?: string;
  paymentRecordsData?: any[];
  paymentRecordsHeaders?: string[];
  ordersData?: any[];
  bankStatementRows?: any[];
  bankStatementHeaders?: string[];
  cuotasAdelantadasPeriodosAnteriores?: number;
}

export function MonthlyReport({ 
  marketplaceData,
  dateFrom,
  dateTo,
  estadoFilter,
  ordenFilter,
  estadoEntregaFilter,
  referenciaFilter,
  masterDateFrom,
  masterDateTo,
  masterOrden,
  paymentRecordsData = [],
  paymentRecordsHeaders = [],
  ordersData = [],
  bankStatementRows = [],
  bankStatementHeaders = [],
  cuotasAdelantadasPeriodosAnteriores = 0,
}: MonthlyReportProps) {
  const data = marketplaceData?.data?.rows || [];
  const headers = marketplaceData?.data?.headers || [];

  // Helper function to find column names (case-insensitive)
  const findColumn = (name: string) => {
    return headers.find((h: string) => h.toLowerCase().includes(name.toLowerCase()));
  };

  // Function to verify if a payment exists in bank statements (reused from PaymentRecordsDashboard)
  const verifyPaymentInBankStatement = useMemo(() => {
    // Find relevant headers in bank statement (case-insensitive)
    const referenciaHeader = bankStatementHeaders?.find(h => 
      h.toLowerCase().includes('referencia')
    );
    const debeHeader = bankStatementHeaders?.find(h => 
      h.toLowerCase().includes('debe')
    );
    const haberHeader = bankStatementHeaders?.find(h => 
      h.toLowerCase().includes('haber')
    );

    return (record: any): string => {
      // If no bank statements available, return "NO"
      if (!bankStatementRows || bankStatementRows.length === 0) {
        return 'NO';
      }

      const paymentRef = record['# Referencia'];
      const paymentAmountVES = record['Monto Pagado en VES'] || record['Monto pagado en VES'];
      const paymentAmountUSD = record['Monto Pagado en USD'] || record['Monto pagado en USD'];

      // If no reference or amounts, can't verify
      if (!paymentRef || (!paymentAmountVES && !paymentAmountUSD)) {
        return 'NO';
      }

      // Normalize payment reference (remove spaces, leading zeros, quotes)
      const normalizedPaymentRef = String(paymentRef).replace(/\s+/g, '').replace(/^0+/, '').replace(/['"]/g, '').toLowerCase();

      // Normalize payment amounts
      const normalizedVES = paymentAmountVES ? normalizeNumber(paymentAmountVES) : null;
      const normalizedUSD = paymentAmountUSD ? normalizeNumber(paymentAmountUSD) : null;

      // Search bank statements for matching reference and amount
      const found = bankStatementRows.some(bankRow => {
        // Check reference match
        if (referenciaHeader) {
          const bankRef = bankRow[referenciaHeader];
          if (bankRef) {
            const normalizedBankRef = String(bankRef).replace(/\s+/g, '').replace(/^0+/, '').replace(/['"]/g, '').toLowerCase();
            if (normalizedBankRef !== normalizedPaymentRef) {
              return false;
            }
          } else {
            return false;
          }
        } else {
          return false;
        }

        // Reference matches, now check amount
        let amountFound = false;

        if (debeHeader) {
          const debeAmount = bankRow[debeHeader];
          if (debeAmount) {
            const normalizedDebe = normalizeNumber(debeAmount);
            if (!isNaN(normalizedDebe)) {
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
    };
  }, [bankStatementRows, bankStatementHeaders]);

  const estadoColumn = findColumn("estado pago");
  const ordenColumn = findColumn("# orden") || findColumn("orden");
  const estadoEntregaColumn = findColumn("estado de entrega") || findColumn("entrega");
  const referenciaColumn = findColumn("# referencia") || findColumn("referencia");
  const dateColumn = findColumn("fecha") || findColumn("date") || headers.find((h: string) => h.toLowerCase().includes("fecha"));

  // Apply filters to get filtered data (same logic as MarketplaceOrdersTable)
  const filteredData = useMemo(() => {
    return data.filter((row: any) => {
      // MASTER FILTERS - Applied FIRST
      // Master date filter (if date column exists)
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
      if (masterOrden && ordenColumn) {
        const rowOrden = String(row[ordenColumn] || "").toLowerCase();
        if (!rowOrden.includes(masterOrden.toLowerCase())) return false;
      }

      // TAB-SPECIFIC FILTERS - Applied AFTER master filters
      // Date filter (if date column exists)
      if (dateColumn && (dateFrom || dateTo)) {
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
            if (dateFrom) {
              const fromDate = parseDDMMYYYY(dateFrom);
              if (fromDate && rowDateObj < fromDate) return false;
            }
            if (dateTo) {
              const toDate = parseDDMMYYYY(dateTo);
              if (toDate) {
                const endOfDay = new Date(toDate);
                endOfDay.setHours(23, 59, 59, 999);
                if (rowDateObj > endOfDay) return false;
              }
            }
          }
        }
      }

      // Estado filter
      if (estadoFilter !== "all" && estadoColumn) {
        const rowEstado = String(row[estadoColumn] || "");
        if (rowEstado !== estadoFilter) return false;
      }

      // Orden filter
      if (ordenFilter && ordenColumn) {
        const rowOrden = String(row[ordenColumn] || "").toLowerCase();
        if (!rowOrden.includes(ordenFilter.toLowerCase())) return false;
      }

      // Estado de entrega filter
      if (estadoEntregaFilter !== "all" && estadoEntregaColumn) {
        const rowEstadoEntrega = String(row[estadoEntregaColumn] || "");
        if (rowEstadoEntrega !== estadoEntregaFilter) return false;
      }

      // Referencia filter
      if (referenciaFilter && referenciaColumn) {
        const rowReferencia = String(row[referenciaColumn] || "").toLowerCase();
        if (!rowReferencia.includes(referenciaFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [data, dateFrom, dateTo, estadoFilter, ordenFilter, estadoEntregaFilter, referenciaFilter, dateColumn, estadoColumn, ordenColumn, estadoEntregaColumn, referenciaColumn, masterDateFrom, masterDateTo, masterOrden]);

  const metrics = useMemo(() => {
    // Apply master filters to payment records data
    const filteredPaymentRecords = paymentRecordsData.filter((record: any) => {
      // Master date filter
      const fechaTransaccionHeader = paymentRecordsHeaders.find((h: string) => 
        h.toLowerCase().includes('fecha') && h.toLowerCase().includes('transac')
      );
      
      if ((masterDateFrom || masterDateTo) && fechaTransaccionHeader) {
        const recordDate = parseExcelDate(record[fechaTransaccionHeader]);
        if (recordDate) {
          if (masterDateFrom) {
            const fromDate = parseDDMMYYYY(masterDateFrom);
            if (fromDate && recordDate < fromDate) return false;
          }
          if (masterDateTo) {
            const toDate = parseDDMMYYYY(masterDateTo);
            if (toDate) {
              const endOfDay = new Date(toDate);
              endOfDay.setHours(23, 59, 59, 999);
              if (recordDate > endOfDay) return false;
            }
          }
        }
      }
      
      // Master orden filter
      if (masterOrden) {
        const ordenHeader = paymentRecordsHeaders.find((h: string) => 
          h.toLowerCase().includes('orden') && !h.toLowerCase().includes('cuota')
        );
        if (ordenHeader) {
          const recordOrden = String(record[ordenHeader] || "").toLowerCase();
          if (!recordOrden.includes(masterOrden.toLowerCase())) return false;
        }
      }
      
      return true;
    });
    
    // Apply master filters to orders data
    const filteredOrders = ordersData.filter((order: any) => {
      // Master orden filter
      if (masterOrden) {
        const ordenNum = String(order['Orden'] || "").toLowerCase();
        if (!ordenNum.includes(masterOrden.toLowerCase())) return false;
      }
      
      return true;
    });
    
    if (!filteredData || filteredData.length === 0) {
      return {
        totalVentas: 0,
        totalPagoInicial: 0,
        montoFinanciado: 0,
        porcentajeFinanciado: 0,
        serviciosPrestados: 0,
        iva16: 0,
        ivaRetenido: 0,
        ivaPagarCashea: 0,
        islrRetenido: 0,
        totalServiciosTecnologicos: 0,
      };
    }

    const totalUsdColumn = findColumn("total usd") || findColumn("total") || "";
    const pagoInicialColumn = findColumn("pago inicial usd") || findColumn("pago inicial") || findColumn("inicial") || "";

    let totalVentas = 0;
    let totalPagoInicial = 0;

    filteredData.forEach((row: any) => {
      const totalUsdValue = normalizeNumber(row[totalUsdColumn]);
      const totalUsd = isNaN(totalUsdValue) ? 0 : totalUsdValue;
      const pagoInicialValue = normalizeNumber(row[pagoInicialColumn]);
      const pagoInicial = isNaN(pagoInicialValue) ? 0 : pagoInicialValue;

      totalVentas += totalUsd;
      totalPagoInicial += pagoInicial;
    });

    const montoFinanciado = totalVentas - totalPagoInicial;
    const porcentajeFinanciado = totalVentas > 0 ? (montoFinanciado / totalVentas) * 100 : 0;

    // TODO: Calculate these values based on user's explanation
    const serviciosPrestados = 0;
    const iva16 = 0;
    const ivaRetenido = 0;
    const ivaPagarCashea = 0;
    const islrRetenido = 0;
    const totalServiciosTecnologicos = 0;

    // Calculate bank reconciliation values
    
    // 1. Recibido en Banco = sum of payment amounts where verificacion = SI
    let recibidoEnBanco = 0;
    const montoUsdHeader = paymentRecordsHeaders.find((h: string) => 
      h.toLowerCase().includes('monto') && 
      h.toLowerCase().includes('pagado') && 
      h.toLowerCase().includes('usd')
    );
    
    if (montoUsdHeader && filteredPaymentRecords.length > 0) {
      filteredPaymentRecords.forEach((record: any) => {
        const verificacion = verifyPaymentInBankStatement(record);
        if (verificacion === 'SI') {
          const montoValue = normalizeNumber(record[montoUsdHeader]);
          if (!isNaN(montoValue)) {
            recibidoEnBanco += montoValue;
          }
        }
      });
    }
    
    // 2. Cuotas adelantadas de clientes = sum of installments with ADELANTADO status
    // We need to calculate this from ordersData by extracting installments and checking status
    let cuotasAdelantadasClientes = 0;
    if (filteredOrders.length > 0 && filteredPaymentRecords.length > 0) {
      // Extract installments from orders (similar to WeeklyPaymentsTable logic)
      const installments: any[] = [];
      
      filteredOrders.forEach((order: any) => {
        const ordenNum = order['Orden'];
        if (!ordenNum) return;
        
        // Find all cuota columns
        const cuotaKeys = Object.keys(order).filter(key => 
          key.toLowerCase().includes('cuota') && 
          key !== 'Cuota 0' && 
          key !== 'Estado de cuota'
        );
        
        cuotaKeys.forEach(cuotaKey => {
          const match = cuotaKey.match(/Cuota\s+(\d+)/i);
          if (match) {
            const cuotaNum = parseInt(match[1]);
            const cuotaAmount = order[cuotaKey];
            const cuotaDate = order[`Fecha Cuota ${cuotaNum}`];
            
            if (cuotaAmount && cuotaDate) {
              installments.push({
                orden: ordenNum,
                cuotaNum,
                cuotaAmount: normalizeNumber(cuotaAmount),
                cuotaDate,
              });
            }
          }
        });
      });
      
      // For each installment, find payment and check if ADELANTADO
      installments.forEach(inst => {
        // Find payment record for this installment
        const ordenHeader = paymentRecordsHeaders.find((h: string) => 
          h.toLowerCase().includes('orden') && !h.toLowerCase().includes('cuota')
        );
        const cuotaHeader = paymentRecordsHeaders.find((h: string) => 
          h.toLowerCase().includes('cuota') && h.toLowerCase().includes('pagada')
        );
        const fechaPagoHeader = paymentRecordsHeaders.find((h: string) => 
          h.toLowerCase().includes('fecha') && h.toLowerCase().includes('pago')
        );
        
        if (!ordenHeader || !cuotaHeader || !fechaPagoHeader) return;
        
        const payment = filteredPaymentRecords.find((p: any) => {
          const pOrden = String(p[ordenHeader] || '');
          const pCuota = String(p[cuotaHeader] || '');
          
          return pOrden === String(inst.orden) && pCuota === String(inst.cuotaNum);
        });
        
        if (payment) {
          const fechaPago = parseExcelDate(payment[fechaPagoHeader]);
          const fechaCuota = parseExcelDate(inst.cuotaDate);
          
          if (fechaPago && fechaCuota) {
            const daysDiff = Math.floor((fechaCuota.getTime() - fechaPago.getTime()) / (1000 * 60 * 60 * 24));
            const pagoMonth = fechaPago.getMonth();
            const pagoYear = fechaPago.getFullYear();
            const cuotaMonth = fechaCuota.getMonth();
            const cuotaYear = fechaCuota.getFullYear();
            
            // ADELANTADO: Payment made at least 15 days before due date AND cuota month is after payment month
            if (daysDiff <= -15) {
              if (cuotaYear > pagoYear || (cuotaYear === pagoYear && cuotaMonth > pagoMonth)) {
                cuotasAdelantadasClientes += inst.cuotaAmount;
              }
            }
          }
        }
      });
    }
    
    // 3. Pago inicial de clientes en App = Pago Inicial Depositado (cuota 0 with verificacion = SI)
    let pagoInicialClientesApp = 0;
    const ordenHeaderPayment = paymentRecordsHeaders.find((h: string) => 
      h.toLowerCase().includes('orden') && !h.toLowerCase().includes('cuota')
    );
    const cuotaHeaderPayment = paymentRecordsHeaders.find((h: string) => 
      h.toLowerCase().includes('cuota') && h.toLowerCase().includes('pagada')
    );
    
    if (ordenHeaderPayment && cuotaHeaderPayment && montoUsdHeader) {
      filteredPaymentRecords.forEach((record: any) => {
        const cuotaValue = String(record[cuotaHeaderPayment] || '');
        const cuotaNumbers = cuotaValue.split(',').map(c => c.trim()).filter(c => c);
        
        // Check if this is exactly cuota 0 (not multi-installment like "0,1,2")
        if (cuotaNumbers.length === 1 && parseInt(cuotaNumbers[0]) === 0) {
          const ordenNum = record[ordenHeaderPayment];
          
          // Only include if order exists in filteredOrders
          if (ordenNum && filteredOrders.some((o: any) => String(o['Orden']) === String(ordenNum))) {
            const verificacion = verifyPaymentInBankStatement(record);
            if (verificacion === 'SI') {
              const montoValue = normalizeNumber(record[montoUsdHeader]);
              if (!isNaN(montoValue)) {
                pagoInicialClientesApp += montoValue;
              }
            }
          }
        }
      });
    }
    // 4. Depositos de otros aliados = sum of installments with STATUS=OTRO ALIADO
    // OTRO ALIADO: Payment exists but no scheduled cuota date (fechaCuota == null)
    // Create payment-based installment entries similar to AllInstallments logic
    let depositosOtrosAliadosBanco = 0;
    if (filteredPaymentRecords.length > 0 && ordersData.length > 0) {
      const ordenHeaderPmt = paymentRecordsHeaders.find((h: string) => 
        h.toLowerCase().includes('orden') && !h.toLowerCase().includes('cuota')
      );
      const cuotaHeaderPmt = paymentRecordsHeaders.find((h: string) => 
        h.toLowerCase().includes('cuota') && h.toLowerCase().includes('pagada')
      );
      
      if (ordenHeaderPmt && cuotaHeaderPmt && montoUsdHeader) {
        // Create installment entries from payment records (one per cuota)
        const paymentInstallments: any[] = [];
        
        filteredPaymentRecords.forEach((record: any) => {
          const ordenNum = String(record[ordenHeaderPmt] || '').trim();
          const cuotaValue = String(record[cuotaHeaderPmt] || '').trim();
          const montoPagado = normalizeNumber(record[montoUsdHeader]);
          const verificacion = record['VERIFICACION'] || 'NO';
          
          if (!ordenNum || isNaN(montoPagado)) return;
          
          // Parse cuota numbers (split by comma)
          const cuotaNumbers: number[] = [];
          if (cuotaValue) {
            const parts = cuotaValue.split(',').map(s => s.trim());
            for (const part of parts) {
              const parsed = parseInt(part, 10);
              if (!isNaN(parsed)) {
                cuotaNumbers.push(parsed);
              }
            }
          }
          
          // If no valid cuota numbers, use -1 as sentinel
          if (cuotaNumbers.length === 0) {
            cuotaNumbers.push(-1);
          }
          
          // Create one installment entry per cuota
          cuotaNumbers.forEach(cuotaNum => {
            // Look up scheduled date from orders (with order number normalization)
            let scheduledDate = null;
            const matchingOrder = ordersData.find((o: any) => {
              const orderNum = String(o['Orden'] || '').trim();
              // Normalize order numbers: remove leading zeros and compare
              const normalizedOrderNum = orderNum.replace(/^0+/, '') || '0';
              const normalizedPaymentOrder = ordenNum.replace(/^0+/, '') || '0';
              return normalizedOrderNum === normalizedPaymentOrder;
            });
            
            if (matchingOrder && cuotaNum >= 0) {
              if (cuotaNum === 0) {
                // For cuota 0, use purchase date
                const fechaCompra = matchingOrder['FECHA DE COMPRA'] || 
                                   matchingOrder['Fecha de Compra'] || 
                                   matchingOrder['Fecha de compra'] || 
                                   matchingOrder['Fecha Compra'];
                if (fechaCompra) {
                  scheduledDate = fechaCompra;
                }
              } else {
                // For other cuotas, look for scheduled date (try both capitalizations)
                const cuotaDateKey1 = `Fecha Cuota ${cuotaNum}`;
                const cuotaDateKey2 = `Fecha cuota ${cuotaNum}`;
                scheduledDate = matchingOrder[cuotaDateKey1] || matchingOrder[cuotaDateKey2];
              }
            }
            
            paymentInstallments.push({
              orden: ordenNum,
              cuotaNum,
              monto: montoPagado / cuotaNumbers.length, // Divide amount by number of cuotas
              scheduledDate,
              verificacion, // Include VERIFICACION status
            });
          });
        });
        
        // Sum amounts for installments with no scheduled date (OTRO ALIADO) AND VERIFICACION = SI
        paymentInstallments.forEach(inst => {
          if (!inst.scheduledDate && inst.verificacion === 'SI') {
            depositosOtrosAliadosBanco += inst.monto;
          }
        });
      }
    }
    
    // 5. Banco neto = Recibido - Cuotas adelantadas - Pago inicial - Devoluciones - Depositos otros aliados
    const devolucionesPagoClientesBanco = 0; // Assume 0 as specified by user
    const bancoNetoCuotasReconocidas = recibidoEnBanco - cuotasAdelantadasClientes - pagoInicialClientesApp - devolucionesPagoClientesBanco - depositosOtrosAliadosBanco;
    
    // 6. Cuentas por Cobrar = sum of installment amounts within the date period
    // This calculation matches the Dashboard component in "TODAS LAS ORDENES" tab
    let cuentasPorCobrar = 0;
    
    // Helper function to check if an order is cancelled
    const isCancelledOrder = (row: any): boolean => {
      const statusOrden = String(row["STATUS ORDEN"] || "").toLowerCase().trim();
      return statusOrden.includes("cancel");
    };
    
    // Determine effective date range (combine master and local filters - most restrictive)
    let effectiveDateFrom: Date | null = null;
    let effectiveDateTo: Date | null = null;
    
    // Start with master filters
    if (masterDateFrom) {
      effectiveDateFrom = parseDDMMYYYY(masterDateFrom);
    }
    if (masterDateTo) {
      effectiveDateTo = parseDDMMYYYY(masterDateTo);
      if (effectiveDateTo) {
        effectiveDateTo.setHours(23, 59, 59, 999);
      }
    }
    
    // Apply local filters (use the more restrictive date)
    if (dateFrom) {
      const localFrom = parseDDMMYYYY(dateFrom);
      if (localFrom) {
        if (!effectiveDateFrom || localFrom > effectiveDateFrom) {
          effectiveDateFrom = localFrom;
        }
      }
    }
    if (dateTo) {
      const localTo = parseDDMMYYYY(dateTo);
      if (localTo) {
        localTo.setHours(23, 59, 59, 999);
        if (!effectiveDateTo || localTo < effectiveDateTo) {
          effectiveDateTo = localTo;
        }
      }
    }
    
    // Calculate cuentas por cobrar from ALL orders (not filteredOrders) to avoid double-filtering
    // Only apply filters once: master orden filter + date range filter on installment dates
    if (effectiveDateFrom || effectiveDateTo) {
      ordersData.forEach((order: any) => {
        // Skip cancelled orders
        if (isCancelledOrder(order)) {
          return;
        }
        
        // Apply master orden filter
        if (masterOrden) {
          const ordenNum = String(order['Orden'] || "").toLowerCase();
          if (!ordenNum.includes(masterOrden.toLowerCase())) {
            return;
          }
        }
        
        // Process cuotas 1-14 (regular installments only, excluding Cuota 0/PAGO INICIAL)
        for (let i = 1; i <= 14; i++) {
          const fechaCuotaStr = order[`Fecha cuota ${i}`] || order[`Fecha Cuota ${i}`];
          const cuotaMontoStr = order[`Cuota ${i}`];
          
          if (fechaCuotaStr && cuotaMontoStr) {
            const cuotaMonto = normalizeNumber(cuotaMontoStr);
            
            if (!isNaN(cuotaMonto) && cuotaMonto > 0) {
              // Parse the date using the proper utility function
              const fechaCuota = parseExcelDate(fechaCuotaStr);
              
              if (fechaCuota && !isNaN(fechaCuota.getTime())) {
                // Check if date is within the effective period
                const withinPeriod = 
                  (!effectiveDateFrom || fechaCuota >= effectiveDateFrom) && 
                  (!effectiveDateTo || fechaCuota <= effectiveDateTo);
                
                if (withinPeriod) {
                  cuentasPorCobrar += cuotaMonto;
                }
              }
            }
          }
        }
      });
    }
    
    // 6. Calculate cuotasAdelantadasPeriodosAnteriores respecting MASTER filters (same as CONCILIACION DE CUOTAS)
    // This should match what's shown in CONCILIACION DE CUOTAS dashboard
    let calculatedCuotasAdelantadas = 0;
    
    if (ordersData.length > 0 && paymentRecordsData.length > 0) {
      // Apply master orden filter to orders
      const masterFilteredOrders = ordersData.filter((order: any) => {
        if (masterOrden) {
          const ordenNum = String(order['Orden'] || "").toLowerCase();
          if (!ordenNum.includes(masterOrden.toLowerCase())) return false;
        }
        return true;
      });
      
      // Apply master filters to payment records
      const masterFilteredPayments = paymentRecordsData.filter((record: any) => {
        // Master orden filter
        if (masterOrden) {
          const ordenHeader = paymentRecordsHeaders.find((h: string) => 
            h.toLowerCase().includes('orden') && !h.toLowerCase().includes('cuota')
          );
          if (ordenHeader) {
            const recordOrden = String(record[ordenHeader] || "").toLowerCase();
            if (!recordOrden.includes(masterOrden.toLowerCase())) return false;
          }
        }
        
        // Master date filter (using transaction date)
        if (masterDateFrom || masterDateTo) {
          const fechaTransaccionHeader = paymentRecordsHeaders.find((h: string) => 
            h.toLowerCase().includes('fecha') && h.toLowerCase().includes('transac')
          );
          if (fechaTransaccionHeader) {
            const recordDate = parseExcelDate(record[fechaTransaccionHeader]);
            if (recordDate) {
              if (masterDateFrom) {
                const fromDate = parseDDMMYYYY(masterDateFrom);
                if (fromDate && recordDate < fromDate) return false;
              }
              if (masterDateTo) {
                const toDate = parseDDMMYYYY(masterDateTo);
                if (toDate) {
                  const endOfDay = new Date(toDate);
                  endOfDay.setHours(23, 59, 59, 999);
                  if (recordDate > endOfDay) return false;
                }
              }
            }
          }
        }
        
        return true;
      });
      
      // Extract installments from filtered orders
      const installments: any[] = [];
      
      masterFilteredOrders.forEach((order: any) => {
        const ordenNum = order['Orden'];
        if (!ordenNum) return;
        
        // Process cuotas 1-14 (regular installments)
        for (let i = 1; i <= 14; i++) {
          const fechaCuotaValue = order[`Fecha cuota ${i}`] || order[`Fecha Cuota ${i}`];
          const montoValue = order[`Cuota ${i}`];
          const estadoValue = order[`Estado cuota ${i}`] || order[`Estado Cuota ${i}`] || order[`Estado de cuota ${i}`];
          
          if (fechaCuotaValue && montoValue) {
            const monto = normalizeNumber(montoValue);
            const fechaCuota = parseExcelDate(fechaCuotaValue);
            
            if (!isNaN(monto) && monto > 0 && fechaCuota) {
              installments.push({
                orden: ordenNum,
                cuotaNum: i,
                monto,
                fechaCuota,
                estadoCuota: estadoValue || '',
              });
            }
          }
        }
      });
      
      // Match with payments
      const ordenHeaderPmt = paymentRecordsHeaders.find((h: string) => 
        h.toLowerCase().includes('orden') && !h.toLowerCase().includes('cuota')
      );
      const cuotaHeaderPmt = paymentRecordsHeaders.find((h: string) => 
        h.toLowerCase().includes('cuota') && h.toLowerCase().includes('pagada')
      );
      const fechaPagoHeader = paymentRecordsHeaders.find((h: string) => 
        h.toLowerCase().includes('fecha') && (h.toLowerCase().includes('pago') || h.toLowerCase().includes('transac'))
      );
      
      if (ordenHeaderPmt && cuotaHeaderPmt && fechaPagoHeader) {
        installments.forEach(inst => {
          const payment = masterFilteredPayments.find((p: any) => {
            const pOrden = String(p[ordenHeaderPmt] || '');
            const pCuota = String(p[cuotaHeaderPmt] || '');
            const cuotaNumbers = pCuota.split(',').map(c => c.trim()).filter(c => c);
            return pOrden === String(inst.orden) && cuotaNumbers.includes(String(inst.cuotaNum));
          });
          
          if (payment) {
            const fechaPagoValue = parseExcelDate(payment[fechaPagoHeader]);
            const status = calculateInstallmentStatus({
              fechaCuota: inst.fechaCuota,
              fechaPagoReal: fechaPagoValue,
              estadoCuota: inst.estadoCuota,
            });
            
            const estadoNormalized = (inst.estadoCuota || '').trim().toLowerCase();
            if (estadoNormalized === 'done' && status === 'ADELANTADO') {
              calculatedCuotasAdelantadas += inst.monto;
            }
            
            // Store STATUS on installment for later use
            inst.status = status;
          }
        });
      }
    }
    
    // 7. Calculate depositosBancoOtrosAliados (same as "Depósitos Otros Bancos" dashboard card)
    // Sum of payments where Estado Cuota = 'done' AND STATUS = 'NO DEPOSITADO'
    let calculatedDepositosBancoOtrosAliados = 0;
    if (ordersData.length > 0 && paymentRecordsData.length > 0) {
      // Reuse the same installments array from above calculation
      const masterFilteredOrders = ordersData.filter((order: any) => {
        if (masterOrden) {
          const ordenNum = String(order['Orden'] || "").toLowerCase();
          if (!ordenNum.includes(masterOrden.toLowerCase())) return false;
        }
        return true;
      });
      
      const masterFilteredPayments = paymentRecordsData.filter((record: any) => {
        if (masterOrden) {
          const ordenHeader = paymentRecordsHeaders.find((h: string) => 
            h.toLowerCase().includes('orden') && !h.toLowerCase().includes('cuota')
          );
          if (ordenHeader) {
            const recordOrden = String(record[ordenHeader] || "").toLowerCase();
            if (!recordOrden.includes(masterOrden.toLowerCase())) return false;
          }
        }
        
        if (masterDateFrom || masterDateTo) {
          const fechaTransaccionHeader = paymentRecordsHeaders.find((h: string) => 
            h.toLowerCase().includes('fecha') && h.toLowerCase().includes('transac')
          );
          if (fechaTransaccionHeader) {
            const recordDate = parseExcelDate(record[fechaTransaccionHeader]);
            if (recordDate) {
              if (masterDateFrom) {
                const fromDate = parseDDMMYYYY(masterDateFrom);
                if (fromDate && recordDate < fromDate) return false;
              }
              if (masterDateTo) {
                const toDate = parseDDMMYYYY(masterDateTo);
                if (toDate) {
                  const endOfDay = new Date(toDate);
                  endOfDay.setHours(23, 59, 59, 999);
                  if (recordDate > endOfDay) return false;
                }
              }
            }
          }
        }
        
        return true;
      });
      
      const installmentsForNoDepositado: any[] = [];
      
      masterFilteredOrders.forEach((order: any) => {
        const ordenNum = order['Orden'];
        if (!ordenNum) return;
        
        for (let i = 1; i <= 14; i++) {
          const fechaCuotaValue = order[`Fecha cuota ${i}`] || order[`Fecha Cuota ${i}`];
          const montoValue = order[`Cuota ${i}`];
          const estadoValue = order[`Estado cuota ${i}`] || order[`Estado Cuota ${i}`] || order[`Estado de cuota ${i}`];
          
          if (fechaCuotaValue && montoValue) {
            const monto = normalizeNumber(montoValue);
            const fechaCuota = parseExcelDate(fechaCuotaValue);
            
            if (!isNaN(monto) && monto > 0 && fechaCuota) {
              installmentsForNoDepositado.push({
                orden: ordenNum,
                cuotaNum: i,
                monto,
                fechaCuota,
                estadoCuota: estadoValue || '',
              });
            }
          }
        }
      });
      
      const ordenHeaderPmt = paymentRecordsHeaders.find((h: string) => 
        h.toLowerCase().includes('orden') && !h.toLowerCase().includes('cuota')
      );
      const cuotaHeaderPmt = paymentRecordsHeaders.find((h: string) => 
        h.toLowerCase().includes('cuota') && h.toLowerCase().includes('pagada')
      );
      const fechaPagoHeader = paymentRecordsHeaders.find((h: string) => 
        h.toLowerCase().includes('fecha') && (h.toLowerCase().includes('pago') || h.toLowerCase().includes('transac'))
      );
      
      if (ordenHeaderPmt && cuotaHeaderPmt && fechaPagoHeader) {
        installmentsForNoDepositado.forEach(inst => {
          const payment = masterFilteredPayments.find((p: any) => {
            const pOrden = String(p[ordenHeaderPmt] || '');
            const pCuota = String(p[cuotaHeaderPmt] || '');
            const cuotaNumbers = pCuota.split(',').map(c => c.trim()).filter(c => c);
            return pOrden === String(inst.orden) && cuotaNumbers.includes(String(inst.cuotaNum));
          });
          
          if (payment) {
            const fechaPagoValue = parseExcelDate(payment[fechaPagoHeader]);
            const status = calculateInstallmentStatus({
              fechaCuota: inst.fechaCuota,
              fechaPagoReal: fechaPagoValue,
              estadoCuota: inst.estadoCuota,
            });
            
            const estadoNormalized = (inst.estadoCuota || '').trim().toLowerCase();
            if (estadoNormalized === 'done' && status === 'NO DEPOSITADO') {
              calculatedDepositosBancoOtrosAliados += inst.monto;
            }
          }
        });
      }
    }
    
    // Use calculated value (ignoring the prop for now since it's always 0)
    const finalCuotasAdelantadas = calculatedCuotasAdelantadas;
    const cuentasPorCobrarNeto = cuentasPorCobrar - finalCuotasAdelantadas;
    const subtotalConciliacionBancoNeto = bancoNetoCuotasReconocidas - cuentasPorCobrarNeto;

    // TODO: Calculate reconciliation adjustments based on user's explanation
    const devolucionesPagoClientes = 0;
    const cupones = 0;
    const subtotalIncidencias = 0;
    // Make (+) Depósitos de otros aliados equal to (-) Depósitos de otros aliados from Resumen de banco
    const depositosOtrosAliados = depositosOtrosAliadosBanco;
    // Make (-) Depósitos en banco de otros aliados equal to "Depósitos Otros Bancos" dashboard card
    const depositosBancoOtrosAliados = calculatedDepositosBancoOtrosAliados;
    const subtotalErroresBancarios = 0;
    const compensacionFacturasPendientes = 0;
    const avanceCajaVencido = 0;
    const servTecnologicoOrdenesCanceladas = 0;
    const totalAvancesCaja = 0;
    const totalReconocer = 0;

    // TODO: Calculate factoring and final compensation based on user's explanation
    const cuotasVencidas = 0;
    const conciliacionBancoNeto = 0;
    const diferenciaFactoring = 0;
    const totalServiciosTecnologicosFinal = 0;
    const totalReconocerFinal = 0;
    const totalPagarCashea = 0;

    return {
      totalVentas,
      totalPagoInicial,
      montoFinanciado,
      porcentajeFinanciado,
      serviciosPrestados,
      iva16,
      ivaRetenido,
      ivaPagarCashea,
      islrRetenido,
      totalServiciosTecnologicos,
      recibidoEnBanco,
      cuotasAdelantadasClientes,
      pagoInicialClientesApp,
      devolucionesPagoClientesBanco,
      depositosOtrosAliadosBanco,
      bancoNetoCuotasReconocidas,
      cuentasPorCobrar,
      cuotasAdelantadasPeriodosAnteriores: finalCuotasAdelantadas,
      cuentasPorCobrarNeto,
      subtotalConciliacionBancoNeto,
      devolucionesPagoClientes,
      cupones,
      subtotalIncidencias,
      depositosOtrosAliados,
      depositosBancoOtrosAliados,
      subtotalErroresBancarios,
      compensacionFacturasPendientes,
      avanceCajaVencido,
      servTecnologicoOrdenesCanceladas,
      totalAvancesCaja,
      totalReconocer,
      cuotasVencidas,
      conciliacionBancoNeto,
      diferenciaFactoring,
      totalServiciosTecnologicosFinal,
      totalReconocerFinal,
      totalPagarCashea,
    };
  }, [filteredData, headers, paymentRecordsData, paymentRecordsHeaders, ordersData, bankStatementRows, bankStatementHeaders, masterDateFrom, masterDateTo, masterOrden, verifyPaymentInBankStatement]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    }).format(value);
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No hay datos disponibles</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Carga un archivo de marketplace desde la pestaña "CARGAR DATOS" para generar el reporte mensual
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Reporte Mensual</h2>
        <p className="text-muted-foreground">
          Resumen financiero basado en datos de marketplace
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Ventas de este periodo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="border-b pb-2 mb-2">
              <h3 className="font-semibold mb-3">VENTAS</h3>
            </div>
            
            <div className="flex justify-between items-center py-2">
              <span>Ventas Totales (incluye IVA)</span>
              <span className="font-mono text-right" data-testid="ventas-totales">
                {formatCurrency(metrics.totalVentas)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span>(-) Monto Pagado en Caja</span>
              <span className="font-mono text-right" data-testid="monto-pagado-caja">
                {formatCurrency(metrics.totalPagoInicial)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 bg-muted/50 px-3 -mx-3 rounded-md">
              <span className="font-semibold">Monto Financiado</span>
              <span className="font-mono font-semibold text-right" data-testid="monto-financiado">
                {formatCurrency(metrics.montoFinanciado)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="italic text-muted-foreground">Porcentaje Financiado</span>
              <span className="font-mono text-right italic text-muted-foreground" data-testid="porcentaje-financiado">
                {metrics.porcentajeFinanciado.toFixed(0)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SERVICIOS TECNOLÓGICOS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span>Servicios Prestados</span>
              <span className="font-mono text-right" data-testid="servicios-prestados">
                {formatCurrency(metrics.serviciosPrestados)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span>(+) IVA 16%</span>
              <span className="font-mono text-right" data-testid="iva-16">
                {formatCurrency(metrics.iva16)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span>(-) IVA retenido por aliado (75%)</span>
              <span className="font-mono text-right" data-testid="iva-retenido">
                {formatCurrency(metrics.ivaRetenido)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span>IVA a pagar a CASHEA</span>
              <span className="font-mono text-right" data-testid="iva-pagar-cashea">
                {formatCurrency(metrics.ivaPagarCashea)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span>(-) ISLR retenido por aliado</span>
              <span className="font-mono text-right" data-testid="islr-retenido">
                {formatCurrency(metrics.islrRetenido)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 bg-muted/50 px-3 -mx-3 rounded-md">
              <span className="font-semibold">(-) Total Servicios Tecnológicos</span>
              <span className="font-mono font-semibold text-right" data-testid="total-servicios-tecnologicos">
                {formatCurrency(metrics.totalServiciosTecnologicos)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Conciliación Bancaria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Introduction */}
            <div className="text-sm space-y-2">
              <p>En esta sección encontrarás:</p>
              <p>I. Un resumen de tu cuenta bancaria con los ajustes correspondientes y el reconocimiento de montos no conciliados (si los hay).</p>
              <p>II. El total de cuotas que debías cobrar este mes, descontando lo que ya has recibido.</p>
              <p>III. Tabla con compensaciones por ajustes, ya sea por errores de compradores o acciones de Cáshea que impactan tu total.</p>
              <p>IV. La suma final considerando todos estos factores.</p>
            </div>

            {/* I. RESUMEN DE BANCO */}
            <div className="space-y-3">
              <div className="border-b pb-2 mb-2">
                <h3 className="font-semibold mb-3">I. RESUMEN DE BANCO</h3>
                <p className="text-sm text-muted-foreground">
                  Esta tabla muestra el monto real recibido en el banco por cuotas conciliadas, excluyendo conceptos no aplicables. Luego, en III. Ajustes, estos valores se compensan e integran en el Total a Reconocer
                </p>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span>Recibido en Banco</span>
                <span className="font-mono text-right" data-testid="recibido-en-banco">
                  {formatCurrency(metrics.recibidoEnBanco ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>(-) Cuotas adelantadas de clientes (corresponde a otro periodo)</span>
                <span className="font-mono text-right" data-testid="cuotas-adelantadas-clientes">
                  {formatCurrency(metrics.cuotasAdelantadasClientes ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>(-) Pago inicial de clientes en App</span>
                <span className="font-mono text-right" data-testid="pago-inicial-clientes-app">
                  {formatCurrency(metrics.pagoInicialClientesApp ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>(-) Devoluciones por errores de pago de clientes</span>
                <span className="font-mono text-right" data-testid="devoluciones-pago-clientes-banco">
                  {formatCurrency(metrics.devolucionesPagoClientesBanco ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>(-) Depósitos de otros aliados</span>
                <span className="font-mono text-right" data-testid="depositos-otros-aliados-banco">
                  {formatCurrency(metrics.depositosOtrosAliadosBanco ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 bg-muted/50 px-3 -mx-3 rounded-md">
                <span className="font-semibold">Banco neto: Cuotas reconocidas al corte</span>
                <span className="font-mono font-semibold text-right" data-testid="banco-neto-cuotas-reconocidas">
                  {formatCurrency(metrics.bancoNetoCuotasReconocidas ?? 0)}
                </span>
              </div>
            </div>

            {/* II. CUENTAS POR COBRAR */}
            <div className="space-y-3">
              <div className="border-b pb-2 mb-2">
                <h3 className="font-semibold mb-3">II. CUENTAS POR COBRAR</h3>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span>Cuentas por Cobrar</span>
                <span className="font-mono text-right" data-testid="cuentas-por-cobrar">
                  {formatCurrency(metrics.cuentasPorCobrar ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>(-) Cuotas adelantadas en periodos anteriores</span>
                <span className="font-mono text-right" data-testid="cuotas-adelantadas-periodos-anteriores">
                  {formatCurrency(metrics.cuotasAdelantadasPeriodosAnteriores ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 bg-muted/50 px-3 -mx-3 rounded-md">
                <span className="font-semibold">Cuentas por Cobrar Neto</span>
                <span className="font-mono font-semibold text-right" data-testid="cuentas-por-cobrar-neto">
                  {formatCurrency(metrics.cuentasPorCobrarNeto ?? 0)}
                </span>
              </div>
            </div>

            {/* SUBTOTAL */}
            <div className="space-y-3">
              <div className="border-b pb-2 mb-2">
                <h3 className="font-semibold mb-3">SUBTOTAL</h3>
                <h4 className="font-semibold text-sm">CONCILIACIÓN BANCO NETO - CUENTAS POR COBRAR</h4>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span>Banco neto: Cuotas reconocidas al corte</span>
                <span className="font-mono text-right" data-testid="banco-neto-subtotal">
                  {formatCurrency(metrics.bancoNetoCuotasReconocidas ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>(-) Cuentas por Cobrar</span>
                <span className="font-mono text-right" data-testid="cuentas-por-cobrar-subtotal">
                  {formatCurrency(metrics.cuentasPorCobrarNeto ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 bg-primary/10 px-3 -mx-3 rounded-md">
                <span className="font-semibold">(1) Subtotal conciliación banco neto - cuentas por cobrar</span>
                <span className="font-mono font-semibold text-right" data-testid="subtotal-conciliacion-banco-neto">
                  {formatCurrency(metrics.subtotalConciliacionBancoNeto ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>III. AJUSTES QUE COMPENSAMOS PARA COMPLETAR LA CONCILIACIÓN</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* INCIDENCIAS SOBRE COMPRADORES */}
            <div className="space-y-3">
              <div className="border-b pb-2 mb-2">
                <h3 className="font-semibold mb-3">INCIDENCIAS SOBRE COMPRADORES</h3>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span>(+) Devoluciones por errores de pago de clientes</span>
                <span className="font-mono text-right" data-testid="devoluciones-pago-clientes">
                  {formatCurrency(metrics.devolucionesPagoClientes ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>(-) Cupones</span>
                <span className="font-mono text-right" data-testid="cupones">
                  {formatCurrency(metrics.cupones ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 bg-muted/50 px-3 -mx-3 rounded-md">
                <span className="font-semibold">(2) Subtotal incidencias</span>
                <span className="font-mono font-semibold text-right" data-testid="subtotal-incidencias">
                  {formatCurrency(metrics.subtotalIncidencias ?? 0)}
                </span>
              </div>
            </div>

            {/* ERRORES BANCARIOS */}
            <div className="space-y-3">
              <div className="border-b pb-2 mb-2">
                <h3 className="font-semibold mb-3">ERRORES BANCARIOS</h3>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span>(+) Depósitos de otros aliados</span>
                <span className="font-mono text-right" data-testid="depositos-otros-aliados">
                  {formatCurrency(metrics.depositosOtrosAliados ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>(-) Depósitos en banco de otros aliados</span>
                <span className="font-mono text-right" data-testid="depositos-banco-otros-aliados">
                  {formatCurrency(metrics.depositosBancoOtrosAliados ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 bg-muted/50 px-3 -mx-3 rounded-md">
                <span className="font-semibold">(3) Subtotal Errores Bancarios</span>
                <span className="font-mono font-semibold text-right" data-testid="subtotal-errores-bancarios">
                  {formatCurrency(metrics.subtotalErroresBancarios ?? 0)}
                </span>
              </div>
            </div>

            {/* AVANCE DE CAJA - AJUSTES */}
            <div className="space-y-3">
              <div className="border-b pb-2 mb-2">
                <h3 className="font-semibold mb-3">AVANCE DE CAJA - AJUSTES</h3>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span>Compensación de facturas pendientes</span>
                <span className="font-mono text-right" data-testid="compensacion-facturas-pendientes">
                  {formatCurrency(metrics.compensacionFacturasPendientes ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>Avance de caja vencido al 31/01/2025</span>
                <span className="font-mono text-right" data-testid="avance-caja-vencido">
                  {formatCurrency(metrics.avanceCajaVencido ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>(-) Serv Tecnológico Órdenes Canceladas</span>
                <span className="font-mono text-right" data-testid="serv-tecnologico-ordenes-canceladas">
                  {formatCurrency(metrics.servTecnologicoOrdenesCanceladas ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 bg-muted/50 px-3 -mx-3 rounded-md">
                <span className="font-semibold">(4) Total avances de caja</span>
                <span className="font-mono font-semibold text-right" data-testid="total-avances-caja">
                  {formatCurrency(metrics.totalAvancesCaja ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IV. TOTAL A RECONOCER</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center py-2 bg-primary/10 px-3 -mx-3 rounded-md">
            <span className="font-semibold text-lg">Total a reconocer Cáshea a BOXI SLEEP, C.A. (1) + (2) + (3) + (4)</span>
            <span className="font-mono font-bold text-lg text-right" data-testid="total-reconocer">
              {formatCurrency(metrics.totalReconocer ?? 0)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Compensación Final</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* FACTORING */}
            <div className="space-y-3">
              <div className="border-b pb-2 mb-2">
                <p className="text-sm mb-3">
                  <strong>FACTORING</strong> - Cáshea realiza factoring al absorber la deuda de los usuarios que no pagaron en este periodo.
                </p>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span>Cuotas vencidas</span>
                <span className="font-mono text-right" data-testid="cuotas-vencidas">
                  {formatCurrency(metrics.cuotasVencidas ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>Conciliación banco neto - cuentas por cobrar</span>
                <span className="font-mono text-right" data-testid="conciliacion-banco-neto">
                  {formatCurrency(metrics.conciliacionBancoNeto ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 bg-muted/50 px-3 -mx-3 rounded-md">
                <span className="font-semibold">Diferencia por factoring</span>
                <span className="font-mono font-semibold text-right" data-testid="diferencia-factoring">
                  {formatCurrency(metrics.diferenciaFactoring ?? 0)}
                </span>
              </div>
            </div>

            {/* COMPENSACIÓN FINAL */}
            <div className="space-y-3">
              <div className="border-b pb-2 mb-2">
                <h3 className="font-semibold mb-3">COMPENSACIÓN FINAL</h3>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span>Total Servicios tecnológicos</span>
                <span className="font-mono text-right" data-testid="total-servicios-tecnologicos-final">
                  {formatCurrency(metrics.totalServiciosTecnologicosFinal ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>(-) Diferencia por factoring</span>
                <span className="font-mono text-right" data-testid="diferencia-factoring-compensacion">
                  {formatCurrency(metrics.diferenciaFactoring ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 bg-muted/50 px-3 -mx-3 rounded-md">
                <span className="font-semibold">Total a reconocer Cáshea a BOXI SLEEP, C. A.</span>
                <span className="font-mono font-semibold text-right" data-testid="total-reconocer-final">
                  {formatCurrency(metrics.totalReconocerFinal ?? 0)}
                </span>
              </div>
            </div>

            {/* TOTAL A PAGAR */}
            <div className="flex justify-between items-center py-3 bg-primary/10 px-3 -mx-3 rounded-md mt-4">
              <span className="font-semibold text-lg italic">Total a pagar a Cáshea (September 2025)</span>
              <span className="font-mono font-bold text-lg text-right" data-testid="total-pagar-cashea">
                {formatCurrency(metrics.totalPagarCashea ?? 0)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
