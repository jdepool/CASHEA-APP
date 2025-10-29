import { parseExcelDate } from "./dateUtils";

export interface PaymentDetails {
  referencia?: string;
  metodoPago?: string;
  montoPagadoUSD?: number;
  montoPagadoVES?: number;
  tasaCambio?: number;
}

export interface Installment {
  orden: string;
  fechaCuota: Date | null;
  numeroCuota: number;
  monto: number;
  estadoCuota: string;
  fechaPago: Date | null;
  fechaPagoReal?: Date | null;
  paymentDetails?: PaymentDetails;
}

/**
 * Extract all installments from the table data
 * Converts wide format (14 regular installments per row) to long format (one row per installment)
 * Excludes Cuota 0 (PAGO INICIAL) - only processes Cuotas 1-14
 */
export function extractInstallments(tableData: any[]): Installment[] {
  const installments: Installment[] = [];

  for (const row of tableData) {
    const orden = row["Orden"] || "";

    // Process installments 1-14 (regular installments only, excluding Cuota 0/PAGO INICIAL)
    for (let i = 1; i <= 14; i++) {
      // For Cuotas 1-14, use standard column names
      const fechaCuotaKey = `Fecha cuota ${i}`;
      const cuotaKey = `Cuota ${i}`;
      const pagadoKey = `Pagado de cuota ${i}`;
      const estadoCuotaKey = `Estado cuota ${i}`;
      const fechaPagoKey = `Fecha de pago cuota ${i}`;

      const fechaCuotaValue = row[fechaCuotaKey];
      const montoValue = row[cuotaKey];
      const estadoValue = row[estadoCuotaKey];
      const fechaPagoValue = row[fechaPagoKey];

      // Only include installments that have at least a date or amount
      if (fechaCuotaValue || montoValue) {
        const fechaCuota = parseExcelDate(fechaCuotaValue);
        const fechaPago = parseExcelDate(fechaPagoValue);
        const monto = typeof montoValue === 'number' ? montoValue : parseFloat(String(montoValue || 0).replace(/[^0-9.-]/g, '')) || 0;

        installments.push({
          orden,
          fechaCuota,
          numeroCuota: i,
          monto,
          estadoCuota: estadoValue || "",
          fechaPago,
        });
      }
    }
  }

  return installments;
}

/**
 * Filter installments by a date range using hybrid logic:
 * - If payment date exists (fechaPago or fechaPagoReal), filter by payment date
 * - Otherwise, filter by scheduled date (fechaCuota)
 * This shows actual cash flow for paid installments and expected income for unpaid ones
 */
export function filterInstallmentsByDateRange(
  installments: any[],
  startDate: Date,
  endDate: Date
): any[] {
  return installments.filter(inst => {
    // Determine which date to use for filtering
    // Priority: fechaPagoReal (from payment records) > fechaPago (from orders file) > fechaCuota (scheduled)
    let filterDate: Date | null = null;
    
    if (inst.fechaPagoReal) {
      filterDate = inst.fechaPagoReal;
    } else if (inst.fechaPago) {
      filterDate = inst.fechaPago;
    } else if (inst.fechaCuota) {
      filterDate = inst.fechaCuota;
    }
    
    // If no valid date found, exclude this installment
    if (!filterDate) return false;
    
    const instTime = filterDate.getTime();
    return instTime >= startDate.getTime() && instTime <= endDate.getTime();
  });
}

/**
 * Calculate total amount for a list of installments
 */
export function calculateTotalAmount(installments: Installment[]): number {
  return installments.reduce((sum, inst) => sum + inst.monto, 0);
}
