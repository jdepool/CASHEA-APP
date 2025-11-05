import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, DollarSign, Wallet, CheckCircle, BadgeCheck, AlertCircle, XCircle } from "lucide-react";
import { normalizeNumber } from "@shared/numberUtils";
import { verifyInBankStatements } from "@/lib/verificationUtils";

interface PaymentRecordsDashboardProps {
  data: any[];
  headers: string[];
  ordersData: any[];
  bankStatementRows: any[];
  bankStatementHeaders: string[];
  masterDateFrom?: string;
  masterDateTo?: string;
  masterOrden?: string;
  dateFrom?: string;
  dateTo?: string;
  ordenFilter?: string;
  referenciaFilter?: string;
}

export function PaymentRecordsDashboard({ 
  data, 
  headers, 
  ordersData, 
  bankStatementRows, 
  bankStatementHeaders,
  masterDateFrom,
  masterDateTo,
  masterOrden,
  dateFrom,
  dateTo,
  ordenFilter,
  referenciaFilter
}: PaymentRecordsDashboardProps) {
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
    return (record: any): string => {
      const paymentRef = record['# Referencia'];
      // Handle case-insensitive column name matching
      const paymentAmountVES = record['Monto Pagado en VES'] || record['Monto pagado en VES'];
      const paymentAmountUSD = record['Monto Pagado en USD'] || record['Monto pagado en USD'];

      return verifyInBankStatements(
        {
          reference: paymentRef,
          amountVES: paymentAmountVES,
          amountUSD: paymentAmountUSD,
        },
        bankStatementRows,
        bankStatementHeaders
      );
    };
  }, [bankStatementRows, bankStatementHeaders]);

  const metrics = useMemo(() => {
    console.log('=== PaymentRecordsDashboard Input ===');
    console.log('Data rows received:', data?.length);
    console.log('Filter props:', { masterDateFrom, masterDateTo, masterOrden, dateFrom, dateTo, ordenFilter, referenciaFilter });
    
    if (!data || data.length === 0) {
      return {
        totalCuotasPagadas: 0,
        totalPagado: 0,
        totalPagoIniciales: 0,
        noDepositadas: 0,
        noDepositadasCount: 0,
        depositoBanco: 0,
        pagoInicialesDepositado: 0,
        pagoInicialesNoDepositado: 0,
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
    let noDepositadasCount = 0;
    let depositoBanco = 0;
    let pagoInicialesDepositado = 0;
    let pagoInicialesNoDepositado = 0;

    data.forEach((row) => {
      // Get order number
      const ordenNum = row[ordenHeader || ''];
      
      // Get installment number(s) - could be single or comma-separated (e.g., "4,5,6")
      const cuotaValue = String(row[cuotaHeader || ''] || '');
      
      // Get amount paid in USD - use original amount without splitting
      const montoUsdValue = row[montoUsdHeader || ''];
      const montoPagado = normalizeNumber(montoUsdValue);
      
      // Check verification status for ALL rows (not just those with valid amounts)
      const verificacion = verifyPaymentInBankStatement(row);
      
      // Count all records with VERIFICACION = NO, regardless of amount validity
      if (verificacion === 'NO') {
        noDepositadasCount += 1;
        // Debug: log unverified payments
        if (noDepositadasCount <= 10) {
          // Get reference for debugging
          const referenciaHeader = headers.find(h => h.toLowerCase().includes('referencia'));
          const referenciaValue = row[referenciaHeader || ''];
          
          console.log(`Unverified #${noDepositadasCount}:`, {
            orden: ordenNum,
            cuota: cuotaValue,
            referencia: referenciaValue,
            montoUSD: montoUsdValue,
            montoParsed: montoPagado
          });
        }
      }
      
      if (!isNaN(montoPagado)) {
        totalPagado += montoPagado;
        
        // Sum amounts based on verification status
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
            
            // Track Cuota 0 by verification status
            if (verificacion === 'SI') {
              pagoInicialesDepositado += montoPagado;
            } else {
              pagoInicialesNoDepositado += montoPagado;
            }
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

    console.log('=== Dashboard Metrics ===');
    console.log('No Verificadas Amount:', noDepositadas);
    console.log('No Verificadas Count:', noDepositadasCount);
    console.log('Total Pagado:', totalPagado);
    console.log('Deposito Banco:', depositoBanco);
    
    return {
      totalCuotasPagadas,
      totalPagado,
      totalPagoIniciales,
      noDepositadas,
      noDepositadasCount,
      depositoBanco,
      pagoInicialesDepositado,
      pagoInicialesNoDepositado,
    };
  }, [data, headers, orderStatusMap, verifyPaymentInBankStatement, masterDateFrom, masterDateTo, masterOrden, dateFrom, dateTo, ordenFilter, referenciaFilter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="space-y-6 mb-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pago Inicial Depositado
            </CardTitle>
            <BadgeCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-pago-inicial-depositado">
              {formatCurrency(metrics.pagoInicialesDepositado)}
            </div>
            <p className="text-xs text-muted-foreground">
              Cuota 0 con VERIFICACION = SI
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pago Inicial No Depositado
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-pago-inicial-no-depositado">
              {formatCurrency(metrics.pagoInicialesNoDepositado)}
            </div>
            <p className="text-xs text-muted-foreground">
              Cuota 0 con VERIFICACION = NO
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pagos No Verificados
            </CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-no-verificadas">
              {formatCurrency(metrics.noDepositadas)}
            </div>
            <p className="text-xs text-muted-foreground">
              VERIFICACION = NO ({metrics.noDepositadasCount} {metrics.noDepositadasCount === 1 ? 'caso' : 'casos'})
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
