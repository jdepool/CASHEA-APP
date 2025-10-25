import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, CreditCard } from "lucide-react";
import { calculateTotalAmount } from "@/lib/installmentUtils";

interface InstallmentsDashboardProps {
  installments: any[];
}

export function InstallmentsDashboard({ installments }: InstallmentsDashboardProps) {
  const metrics = useMemo(() => {
    const totalCuotas = installments.length;
    const totalMonto = calculateTotalAmount(installments);

    return {
      totalCuotas,
      totalMonto,
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </div>
  );
}
