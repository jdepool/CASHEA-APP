import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Clock, AlertCircle } from "lucide-react";

interface CuotasDashboardProps {
  installments: any[];
}

export function CuotasDashboard({ installments }: CuotasDashboardProps) {
  const metrics = useMemo(() => {
    let cuotasPagadas = 0;
    let montoCuotasPagadas = 0;
    let cuotasProgramadas = 0;
    let montoCuotasProgramadas = 0;
    let cuotasAtrasadas = 0;
    let montoAtrasadas = 0;

    installments.forEach((installment) => {
      const estado = (installment.estadoCuota || '').trim().toLowerCase();
      const monto = installment.monto || 0;

      if (estado === 'done') {
        cuotasPagadas++;
        montoCuotasPagadas += monto;
      } else if (estado === 'scheduled' || estado === 'graced') {
        cuotasProgramadas++;
        montoCuotasProgramadas += monto;
      } else if (estado === 'delayed') {
        cuotasAtrasadas++;
        montoAtrasadas += monto;
      }
    });

    return {
      cuotasPagadas,
      montoCuotasPagadas,
      cuotasProgramadas,
      montoCuotasProgramadas,
      cuotasAtrasadas,
      montoAtrasadas,
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

  const formatCurrencyWithDots = (value: number) => {
    // Format as currency with dots for thousands and comma for decimal
    const formatted = new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    // Replace 'US$' with '$' if present
    return formatted.replace('US$', '$');
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('es-ES');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* CUOTAS PAGADAS */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">CUOTAS PAGADAS</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="metric-cuotas-pagadas-total">
                {formatCurrency(metrics.montoCuotasPagadas)}
              </p>
              <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                {formatNumber(metrics.cuotasPagadas)} cuotas
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CUENTAS POR COBRAR NETAS */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">CUENTAS POR COBRAR NETAS</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="metric-cuentas-por-cobrar-netas">
                {formatCurrencyWithDots(metrics.montoCuotasProgramadas)}
              </p>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {formatNumber(metrics.cuotasProgramadas)} cuotas
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CUOTAS ATRASADAS */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">CUOTAS ATRASADAS</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="metric-cuotas-atrasadas-total">
                {formatCurrency(metrics.montoAtrasadas)}
              </p>
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                {formatNumber(metrics.cuotasAtrasadas)} cuotas
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
