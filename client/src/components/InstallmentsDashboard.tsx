import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, XCircle, AlertCircle, CreditCard, DollarSign } from "lucide-react";
import { calculateTotalAmount } from "@/lib/installmentUtils";

interface InstallmentsDashboardProps {
  installments: any[];
}

export function InstallmentsDashboard({ installments }: InstallmentsDashboardProps) {
  const metrics = useMemo(() => {
    let cuotasPagadas = 0;
    let cuotasProgramadas = 0;
    let cuotasCanceladas = 0;
    let cuotasAtrasadas = 0;
    let montoPagadas = 0;
    let montoProgramadas = 0;
    let montoCanceladas = 0;
    let montoAtrasadas = 0;
    let montoOtroAliadoVerificado = 0;
    let cuotasOtroAliadoVerificado = 0;

    installments.forEach((installment) => {
      const estado = (installment.estadoCuota || '').trim().toLowerCase();
      const monto = installment.monto || 0;
      const status = (installment.status || '').trim().toUpperCase();
      const verificacion = (installment.verificacion || '').trim().toUpperCase();
      
      // Calculate OTRO ALIADO + VERIFICACION = SI metric
      if (status === 'OTRO ALIADO' && verificacion === 'SI') {
        montoOtroAliadoVerificado += monto;
        cuotasOtroAliadoVerificado++;
      }
      
      if (estado === 'done') {
        cuotasPagadas++;
        montoPagadas += monto;
      } else if (estado === 'scheduled' || estado === 'graced') {
        cuotasProgramadas++;
        montoProgramadas += monto;
      } else if (estado === 'cancelled') {
        cuotasCanceladas++;
        montoCanceladas += monto;
      } else if (estado === 'delayed') {
        cuotasAtrasadas++;
        montoAtrasadas += monto;
      }
    });

    const totalCuotas = installments.length;
    const totalMonto = calculateTotalAmount(installments);

    return {
      cuotasPagadas,
      cuotasProgramadas,
      cuotasCanceladas,
      cuotasAtrasadas,
      montoPagadas,
      montoProgramadas,
      montoCanceladas,
      montoAtrasadas,
      totalCuotas,
      totalMonto,
      montoOtroAliadoVerificado,
      cuotasOtroAliadoVerificado,
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
      {/* Status-based metrics (4 cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cuotas Pagadas</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="metric-cuotas-pagadas">
                  {metrics.cuotasPagadas}
                </p>
                <p className="text-xs font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(metrics.montoPagadas)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cuotas Programadas</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400" data-testid="metric-cuotas-programadas">
                  {metrics.cuotasProgramadas}
                </p>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {formatCurrency(metrics.montoProgramadas)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cuotas Atrasadas</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400" data-testid="metric-cuotas-atrasadas">
                  {metrics.cuotasAtrasadas}
                </p>
                <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                  {formatCurrency(metrics.montoAtrasadas)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cuotas Canceladas</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400" data-testid="metric-cuotas-canceladas">
                  {metrics.cuotasCanceladas}
                </p>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                  {formatCurrency(metrics.montoCanceladas)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Total metrics (3 cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Cuotas</p>
                <p className="text-3xl font-bold" data-testid="metric-total-cuotas">
                  {metrics.totalCuotas}
                </p>
                <p className="text-xs text-muted-foreground">Cuotas mostradas</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Monto Total</p>
                <p className="text-3xl font-bold" data-testid="metric-total-monto">
                  {formatCurrency(metrics.totalMonto)}
                </p>
                <p className="text-xs text-muted-foreground">Suma de cuotas</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Depósitos Otros Aliados</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400" data-testid="metric-otro-aliado-verificado">
                  {formatCurrency(metrics.montoOtroAliadoVerificado)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {metrics.cuotasOtroAliadoVerificado} cuotas verificadas
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
