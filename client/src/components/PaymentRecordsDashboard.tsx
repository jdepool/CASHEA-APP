import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, DollarSign, Wallet } from "lucide-react";
import { normalizeNumber } from "@shared/numberUtils";

interface PaymentRecordsDashboardProps {
  data: any[];
  headers: string[];
  ordersData: any[];
}

export function PaymentRecordsDashboard({ data, headers, ordersData }: PaymentRecordsDashboardProps) {
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

  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalCuotasPagadas: 0,
        totalPagado: 0,
        totalPagoIniciales: 0,
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

    // Track unique installments: Set of "order_cuota" combinations
    const uniqueCuotas = new Set<string>();
    let totalPagado = 0;
    let totalPagoIniciales = 0;

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

      // Parse cuota value(s)
      if (ordenNum && cuotaValue) {
        // Split by comma to handle multi-installment payments
        // IMPORTANT: "3,4" counts as 2 cuotas (cuota 3 and cuota 4)
        // This ensures Total Cuotas Pagadas counts each cuota separately
        const cuotaNumbers = cuotaValue.split(',').map(c => c.trim()).filter(c => c);
        
        cuotaNumbers.forEach(cuotaNum => {
          // Create unique key: "order_cuota" to avoid counting duplicates
          const key = `${ordenNum}_${cuotaNum}`;
          uniqueCuotas.add(key);
        });
      }
    });

    return {
      totalCuotasPagadas: uniqueCuotas.size,
      totalPagado,
      totalPagoIniciales,
    };
  }, [data, headers, orderStatusMap]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3 mb-6">
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
    </div>
  );
}
