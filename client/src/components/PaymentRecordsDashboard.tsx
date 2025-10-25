import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, DollarSign } from "lucide-react";
import { normalizeNumber } from "@shared/numberUtils";

interface PaymentRecordsDashboardProps {
  data: any[];
  headers: string[];
}

export function PaymentRecordsDashboard({ data, headers }: PaymentRecordsDashboardProps) {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalCuotasPagadas: 0,
        totalPagado: 0,
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
      }

      // Parse cuota value(s)
      if (ordenNum && cuotaValue) {
        // Split by comma to handle multi-installment payments (e.g., "4,5,6")
        const cuotaNumbers = cuotaValue.split(',').map(c => c.trim()).filter(c => c);
        
        cuotaNumbers.forEach(cuotaNum => {
          // Create unique key: "order_cuota"
          const key = `${ordenNum}_${cuotaNum}`;
          uniqueCuotas.add(key);
        });
      }
    });

    return {
      totalCuotasPagadas: uniqueCuotas.size,
      totalPagado,
    };
  }, [data, headers]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 mb-6">
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
