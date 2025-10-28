import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, CreditCard, AlertCircle, Wallet, Receipt } from "lucide-react";

interface DashboardProps {
  data: any[];
  headers: string[];
}

export function Dashboard({ data, headers }: DashboardProps) {
  // Helper function to check if an order is cancelled
  const isCancelledOrder = (row: any): boolean => {
    const statusOrden = String(row["STATUS ORDEN"] || "").toLowerCase().trim();
    // Use substring match to catch variations like "cancelado parcial", "cancelled", etc.
    return statusOrden.includes("cancel");
  };

  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalOrdenesActivas: 0,
        montoVentas: 0,
        pagoInicial: 0,
        cuotasPagadas: 0,
        totalPagos: 0,
        saldo: 0,
      };
    }

    let totalOrdenesActivas = 0;
    let montoVentas = 0;
    let pagoInicialTotal = 0;
    let cuotasPagadasTotal = 0;
    let totalPagos = 0;
    let saldoPendiente = 0; // Sum of individual positive saldos only

    data.forEach((row, index) => {
      // Check if order is cancelled first
      const isCancelled = isCancelledOrder(row);

      // Get Venta Total (exclude cancelled orders)
      const ventaTotalStr = row["Venta total"];
      const ventaTotal = parseFloat(ventaTotalStr || 0);
      
      if (!ventaTotalStr || isNaN(ventaTotal)) {
        montoVentas += 0;
      } else if (!isCancelled) {
        montoVentas += ventaTotal;
      }

      // Get PAGO INICIAL (exclude cancelled orders)
      const pagoInicialStr = row["PAGO INICIAL"];
      const pagoInicial = parseFloat(pagoInicialStr || 0);
      const pagoInicialValue = isNaN(pagoInicial) ? 0 : pagoInicial;
      
      if (!isCancelled) {
        pagoInicialTotal += pagoInicialValue;
      }
      
      let totalPagadoRow = pagoInicialValue;

      // Sum all "Pagado de cuota N" values (exclude cancelled orders)
      let cuotasPagadasRow = 0;
      for (let i = 1; i <= 14; i++) {
        const pagadoCuotaStr = row[`Pagado de cuota ${i}`];
        const pagadoCuota = parseFloat(pagadoCuotaStr || 0);
        if (!isNaN(pagadoCuota)) {
          cuotasPagadasRow += pagadoCuota;
          totalPagadoRow += pagadoCuota;
        }
      }
      
      if (!isCancelled) {
        cuotasPagadasTotal += cuotasPagadasRow;
        totalPagos += totalPagadoRow;
      }

      // Calculate individual saldo for this order
      const saldoRow = ventaTotal - totalPagadoRow;
      
      // Only add positive saldos to the pending balance
      // This ensures overpayments don't reduce the total pending amount
      if (saldoRow > 0) {
        saldoPendiente += saldoRow;
      }
      
      // Check if order is "Activa" (has outstanding payments)
      if (saldoRow > 0.01) { // Consider active if saldo > $0.01
        totalOrdenesActivas++;
      }
    });

    return {
      totalOrdenesActivas,
      montoVentas,
      pagoInicial: pagoInicialTotal,
      cuotasPagadas: cuotasPagadasTotal,
      totalPagos,
      saldo: saldoPendiente,
    };
  }, [data]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Órdenes Activas
          </CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-ordenes-activas">
            {metrics.totalOrdenesActivas}
          </div>
          <p className="text-xs text-muted-foreground">
            Con pagos pendientes
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Monto de Ventas
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-monto-ventas">
            {formatCurrency(metrics.montoVentas)}
          </div>
          <p className="text-xs text-muted-foreground">
            Total vendido
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Pago Inicial
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-pago-inicial">
            {formatCurrency(metrics.pagoInicial)}
          </div>
          <p className="text-xs text-muted-foreground">
            Suma de pagos iniciales
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Cuotas Pagadas
          </CardTitle>
          <Receipt className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-cuotas-pagadas">
            {formatCurrency(metrics.cuotasPagadas)}
          </div>
          <p className="text-xs text-muted-foreground">
            Suma de todas las cuotas
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Pagos Recibidos
          </CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-pagos">
            {formatCurrency(metrics.totalPagos)}
          </div>
          <p className="text-xs text-muted-foreground">
            Inicial + cuotas pagadas
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Saldo Pendiente
          </CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-saldo">
            {formatCurrency(metrics.saldo)}
          </div>
          <p className="text-xs text-muted-foreground">
            Por cobrar
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
