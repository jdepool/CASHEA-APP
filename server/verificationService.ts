import { storage } from "./storage";
import { type InsertPaymentVerification } from "@shared/schema";
import { normalizeNumber } from "@shared/numberUtils";

export async function runPaymentVerification(): Promise<number> {
  console.log('Starting payment verification...');
  
  const [paymentRecord, bankStatement] = await Promise.all([
    storage.getLatestPaymentRecord(),
    storage.getLatestBankStatement()
  ]);
  
  if (!paymentRecord || !paymentRecord.rows || paymentRecord.rows.length === 0) {
    console.log('No payment records found, skipping verification');
    return 0;
  }
  
  const paymentRows = paymentRecord.rows as any[];
  const bankStatementRows = (bankStatement?.rows || []) as any[];
  const bankStatementHeaders = (bankStatement?.headers || []) as string[];
  
  const bankRefLookupMap = buildBankLookupMap(bankStatementRows, bankStatementHeaders);
  
  const verifications: InsertPaymentVerification[] = [];
  
  for (const payment of paymentRows) {
    const orden = payment['# Orden'] || payment['#Orden'] || payment['Orden'] || '';
    const cuota = payment['# Cuota Pagada'] || payment['#CuotaPagada'] || payment['Cuota'] || '';
    const referencia = payment['# Referencia'] || payment['#Referencia'] || payment['Referencia'] || '';
    
    if (!orden || !cuota || !referencia) continue;
    
    const paymentKey = `${orden}_${cuota}_${String(referencia).replace(/\s+/g, '').replace(/^0+/, '').toLowerCase()}`;
    
    const paymentAmountVES = payment['Monto Pagado en VES'] || payment['Monto pagado en VES'] || payment['MONTO PAGADO EN VES'];
    const paymentAmountUSD = payment['Monto Pagado en USD'] || payment['Monto pagado en USD'] || payment['MONTO PAGADO EN USD'];
    
    const verificationStatus = verifyPayment(referencia, paymentAmountVES, paymentAmountUSD, bankRefLookupMap);
    
    verifications.push({
      paymentKey,
      orden: String(orden),
      cuota: String(cuota),
      referencia: String(referencia),
      verificationStatus,
      matchedBankRef: null,
      paymentAmountVES: paymentAmountVES ? String(paymentAmountVES) : null,
      paymentAmountUSD: paymentAmountUSD ? String(paymentAmountUSD) : null,
    });
  }
  
  await storage.savePaymentVerifications(verifications);
  
  console.log(`Verification complete: ${verifications.length} payments processed`);
  return verifications.length;
}

function buildBankLookupMap(bankStatementRows: any[], bankStatementHeaders: string[]): Map<string, { debe: number | null; haber: number | null }[]> {
  const map = new Map<string, { debe: number | null; haber: number | null }[]>();
  
  if (!bankStatementRows || bankStatementRows.length === 0) return map;

  const referenciaHeader = bankStatementHeaders.find((h: string) => 
    h.toLowerCase().includes('referencia')
  );
  const debeHeader = bankStatementHeaders.find((h: string) => 
    h.toLowerCase().includes('debe')
  );
  const haberHeader = bankStatementHeaders.find((h: string) => 
    h.toLowerCase().includes('haber')
  );

  if (!referenciaHeader) return map;

  bankStatementRows.forEach((bankRow: any) => {
    const bankRef = bankRow[referenciaHeader];
    if (!bankRef) return;
    
    const normalizedBankRef = String(bankRef).replace(/\s+/g, '').replace(/^0+/, '').toLowerCase();
    const last8Digits = normalizedBankRef.replace(/\D/g, '').slice(-8);
    
    const debe = debeHeader && bankRow[debeHeader] ? normalizeNumber(bankRow[debeHeader]) : null;
    const haber = haberHeader && bankRow[haberHeader] ? normalizeNumber(bankRow[haberHeader]) : null;
    
    const entry = { debe: isNaN(debe as number) ? null : debe, haber: isNaN(haber as number) ? null : haber };
    
    if (!map.has(normalizedBankRef)) {
      map.set(normalizedBankRef, []);
    }
    map.get(normalizedBankRef)!.push(entry);
    
    if (last8Digits && last8Digits !== normalizedBankRef) {
      if (!map.has(last8Digits)) {
        map.set(last8Digits, []);
      }
      map.get(last8Digits)!.push(entry);
    }
  });

  return map;
}

function verifyPayment(
  paymentRef: any, 
  paymentAmountVES: any, 
  paymentAmountUSD: any, 
  bankRefLookupMap: Map<string, { debe: number | null; haber: number | null }[]>
): string {
  if (bankRefLookupMap.size === 0) return '-';
  
  if (!paymentRef || (!paymentAmountVES && !paymentAmountUSD)) {
    return '-';
  }

  const normalizedPaymentRef = String(paymentRef).replace(/\s+/g, '').replace(/^0+/, '').toLowerCase();
  const last8Digits = normalizedPaymentRef.replace(/\D/g, '').slice(-8);
  
  const normalizedVES = paymentAmountVES ? normalizeNumber(paymentAmountVES) : null;
  const normalizedUSD = paymentAmountUSD ? normalizeNumber(paymentAmountUSD) : null;

  const checkAmounts = (entries: { debe: number | null; haber: number | null }[]): boolean => {
    return entries.some(entry => {
      if (entry.debe !== null) {
        if (normalizedVES !== null && Math.abs(entry.debe - normalizedVES) <= 0.01) return true;
        if (normalizedUSD !== null && Math.abs(entry.debe - normalizedUSD) <= 0.01) return true;
      }
      if (entry.haber !== null) {
        if (normalizedVES !== null && Math.abs(entry.haber - normalizedVES) <= 0.01) return true;
        if (normalizedUSD !== null && Math.abs(entry.haber - normalizedUSD) <= 0.01) return true;
      }
      return false;
    });
  };

  const fullMatchEntries = bankRefLookupMap.get(normalizedPaymentRef);
  if (fullMatchEntries && checkAmounts(fullMatchEntries)) {
    return 'SI';
  }

  if (last8Digits) {
    const partialMatchEntries = bankRefLookupMap.get(last8Digits);
    if (partialMatchEntries && checkAmounts(partialMatchEntries)) {
      return 'SI';
    }
  }

  return 'NO';
}
