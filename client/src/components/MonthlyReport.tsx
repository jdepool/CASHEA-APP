import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";

interface MonthlyReportProps {
  tableData: any[];
}

export function MonthlyReport({ tableData }: MonthlyReportProps) {
  if (tableData.length === 0) {
    return (
      <div className="text-center py-12">
        <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No hay datos disponibles</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Carga un archivo desde la pestaña "CARGAR DATOS" para generar el reporte mensual
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Reporte Mensual</h2>
        <p className="text-muted-foreground">
          Análisis y resumen mensual de órdenes y pagos
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reporte en Construcción</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Esta sección mostrará un reporte mensual detallado con métricas y análisis de las órdenes y pagos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
