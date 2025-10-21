import { parseExcelDate } from "./dateUtils";

export interface Installment {
  orden: string;
  fechaCuota: Date | null;
  numeroCuota: number;
  monto: number;
  estadoCuota: string;
}

/**
 * Extract all installments from the table data
 * Converts wide format (14 installments per row) to long format (one row per installment)
 */
export function extractInstallments(tableData: any[]): Installment[] {
  const installments: Installment[] = [];

  for (const row of tableData) {
    const orden = row["Orden"] || "";

    // Process installments 1-14
    for (let i = 1; i <= 14; i++) {
      const fechaCuotaKey = `Fecha cuota ${i}`;
      const cuotaKey = `Cuota ${i}`;
      const pagadoKey = `Pagado de cuota ${i}`;
      const estadoCuotaKey = `Estado cuota ${i}`;

      const fechaCuotaValue = row[fechaCuotaKey];
      const montoValue = row[cuotaKey];
      const estadoValue = row[estadoCuotaKey];

      // Only include installments that have at least a date or amount
      if (fechaCuotaValue || montoValue) {
        const fechaCuota = parseExcelDate(fechaCuotaValue);
        const monto = typeof montoValue === 'number' ? montoValue : parseFloat(String(montoValue || 0).replace(/[^0-9.-]/g, '')) || 0;

        installments.push({
          orden,
          fechaCuota,
          numeroCuota: i,
          monto,
          estadoCuota: estadoValue || "",
        });
      }
    }
  }

  return installments;
}

/**
 * Filter installments by a date range
 */
export function filterInstallmentsByDateRange(
  installments: Installment[],
  startDate: Date,
  endDate: Date
): Installment[] {
  return installments.filter(inst => {
    if (!inst.fechaCuota) return false;
    
    const instTime = inst.fechaCuota.getTime();
    return instTime >= startDate.getTime() && instTime <= endDate.getTime();
  });
}

/**
 * Calculate total amount for a list of installments
 */
export function calculateTotalAmount(installments: Installment[]): number {
  return installments.reduce((sum, inst) => sum + inst.monto, 0);
}
