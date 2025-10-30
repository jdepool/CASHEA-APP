import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";
import { normalizeNumber } from "@shared/numberUtils";

interface MonthlyReportProps {
  marketplaceData: any;
}

export function MonthlyReport({ marketplaceData }: MonthlyReportProps) {
  const data = marketplaceData?.data?.rows || [];
  const headers = marketplaceData?.data?.headers || [];

  // Helper function to find column names (case-insensitive)
  const findColumn = (name: string) => {
    return headers.find((h: string) => h.toLowerCase().includes(name.toLowerCase()));
  };

  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalVentas: 0,
        totalPagoInicial: 0,
        montoFinanciado: 0,
        porcentajeFinanciado: 0,
      };
    }

    const totalUsdColumn = findColumn("total usd") || findColumn("total") || "";
    const pagoInicialColumn = findColumn("pago inicial usd") || findColumn("pago inicial") || findColumn("inicial") || "";

    let totalVentas = 0;
    let totalPagoInicial = 0;

    data.forEach((row: any) => {
      const totalUsdValue = normalizeNumber(row[totalUsdColumn]);
      const totalUsd = isNaN(totalUsdValue) ? 0 : totalUsdValue;
      const pagoInicialValue = normalizeNumber(row[pagoInicialColumn]);
      const pagoInicial = isNaN(pagoInicialValue) ? 0 : pagoInicialValue;

      totalVentas += totalUsd;
      totalPagoInicial += pagoInicial;
    });

    const montoFinanciado = totalVentas - totalPagoInicial;
    const porcentajeFinanciado = totalVentas > 0 ? (montoFinanciado / totalVentas) * 100 : 0;

    return {
      totalVentas,
      totalPagoInicial,
      montoFinanciado,
      porcentajeFinanciado,
    };
  }, [data, headers]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    }).format(value);
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No hay datos disponibles</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Carga un archivo de marketplace desde la pestaña "CARGAR DATOS" para generar el reporte mensual
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Reporte Mensual</h2>
        <p className="text-muted-foreground">
          Resumen financiero basado en datos de marketplace
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Ventas de este periodo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="border-b pb-2 mb-2">
              <h3 className="font-semibold mb-3">VENTAS</h3>
            </div>
            
            <div className="flex justify-between items-center py-2">
              <span>Ventas Totales (incluye IVA)</span>
              <span className="font-mono text-right" data-testid="ventas-totales">
                {formatCurrency(metrics.totalVentas)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span>(-) Monto Pagado en Caja</span>
              <span className="font-mono text-right" data-testid="monto-pagado-caja">
                {formatCurrency(metrics.totalPagoInicial)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 bg-muted/50 px-3 -mx-3 rounded-md">
              <span className="font-semibold">Monto Financiado</span>
              <span className="font-mono font-semibold text-right" data-testid="monto-financiado">
                {formatCurrency(metrics.montoFinanciado)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="italic text-muted-foreground">Porcentaje Financiado</span>
              <span className="font-mono text-right italic text-muted-foreground" data-testid="porcentaje-financiado">
                {metrics.porcentajeFinanciado.toFixed(0)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
