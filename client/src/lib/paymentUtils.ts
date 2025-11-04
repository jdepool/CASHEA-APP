import { normalizeNumber } from '@shared/numberUtils';

export interface PaymentSplitInfo {
  originalAmount: number;
  splitAmount: number;
  numberOfCuotas: number;
  expectedCuotaAmount: number | null;
  hasWarning: boolean;
  warningMessage: string | null;
  currency: 'VES' | 'USD';
}

export interface PaymentRecord {
  [key: string]: any;
}

/**
 * Groups payment records by reference number and calculates split amounts.
 * When a single payment covers multiple cuotas, the amount is divided equally.
 * Handles both multi-row payments (same reference in multiple rows) and 
 * single-row multi-cuota payments (comma-separated cuotas like "4,5,6").
 */
export function calculatePaymentSplits(
  paymentRecords: PaymentRecord[],
  headers: string[],
  ordersData: any[]
): Map<string, PaymentSplitInfo> {
  const splitInfoMap = new Map<string, PaymentSplitInfo>();
  
  // Find relevant headers
  const referenciaHeader = headers.find(h => 
    h.toLowerCase().includes('referencia') || h.toLowerCase().includes('# referencia')
  );
  const ordenHeader = headers.find(h => 
    h.toLowerCase().includes('orden') && !h.toLowerCase().includes('cuota')
  );
  const cuotaPagadaHeader = headers.find(h => 
    h.toLowerCase().includes('cuota') && h.toLowerCase().includes('pagada')
  );
  const montoVESHeader = headers.find(h => 
    h.toLowerCase().includes('monto') && h.toLowerCase().includes('ves')
  );
  const montoUSDHeader = headers.find(h => 
    h.toLowerCase().includes('monto') && h.toLowerCase().includes('usd')
  );

  if (!referenciaHeader || !ordenHeader || !cuotaPagadaHeader) {
    return splitInfoMap;
  }

  // Group payment records by reference number to handle multi-row payments
  const paymentsByReference = new Map<string, PaymentRecord[]>();
  
  paymentRecords.forEach(record => {
    const referencia = String(record[referenciaHeader] || '');
    if (!referencia) return;
    
    if (!paymentsByReference.has(referencia)) {
      paymentsByReference.set(referencia, []);
    }
    paymentsByReference.get(referencia)!.push(record);
  });

  // Process each reference group
  paymentsByReference.forEach((records, referencia) => {
    if (records.length === 0) return;

    // Get the payment amount (use first record's amount)
    // Prioritize USD over VES
    const firstRecord = records[0];
    let originalAmount = 0;
    let currency: 'VES' | 'USD' = 'USD';
    
    if (montoUSDHeader) {
      const usdAmount = normalizeNumber(firstRecord[montoUSDHeader]);
      if (usdAmount && usdAmount > 0) {
        originalAmount = usdAmount;
        currency = 'USD';
      }
    }
    
    if (originalAmount === 0 && montoVESHeader) {
      const vesAmount = normalizeNumber(firstRecord[montoVESHeader]);
      if (vesAmount && vesAmount > 0) {
        originalAmount = vesAmount;
        currency = 'VES';
      }
    }

    if (originalAmount === 0) return;

    // Collect all cuota numbers from all rows in this reference group
    const allCuotas: Array<{ orden: string; cuotaNum: string }> = [];
    
    records.forEach(record => {
      const orden = String(record[ordenHeader] || '');
      const cuotaValue = String(record[cuotaPagadaHeader] || '');
      
      if (!orden || !cuotaValue) return;
      
      // Parse comma-separated cuota numbers (e.g., "4,5,6" means cuotas 4, 5, and 6)
      const cuotaNumbers = cuotaValue.split(',').map(c => c.trim()).filter(c => c);
      
      // Add each cuota to the list
      cuotaNumbers.forEach(cuotaNum => {
        allCuotas.push({ orden, cuotaNum });
      });
    });

    // Skip if no cuotas found
    if (allCuotas.length === 0) return;

    const numberOfCuotas = allCuotas.length;
    const splitAmount = originalAmount / numberOfCuotas;

    // Create split info for each cuota
    allCuotas.forEach(({ orden, cuotaNum }) => {
      // Find expected cuota amount from orders data
      let expectedCuotaAmount: number | null = null;
      let hasWarning = false;
      let warningMessage: string | null = null;

      if (ordersData.length > 0) {
        // Find the order in orders data
        const orderRecord = ordersData.find(orderRow => {
          const orderOrden = String(orderRow['Orden'] || orderRow['ORDEN'] || '');
          return orderOrden === orden;
        });

        if (orderRecord) {
          // Get expected cuota amount
          const cuotaKey = `Cuota ${cuotaNum}`;
          const expectedAmount = normalizeNumber(orderRecord[cuotaKey]);
          
          if (expectedAmount && expectedAmount > 0) {
            expectedCuotaAmount = expectedAmount;
            
            // Check if split amount covers the expected cuota amount
            // Allow small tolerance for rounding ($0.01)
            const tolerance = 0.01;
            if (splitAmount < expectedAmount - tolerance) {
              hasWarning = true;
              warningMessage = `Monto dividido ($${splitAmount.toFixed(2)}) no cubre la cuota esperada ($${expectedAmount.toFixed(2)})`;
            } else if (Math.abs(splitAmount - expectedAmount) > tolerance) {
              hasWarning = true;
              warningMessage = `Diferencia de $${Math.abs(splitAmount - expectedAmount).toFixed(2)} entre monto dividido y cuota esperada`;
            }
          }
        }
      }

      // Create a unique key for this payment record
      const recordKey = `${referencia}-${orden}-${cuotaNum}`;
      
      splitInfoMap.set(recordKey, {
        originalAmount,
        splitAmount,
        numberOfCuotas,
        expectedCuotaAmount,
        hasWarning,
        warningMessage,
        currency,
      });
    });
  });

  return splitInfoMap;
}

/**
 * Gets the split info key for a payment record.
 * For records with comma-separated cuotas (e.g., "4,5,6"), returns the key for the first cuota.
 * This is because all cuotas in a multi-cuota payment share the same split amount and metadata.
 */
export function getPaymentSplitKey(
  record: PaymentRecord,
  headers: string[]
): string {
  const referenciaHeader = headers.find(h => 
    h.toLowerCase().includes('referencia') || h.toLowerCase().includes('# referencia')
  );
  const ordenHeader = headers.find(h => 
    h.toLowerCase().includes('orden') && !h.toLowerCase().includes('cuota')
  );
  const cuotaPagadaHeader = headers.find(h => 
    h.toLowerCase().includes('cuota') && h.toLowerCase().includes('pagada')
  );

  const referencia = String(record[referenciaHeader || ''] || '');
  const orden = String(record[ordenHeader || ''] || '');
  const cuotaValue = String(record[cuotaPagadaHeader || ''] || '');
  
  // Parse comma-separated cuota numbers and use the first one
  const cuotaNumbers = cuotaValue.split(',').map(c => c.trim()).filter(c => c);
  const firstCuota = cuotaNumbers.length > 0 ? cuotaNumbers[0] : cuotaValue;

  return `${referencia}-${orden}-${firstCuota}`;
}
