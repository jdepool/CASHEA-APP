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

      // Parse the amount
      const monto = typeof montoValue === 'number' ? montoValue : parseFloat(String(montoValue || 0).replace(/[^0-9.-]/g, '')) || 0;

      // Only include installments that have both a date AND an amount > 0
      if (fechaCuotaValue && monto > 0) {
        const fechaCuota = parseExcelDate(fechaCuotaValue);
        const fechaPago = parseExcelDate(fechaPagoValue);

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

/**
 * Calculate STATUS string for an installment based on payment timing
 * Returns one of: ADELANTADO, A TIEMPO, ATRASADO, OTRO ALIADO, NO DEPOSITADO, or empty string
 */
export function calculateInstallmentStatus(installment: any): string {
  const fechaPagoReal = installment.fechaPagoReal;
  const fechaPagoFromOrder = installment.fechaPago;
  const fechaCuota = installment.fechaCuota;
  const estadoCuota = (installment.estadoCuota || '').toLowerCase();
  
  // Determine if there's ANY payment date (from payment records OR from order file)
  const hasPayment = fechaPagoReal || fechaPagoFromOrder;
  
  // NO DEPOSITADO: Order is DONE but no payment received
  if (!hasPayment && estadoCuota === 'done') {
    return 'NO DEPOSITADO';
  }
  
  // ATRASADO: Installment is delayed but not paid yet
  if (!hasPayment && estadoCuota === 'delayed') {
    return 'ATRASADO';
  }
  
  // No status if no payment and order not done/delayed
  if (!hasPayment) {
    return '';
  }
  
  // Use fechaPagoReal if available, otherwise use fechaPago from order
  const fechaPago = fechaPagoReal || fechaPagoFromOrder;
  
  // OTRO ALIADO: Payment exists but no due date
  if (fechaCuota == null) {
    return 'OTRO ALIADO';
  }
  
  // If we have both dates, calculate the status
  const pagoNormalized = new Date(fechaPago);
  pagoNormalized.setHours(0, 0, 0, 0);
  
  const cuotaNormalized = new Date(fechaCuota);
  cuotaNormalized.setHours(0, 0, 0, 0);
  
  // Calculate day difference: (Fecha de Pago - Fecha de Cuota)
  const DAY_MS = 1000 * 60 * 60 * 24;
  const daysDiff = Math.round((pagoNormalized.getTime() - cuotaNormalized.getTime()) / DAY_MS);
  
  // Get month/year for comparison
  const pagoMonth = pagoNormalized.getMonth();
  const pagoYear = pagoNormalized.getFullYear();
  const cuotaMonth = cuotaNormalized.getMonth();
  const cuotaYear = cuotaNormalized.getFullYear();
  
  // ADELANTADO: Payment made at least 15 days before due date AND cuota month is after payment month
  if (daysDiff <= -15) {
    // Check if cuota month is after payment month
    if (cuotaYear > pagoYear || (cuotaYear === pagoYear && cuotaMonth > pagoMonth)) {
      return 'ADELANTADO';
    }
  }
  
  // ATRASADO: Payment made MORE than 2 days after due date
  if (daysDiff > 2) {
    return 'ATRASADO';
  }
  
  // A TIEMPO: Payment made within 2 days of due date or earlier (but not ADELANTADO)
  return 'A TIEMPO';
}

/**
 * Calculate "Depósitos Otros Bancos" metric from filtered installments
 * Sum of amounts where Estado Cuota = 'done' AND STATUS = 'NO DEPOSITADO'
 */
export function calculateDepositosOtrosBancos(installments: any[]): number {
  let total = 0;
  installments.forEach((inst) => {
    const estadoNormalized = (inst.estadoCuota || '').trim().toLowerCase();
    const status = (inst.status || '').trim().toUpperCase();
    
    // Sum where Estado Cuota = 'done' AND STATUS = 'NO DEPOSITADO'
    if (estadoNormalized === 'done' && status === 'NO DEPOSITADO') {
      total += inst.monto || 0;
    }
  });
  return total;
}
