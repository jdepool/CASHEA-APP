import { useMemo } from "react";
import { WeeklyPaymentsTable } from "./WeeklyPaymentsTable";
import { extractInstallments, filterInstallmentsByDateRange, calculateTotalAmount } from "@/lib/installmentUtils";
import { getMonday, getSunday, getFriday, formatDate } from "@/lib/dateUtils";

interface WeeklyPaymentsProps {
  tableData: any[];
}

export function WeeklyPayments({ tableData }: WeeklyPaymentsProps) {
  const { weeklyInstallments, expectedIncome, fridayDate } = useMemo(() => {
    // Extract all installments from the data
    const allInstallments = extractInstallments(tableData);

    // Get current week range (Monday to Sunday)
    const monday = getMonday();
    monday.setHours(0, 0, 0, 0);
    
    const sunday = getSunday();
    sunday.setHours(23, 59, 59, 999);

    // Filter installments for current week
    const weeklyInstallments = filterInstallmentsByDateRange(allInstallments, monday, sunday);

    // Calculate expected income
    const expectedIncome = calculateTotalAmount(weeklyInstallments);

    // Get Friday's date
    const fridayDate = getFriday();

    return { weeklyInstallments, expectedIncome, fridayDate };
  }, [tableData]);

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
