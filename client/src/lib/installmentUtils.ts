import { parseExcelDate } from "./dateUtils";

export interface Installment {
  orden: string;
  fechaCuota: Date | null;
  numeroCuota: number;
  monto: number;
  estadoCuota: string;
  fechaPago: Date | null;
  fechaPagoReal?: Date | null;
}

/**
 * Extract all installments from the table data
 * Converts wide format (14 installments per row) to long format (one row per installment)
 */
export function extractInstallments(tableData: any[]): Installment[] {
  const installments: Installment[] = [];

  for (const row of tableData) {
    const orden = row["Orden"] || "";

    // Process installments 0-14 (0 = PAGO INICIAL)
    for (let i = 0; i <= 14; i++) {
      // Special handling for Cuota 0 (initial payment)
      let fechaCuotaKey: string;
      let cuotaKey: string;
      let pagadoKey: string;
      let estadoCuotaKey: string;
      let fechaPagoKey: string;

      if (i === 0) {
        // For Cuota 0, use specific column names for initial payment
        fechaCuotaKey = `Fecha cuota ${i}`;
        cuotaKey = "PAGO INICIAL"; // Backend maps "Pago en Caja" to this standardized name
        pagadoKey = `Pagado de cuota ${i}`;
        estadoCuotaKey = "Estado pago inicial";
        fechaPagoKey = `Fecha de pago cuota ${i}`;
      } else {
        // For Cuotas 1-14, use standard column names
        fechaCuotaKey = `Fecha cuota ${i}`;
        cuotaKey = `Cuota ${i}`;
        pagadoKey = `Pagado de cuota ${i}`;
        estadoCuotaKey = `Estado cuota ${i}`;
        fechaPagoKey = `Fecha de pago cuota ${i}`;
      }

      let fechaCuotaValue = row[fechaCuotaKey];
      const montoValue = row[cuotaKey];
      const estadoValue = row[estadoCuotaKey];
      const fechaPagoValue = row[fechaPagoKey];

      // For Cuota 0, if no fecha cuota is provided, use FECHA DE COMPRA as fallback
      if (i === 0 && !fechaCuotaValue) {
        fechaCuotaValue = row["FECHA DE COMPRA"] || row["Fecha de Compra"] || row["Fecha de compra"] || row["Fecha Compra"];
      }

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
