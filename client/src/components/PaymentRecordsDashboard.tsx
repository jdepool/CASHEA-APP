import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, DollarSign, Wallet, XCircle, CheckCircle } from "lucide-react";
import { normalizeNumber } from "@shared/numberUtils";

interface PaymentRecordsDashboardProps {
  data: any[];
  headers: string[];
  ordersData: any[];
  bankStatementRows: any[];
  bankStatementHeaders: string[];
}

export function PaymentRecordsDashboard({ data, headers, ordersData, bankStatementRows, bankStatementHeaders }: PaymentRecordsDashboardProps) {
  // Create order status lookup map
  const orderStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!ordersData || ordersData.length === 0) return map;

    // Find the order number and status columns in orders data (case-insensitive)
    const orderNumKey = Object.keys(ordersData[0] || {}).find(key => 
      key.toLowerCase() === 'orden'
    );
    const statusKey = Object.keys(ordersData[0] || {}).find(key => 
      key.toLowerCase().includes('status') && key.toLowerCase().includes('orden')
    );

    if (orderNumKey && statusKey) {
      ordersData.forEach((order: any) => {
        const ordenNum = order[orderNumKey];
        const status = order[statusKey];
        if (ordenNum != null && status != null) {
          map.set(String(ordenNum), String(status));
        }
      });
    }
    return map;
  }, [ordersData]);

  // Function to verify if a payment exists in bank statements
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
      // Handle case-insensitive column name matching
      const paymentAmountVES = record['Monto Pagado en VES'] || record['Monto pagado en VES'];
      const paymentAmountUSD = record['Monto Pagado en USD'] || record['Monto pagado en USD'];

      // If no reference or amounts, can't verify
      if (!paymentRef || (!paymentAmountVES && !paymentAmountUSD)) {
        return 'NO';
      }

      // Normalize payment reference (remove spaces, leading zeros)
      const normalizedPaymentRef = String(paymentRef).replace(/\s+/g, '').replace(/^0+/, '').toLowerCase();

      // Normalize payment amounts
      const normalizedVES = paymentAmountVES ? normalizeNumber(paymentAmountVES) : null;
      const normalizedUSD = paymentAmountUSD ? normalizeNumber(paymentAmountUSD) : null;

      // Search bank statements for matching reference and amount
      const found = bankStatementRows.some(bankRow => {
        // Check reference match
        if (referenciaHeader) {
          const bankRef = bankRow[referenciaHeader];
          if (bankRef) {
            const normalizedBankRef = String(bankRef).replace(/\s+/g, '').replace(/^0+/, '').toLowerCase();
            if (normalizedBankRef !== normalizedPaymentRef) {
              return false; // Reference doesn't match
            }
          } else {
            return false; // No reference in bank statement
          }
        } else {
          return false; // No reference header in bank statement
        }

        // Reference matches, now check amount
        // Check both Debe and Haber columns
        let amountFound = false;

        if (debeHeader) {
          const debeAmount = bankRow[debeHeader];
          if (debeAmount) {
            const normalizedDebe = normalizeNumber(debeAmount);
            if (!isNaN(normalizedDebe)) {
              // Check against both VES and USD amounts (bank could have either)
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
              // Check against both VES and USD amounts
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

  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalCuotasPagadas: 0,
        totalPagado: 0,
        totalPagoIniciales: 0,
        noDepositadas: 0,
        depositoBanco: 0,
      };
    }

    // Find relevant headers (case-insensitive)
    const ordenHeader = headers.find(h => 
      h.toLowerCase().includes('orden') && !h.toLowerCase().includes('cuota')
    );
    const cuotaHeader = headers.find(h => 
      h.toLowerCase().includes('cuota') && h.toLowerCase().includes('pagada')
    );
    const montoUsdHeader = headers.find(h => 
      h.toLowerCase().includes('monto') && 
      h.toLowerCase().includes('pagado') && 
      h.toLowerCase().includes('usd')
    );

    // Count total cuotas (expanded from comma-separated values)
    let totalCuotasPagadas = 0;
    let totalPagado = 0;
    let totalPagoIniciales = 0;
    let noDepositadas = 0;
    let depositoBanco = 0;

    data.forEach((row) => {
      // Get order number
      const ordenNum = row[ordenHeader || ''];
      
      // Get installment number(s) - could be single or comma-separated (e.g., "4,5,6")
      const cuotaValue = String(row[cuotaHeader || ''] || '');
      
      // Get amount paid in USD
      const montoUsdValue = row[montoUsdHeader || ''];
      const montoPagado = normalizeNumber(montoUsdValue);
      
      if (!isNaN(montoPagado)) {
        totalPagado += montoPagado;
        
        // Check verification status
        const verificacion = verifyPaymentInBankStatement(row);
        if (verificacion === 'SI') {
          depositoBanco += montoPagado;
        } else {
          noDepositadas += montoPagado;
        }
        
        // Check if this is an initial payment (cuota exactly equals "0")
        // Don't count multi-installment payments like "0,1,2"
        const cuotaNumbers = cuotaValue.split(',').map(c => c.trim()).filter(c => c);
        if (cuotaNumbers.length === 1 && parseInt(cuotaNumbers[0]) === 0) {
          // Only include in Pagos Iniciales if the order is found in orders data
          const statusOrden = ordenNum != null 
            ? orderStatusMap.get(String(ordenNum))
            : undefined;
          
          // Exclude orders with NOT FOUND status (orders not in TODAS LAS ORDENES)
          if (statusOrden) {
            totalPagoIniciales += montoPagado;
          }
        }
      }

      // Count cuotas - expand comma-separated values
      if (ordenNum) {
        // Split by comma to handle multi-installment payments
        // IMPORTANT: "3,4" counts as 2 cuotas (cuota 3 and cuota 4)
        // Each payment record contributes to the count based on how many cuotas it covers
        const cuotaNumbers = cuotaValue ? cuotaValue.split(',').map(c => c.trim()).filter(c => c) : [];
        
        // If no cuota numbers found, count as 1
        // If comma-separated (e.g., "3,4,5"), count as 3
        totalCuotasPagadas += cuotaNumbers.length > 0 ? cuotaNumbers.length : 1;
      }
    });

    return {
      totalCuotasPagadas,
      totalPagado,
      totalPagoIniciales,
      noDepositadas,
      depositoBanco,
    };
  }, [data, headers, orderStatusMap, verifyPaymentInBankStatement]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Pago Iniciales
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-pago-iniciales">
            {formatCurrency(metrics.totalPagoIniciales)}
          </div>
          <p className="text-xs text-muted-foreground">
            Suma de cuota 0 en USD
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Cuotas Pagadas
          </CardTitle>
          <Receipt className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-cuotas-pagadas">
            {metrics.totalCuotasPagadas}
          </div>
          <p className="text-xs text-muted-foreground">
            Cuotas únicas abonadas
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Pagado
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-total-pagado">
            {formatCurrency(metrics.totalPagado)}
          </div>
          <p className="text-xs text-muted-foreground">
            Suma de pagos en USD
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            No Depositadas
          </CardTitle>
          <XCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-no-depositadas">
            {formatCurrency(metrics.noDepositadas)}
          </div>
          <p className="text-xs text-muted-foreground">
            VERIFICACION = NO
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Deposito Banco
          </CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-deposito-banco">
            {formatCurrency(metrics.depositoBanco)}
          </div>
          <p className="text-xs text-muted-foreground">
            VERIFICACION = SI
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
