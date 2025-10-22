import { useMemo } from "react";
import { WeeklyPaymentsTable } from "./WeeklyPaymentsTable";
import { extractInstallments, filterInstallmentsByDateRange, calculateTotalAmount } from "@/lib/installmentUtils";
import { getMonday, getSunday, getFriday, formatDate, parseExcelDate } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";

interface WeeklyPaymentsProps {
  tableData: any[];
}

export function WeeklyPayments({ tableData }: WeeklyPaymentsProps) {
  // Fetch payment records to cross-reference
  const { data: paymentRecordsData } = useQuery({
    queryKey: ['/api/payment-records'],
    refetchOnWindowFocus: false,
  });

  const { weeklyInstallments, expectedIncome, fridayDate} = useMemo(() => {
    // Extract all installments from the data
    const allInstallments = extractInstallments(tableData);

    // Get current week range (Monday to Sunday)
    const monday = getMonday();
    monday.setHours(0, 0, 0, 0);
    
    const sunday = getSunday();
    sunday.setHours(23, 59, 59, 999);

    // Filter installments for current week
    let weeklyInstallments = filterInstallmentsByDateRange(allInstallments, monday, sunday);

    // Cross-reference with payment records to add payment dates
    const apiData = paymentRecordsData as any;
    const hasPaymentData = apiData?.data?.rows && Array.isArray(apiData.data.rows) && apiData.data.rows.length > 0;
    
    if (hasPaymentData) {
      const paymentRows = apiData.data.rows;
      
      // Create enriched installments with payment dates
      weeklyInstallments = weeklyInstallments.map((installment) => {
        // Find matching payment record by order number (and optionally installment number)
        const matchingPayment = paymentRows.find((payment: any) => {
          const paymentOrder = String(payment['# Orden'] || payment['#Orden'] || payment['Orden'] || '').trim();
          const paymentInstallment = String(payment['# Cuota Pagada'] || payment['#CuotaPagada'] || payment['Cuota'] || '').trim();
          
          // Match by order number first
          const orderMatches = paymentOrder === String(installment.orden).trim();
          
          // If installment number exists in payment record, also match on that
          if (paymentInstallment) {
            return orderMatches && paymentInstallment === String(installment.numeroCuota).trim();
          }
          
          // Otherwise just match by order number
          return orderMatches;
        });

        if (matchingPayment) {
          // Get the exchange rate date (FECHA TASA DE CAMBIO)
          const fechaTasaCambio = matchingPayment['Fecha Tasa de Cambio'] || 
                                  matchingPayment['FECHA TASA DE CAMBIO'] ||
                                  matchingPayment['Fecha de Transaccion'] ||
                                  matchingPayment['FECHA DE TRANSACCION'] ||
                                  matchingPayment['Fecha Tasa Cambio'] ||
                                  matchingPayment['FechaTasaCambio'];
          
          if (fechaTasaCambio) {
            // Parse date using parseExcelDate to handle Excel serial numbers and date strings
            const parsedDate = parseExcelDate(fechaTasaCambio);
            
            if (parsedDate) {
              return { ...installment, fechaPagoReal: parsedDate };
            }
          }
        }
        
        return installment;
      });
    }

    // Calculate expected income
    const expectedIncome = calculateTotalAmount(weeklyInstallments);

    // Get Friday's date
    const fridayDate = getFriday();

    return { weeklyInstallments, expectedIncome, fridayDate };
  }, [tableData, paymentRecordsData]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Cuotas de la Semana Actual</h3>
          <p className="text-sm text-muted-foreground">
            Pagos programados del {formatDate(getMonday())} al {formatDate(getSunday())}
          </p>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4" data-testid="summary-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Ingresos Esperados al {formatDate(fridayDate)}
              </p>
              <p className="text-2xl font-bold text-primary" data-testid="text-expected-income">
                ${expectedIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground mb-1">Total de Cuotas</p>
              <p className="text-2xl font-bold" data-testid="text-installment-count">
                {weeklyInstallments.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <WeeklyPaymentsTable installments={weeklyInstallments} />
    </div>
  );
}
