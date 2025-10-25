import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, CreditCard, AlertCircle } from "lucide-react";

interface DashboardProps {
  data: any[];
  headers: string[];
}

export function Dashboard({ data, headers }: DashboardProps) {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalOrdenesActivas: 0,
        montoVentas: 0,
        totalPagos: 0,
        saldo: 0,
      };
    }

    let totalOrdenesActivas = 0;
    let montoVentas = 0;
    let totalPagos = 0;

    data.forEach((row, index) => {
      // Get Venta Total
      const ventaTotalStr = row["Venta total"];
      const ventaTotal = parseFloat(ventaTotalStr || 0);
      
      if (!ventaTotalStr || isNaN(ventaTotal)) {
        montoVentas += 0;
      } else {
        montoVentas += ventaTotal;
      }

      // Get PAGO INICIAL
      const pagoInicialStr = row["PAGO INICIAL"];
      const pagoInicial = parseFloat(pagoInicialStr || 0);
      let totalPagadoRow = isNaN(pagoInicial) ? 0 : pagoInicial;

      // Sum all "Pagado de cuota N" values
      for (let i = 1; i <= 14; i++) {
        const pagadoCuotaStr = row[`Pagado de cuota ${i}`];
        const pagadoCuota = parseFloat(pagadoCuotaStr || 0);
        if (!isNaN(pagadoCuota)) {
          totalPagadoRow += pagadoCuota;
        }
      }

      totalPagos += totalPagadoRow;

      // Check if order is "Activa" (has outstanding payments)
      const saldoRow = ventaTotal - totalPagadoRow;
      
      // Debug first few rows
      if (index < 3) {
        console.log(`Row ${index}:`, {
          ventaTotal,
          totalPagadoRow,
          saldoRow,
          isActive: saldoRow > 0.01
        });
      }
      
      if (saldoRow > 0.01) { // Consider active if saldo > $0.01
        totalOrdenesActivas++;
      }
    });

    console.log('Dashboard metrics:', {
      totalRecords: data.length,
      totalOrdenesActivas,
      montoVentas,
      totalPagos,
      saldo: montoVentas - totalPagos
    });

    const saldo = montoVentas - totalPagos;

    return {
      totalOrdenesActivas,
      montoVentas,
      totalPagos,
      saldo,
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
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
