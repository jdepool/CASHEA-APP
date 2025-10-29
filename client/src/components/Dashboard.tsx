import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, CreditCard, AlertCircle, Wallet, Receipt, Calendar } from "lucide-react";
import { parseDDMMYYYY, parseExcelDate } from "@/lib/dateUtils";

interface DashboardProps {
  data: any[];
  headers: string[];
  dateFrom?: string;
  dateTo?: string;
}

export function Dashboard({ data, headers, dateFrom, dateTo }: DashboardProps) {
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
        cuotasDelPeriodo: 0,
        cuentasPorCobrar: 0,
      };
    }

    let totalOrdenesActivas = 0;
    let montoVentas = 0;
    let pagoInicialTotal = 0;
    let cuotasPagadasTotal = 0;
    let totalPagos = 0;
    let saldoPendiente = 0; // Sum of individual positive saldos only
    let cuotasDelPeriodo = 0;
    let cuentasPorCobrar = 0;
    
    // Parse date range for filtering installments using DD/MM/YYYY format
    const fromDate = dateFrom ? parseDDMMYYYY(dateFrom) : null;
    const toDate = dateTo ? parseDDMMYYYY(dateTo) : null;
    
    // Set toDate to end of day to include installments on that date
    if (toDate) {
      toDate.setHours(23, 59, 59, 999);
    }

    // Calculate all metrics from filtered data
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

      // Get PAGO INICIAL for this row
      const pagoInicialStr = row["PAGO INICIAL"];
      const pagoInicial = parseFloat(pagoInicialStr || 0);
      const pagoInicialValue = isNaN(pagoInicial) ? 0 : pagoInicial;
      
      // Add to Pago Inicial total (exclude cancelled orders)
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
      
      // Count installments within the date period
      if (fromDate || toDate) {
        for (let i = 1; i <= 14; i++) {
          const fechaCuotaStr = row[`Fecha cuota ${i}`];
          const cuotaMonto = parseFloat(row[`CUOTA ${i}`] || 0);
          
          if (fechaCuotaStr && cuotaMonto > 0) {
            // Parse the date using the proper utility function
            const fechaCuota = parseExcelDate(fechaCuotaStr);
            
            if (fechaCuota && !isNaN(fechaCuota.getTime())) {
              // Check if date is within the period
              const withinPeriod = 
                (!fromDate || fechaCuota >= fromDate) && 
                (!toDate || fechaCuota <= toDate);
              
              if (withinPeriod) {
                cuotasDelPeriodo++;
                cuentasPorCobrar += cuotaMonto;
              }
            }
          }
        }
      }
    });

    return {
      totalOrdenesActivas,
      montoVentas,
      pagoInicial: pagoInicialTotal,
      cuotasPagadas: cuotasPagadasTotal,
      totalPagos,
      saldo: saldoPendiente,
      cuotasDelPeriodo,
      cuentasPorCobrar,
    };
  }, [data, dateFrom, dateTo]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-6">
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
            # Cuotas del Periodo
          </CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-cuotas-periodo">
            {metrics.cuotasDelPeriodo}
          </div>
          <p className="text-xs text-muted-foreground">
            {dateFrom || dateTo ? 'Cuotas en rango' : 'Selecciona fechas'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Cuentas por Cobrar
          </CardTitle>
          <Receipt className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="metric-cuentas-por-cobrar">
            {formatCurrency(metrics.cuentasPorCobrar)}
          </div>
          <p className="text-xs text-muted-foreground">
            {dateFrom || dateTo ? 'Suma del periodo' : 'Selecciona fechas'}
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
