import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";

interface InstallmentsDashboardProps {
  installments: any[];
}

export function InstallmentsDashboard({ installments }: InstallmentsDashboardProps) {
  const metrics = useMemo(() => {
    let cuotasPagadas = 0;
    let cuotasProgramadas = 0;
    let cuotasCanceladas = 0;
    let cuotasAtrasadas = 0;

    installments.forEach((installment) => {
      const estado = (installment.estadoCuota || '').trim();
      
      if (estado === 'Done') {
        cuotasPagadas++;
      } else if (estado === 'Scheduled' || estado === 'Graced') {
        cuotasProgramadas++;
      } else if (estado === 'Cancelled') {
        cuotasCanceladas++;
      } else if (estado === 'Delayed') {
        cuotasAtrasadas++;
      }
    });

    return {
      cuotasPagadas,
      cuotasProgramadas,
      cuotasCanceladas,
      cuotasAtrasadas,
    };
  }, [installments]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Cuotas Pagadas</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="metric-cuotas-pagadas">
                {metrics.cuotasPagadas}
              </p>
              <p className="text-xs text-muted-foreground">Done</p>
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
              <p className="text-xs text-muted-foreground">Scheduled + Graced</p>
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
              <p className="text-xs text-muted-foreground">Delayed</p>
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
              <p className="text-xs text-muted-foreground">Cancelled</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
