import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Clock, Users, DollarSign } from "lucide-react";
import { calculateCuotasAdelantadas } from "@/lib/installmentUtils";

interface ConciliacionPagosDashboardProps {
  installments: any[];
}

export function ConciliacionPagosDashboard({ installments }: ConciliacionPagosDashboardProps) {
  const metrics = useMemo(() => {
    const cuotasAdelantadasMonto = calculateCuotasAdelantadas(installments);
    const cuotasAdelantadasCount = installments.filter(
      inst => (inst.status || '').trim().toUpperCase() === 'ADELANTADO'
    ).length;

    // Cuotas A Tiempo
    const cuotasATiempoFiltered = installments.filter(
      inst => (inst.status || '').trim().toUpperCase() === 'A TIEMPO'
    );
    const cuotasATiempoCount = cuotasATiempoFiltered.length;
    const cuotasATiempoMonto = cuotasATiempoFiltered.reduce((sum, inst) => sum + (inst.monto || 0), 0);

    // Pagos en Otros Aliados
    const pagosOtrosAliadosFiltered = installments.filter(
      inst => (inst.status || '').trim().toUpperCase() === 'OTRO ALIADO'
    );
    const pagosOtrosAliadosCount = pagosOtrosAliadosFiltered.length;
    const pagosOtrosAliadosMonto = pagosOtrosAliadosFiltered.reduce((sum, inst) => sum + (inst.monto || 0), 0);

    // Pagos Totales (sum of all monto and count)
    const pagosTotales = installments.reduce((sum, inst) => sum + (inst.monto || 0), 0);
    const pagosCount = installments.length;

    return {
      cuotasAdelantadasMonto,
      cuotasAdelantadasCount,
      cuotasATiempoCount,
      cuotasATiempoMonto,
      pagosOtrosAliadosCount,
      pagosOtrosAliadosMonto,
      pagosTotales,
      pagosCount,
    };
  }, [installments]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cuotas A Tiempo</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="metric-cuotas-a-tiempo">
                  {formatCurrency(metrics.cuotasATiempoMonto)}
                </p>
                <p className="text-xs font-semibold text-green-600 dark:text-green-400">
                  {metrics.cuotasATiempoCount} {metrics.cuotasATiempoCount === 1 ? 'pago' : 'pagos'}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pagos en Otros Aliados</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400" data-testid="metric-pagos-otros-aliados">
                  {formatCurrency(metrics.pagosOtrosAliadosMonto)}
                </p>
                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                  {metrics.pagosOtrosAliadosCount} {metrics.pagosOtrosAliadosCount === 1 ? 'pago' : 'pagos'}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pagos Totales</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400" data-testid="metric-pagos-totales">
                  {formatCurrency(metrics.pagosTotales)}
                </p>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {metrics.pagosCount} {metrics.pagosCount === 1 ? 'pago' : 'pagos'}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cuotas Adelantadas</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400" data-testid="metric-cuotas-adelantadas">
                  {formatCurrency(metrics.cuotasAdelantadasMonto)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {metrics.cuotasAdelantadasCount} {metrics.cuotasAdelantadasCount === 1 ? 'pago' : 'pagos'} adelantados
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
