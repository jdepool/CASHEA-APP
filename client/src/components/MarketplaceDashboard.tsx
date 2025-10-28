import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, Wallet, Package } from "lucide-react";
import { normalizeNumber } from "@shared/numberUtils";

interface MarketplaceDashboardProps {
  data: any[];
  headers: string[];
}

export function MarketplaceDashboard({ data, headers }: MarketplaceDashboardProps) {
  // Helper function to find column names (case-insensitive)
  const findColumn = (name: string) => {
    return headers.find(h => h.toLowerCase().includes(name.toLowerCase())) || name;
  };

  const totalUsdColumn = findColumn("total usd") || findColumn("total");
  const pagoInicialColumn = findColumn("pago inicial usd") || findColumn("pago inicial") || findColumn("inicial");
  const estadoEntregaColumn = findColumn("estado de entrega") || findColumn("entrega");

  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        ventasInApp: 0,
        ventasRemote: 0,
        totalVentas: 0,
        pagoInicialInApp: 0,
        pagoInicialRemote: 0,
        totalPagoInicial: 0,
        ordersInApp: 0,
        ordersRemote: 0,
        totalOrdenes: 0,
      };
    }

    let ventasInApp = 0;
    let ventasRemote = 0;
    let totalVentas = 0;
    let pagoInicialInApp = 0;
    let pagoInicialRemote = 0;
    let totalPagoInicial = 0;
    let ordersInApp = 0;
    let ordersRemote = 0;

    data.forEach((row) => {
      const estadoEntrega = String(row[estadoEntregaColumn] || "").toUpperCase().trim();
      const totalUsdValue = normalizeNumber(row[totalUsdColumn]);
      const totalUsd = isNaN(totalUsdValue) ? 0 : totalUsdValue;
      const pagoInicialValue = normalizeNumber(row[pagoInicialColumn]);
      const pagoInicial = isNaN(pagoInicialValue) ? 0 : pagoInicialValue;

      // Total Ventas (all orders)
      totalVentas += totalUsd;

      // Total Pago Inicial (all orders)
      totalPagoInicial += pagoInicial;

      // Total Ordenes
      // (counted at the end)

      // Check delivery status
      if (estadoEntrega === "TO DELIVER") {
        ventasInApp += totalUsd;
        pagoInicialInApp += pagoInicial;
        ordersInApp++;
      } else if (estadoEntrega === "DELIVERED") {
        ventasRemote += totalUsd;
        pagoInicialRemote += pagoInicial;
        ordersRemote++;
      }
    });

    const totalOrdenes = data.length;

    return {
      ventasInApp,
      ventasRemote,
      totalVentas,
      pagoInicialInApp,
      pagoInicialRemote,
      totalPagoInicial,
      ordersInApp,
      ordersRemote,
      totalOrdenes,
    };
  }, [data, totalUsdColumn, pagoInicialColumn, estadoEntregaColumn]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    }).format(value);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
      {/* Ventas in App */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Ventas in App
          </CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-ventas-in-app">
            {formatCurrency(metrics.ventasInApp)}
          </div>
          <p className="text-xs text-muted-foreground">
            Estado de entrega: TO DELIVER
          </p>
        </CardContent>
      </Card>

      {/* Ventas Remote */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Ventas Remote
          </CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-ventas-remote">
            {formatCurrency(metrics.ventasRemote)}
          </div>
          <p className="text-xs text-muted-foreground">
            Estado de entrega: DELIVERED
          </p>
        </CardContent>
      </Card>

      {/* Total Ventas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Ventas
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-total-ventas">
            {formatCurrency(metrics.totalVentas)}
          </div>
          <p className="text-xs text-muted-foreground">
            Todas las órdenes
          </p>
        </CardContent>
      </Card>

      {/* Pago inicial in App */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Pago inicial in App
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-pago-inicial-in-app">
            {formatCurrency(metrics.pagoInicialInApp)}
          </div>
          <p className="text-xs text-muted-foreground">
            Estado de entrega: TO DELIVER
          </p>
        </CardContent>
      </Card>

      {/* Pago inicial Remote */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Pago inicial Remote
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-pago-inicial-remote">
            {formatCurrency(metrics.pagoInicialRemote)}
          </div>
          <p className="text-xs text-muted-foreground">
            Estado de entrega: DELIVERED
          </p>
        </CardContent>
      </Card>

      {/* Total Pago inicial */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Pago inicial
          </CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-total-pago-inicial">
            {formatCurrency(metrics.totalPagoInicial)}
          </div>
          <p className="text-xs text-muted-foreground">
            Todas las órdenes
          </p>
        </CardContent>
      </Card>

      {/* Total Orders in App */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Orders in App
          </CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-orders-in-app">
            {metrics.ordersInApp}
          </div>
          <p className="text-xs text-muted-foreground">
            Estado de entrega: TO DELIVER
          </p>
        </CardContent>
      </Card>

      {/* Total orders Remote */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total orders Remote
          </CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-orders-remote">
            {metrics.ordersRemote}
          </div>
          <p className="text-xs text-muted-foreground">
            Estado de entrega: DELIVERED
          </p>
        </CardContent>
      </Card>

      {/* Total Ordenes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Órdenes
          </CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-total-ordenes">
            {metrics.totalOrdenes}
          </div>
          <p className="text-xs text-muted-foreground">
            Todas las órdenes
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
