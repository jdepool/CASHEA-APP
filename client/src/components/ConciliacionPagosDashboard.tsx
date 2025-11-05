import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { calculateCuotasAdelantadas } from "@/lib/installmentUtils";

interface ConciliacionPagosDashboardProps {
  installments: any[];
}

export function ConciliacionPagosDashboard({ installments }: ConciliacionPagosDashboardProps) {
  const metrics = useMemo(() => {
    console.log('=== CONCILIACION DE PAGOS Dashboard Debug ===');
    console.log('installments count:', installments?.length || 0);
    const adelantados = installments.filter(
      inst => (inst.status || '').trim().toUpperCase() === 'ADELANTADO'
    );
    console.log('ADELANTADO entries:', adelantados.length);
    console.log('ADELANTADO sample:', adelantados.slice(0, 3));
    const cuotasAdelantadasMonto = calculateCuotasAdelantadas(installments);
    console.log('Total Cuotas Adelantadas:', cuotasAdelantadasMonto);
    const cuotasAdelantadasCount = adelantados.length;

    return {
      cuotasAdelantadasMonto,
      cuotasAdelantadasCount,
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
