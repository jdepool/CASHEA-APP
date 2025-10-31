import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";
import { normalizeNumber } from "@shared/numberUtils";
import { parseDDMMYYYY, parseExcelDate } from "@/lib/dateUtils";

interface MonthlyReportProps {
  marketplaceData: any;
  dateFrom: string;
  dateTo: string;
  estadoFilter: string;
  ordenFilter: string;
  estadoEntregaFilter: string;
  referenciaFilter: string;
  masterDateFrom?: string;
  masterDateTo?: string;
  masterOrden?: string;
}

export function MonthlyReport({ 
  marketplaceData,
  dateFrom,
  dateTo,
  estadoFilter,
  ordenFilter,
  estadoEntregaFilter,
  referenciaFilter,
  masterDateFrom,
  masterDateTo,
  masterOrden
}: MonthlyReportProps) {
  const data = marketplaceData?.data?.rows || [];
  const headers = marketplaceData?.data?.headers || [];

  // Helper function to find column names (case-insensitive)
  const findColumn = (name: string) => {
    return headers.find((h: string) => h.toLowerCase().includes(name.toLowerCase()));
  };

  const estadoColumn = findColumn("estado pago");
  const ordenColumn = findColumn("# orden") || findColumn("orden");
  const estadoEntregaColumn = findColumn("estado de entrega") || findColumn("entrega");
  const referenciaColumn = findColumn("# referencia") || findColumn("referencia");
  const dateColumn = findColumn("fecha") || findColumn("date") || headers.find((h: string) => h.toLowerCase().includes("fecha"));

  // Apply filters to get filtered data (same logic as MarketplaceOrdersTable)
  const filteredData = useMemo(() => {
    return data.filter((row: any) => {
      // MASTER FILTERS - Applied FIRST
      // Master date filter (if date column exists)
      if (dateColumn && (masterDateFrom || masterDateTo)) {
        const rowDate = row[dateColumn];
        if (rowDate) {
          let rowDateObj: Date | null = null;
          if (typeof rowDate === 'string') {
            const parsedDate = parseDDMMYYYY(rowDate);
            if (parsedDate) {
              rowDateObj = parsedDate;
            } else {
              rowDateObj = new Date(rowDate);
              if (isNaN(rowDateObj.getTime())) {
                rowDateObj = null;
              }
            }
          } else if (rowDate instanceof Date) {
            rowDateObj = rowDate;
          } else if (typeof rowDate === 'number') {
            const excelDate = parseExcelDate(rowDate);
            if (excelDate) {
              rowDateObj = excelDate;
            } else {
              rowDateObj = new Date(rowDate);
            }
          }

          if (rowDateObj && !isNaN(rowDateObj.getTime())) {
            if (masterDateFrom) {
              const fromDate = parseDDMMYYYY(masterDateFrom);
              if (fromDate && rowDateObj < fromDate) return false;
            }
            if (masterDateTo) {
              const toDate = parseDDMMYYYY(masterDateTo);
              if (toDate) {
                const endOfDay = new Date(toDate);
                endOfDay.setHours(23, 59, 59, 999);
                if (rowDateObj > endOfDay) return false;
              }
            }
          }
        }
      }

      // Master orden filter
      if (masterOrden && ordenColumn) {
        const rowOrden = String(row[ordenColumn] || "").toLowerCase();
        if (!rowOrden.includes(masterOrden.toLowerCase())) return false;
      }

      // TAB-SPECIFIC FILTERS - Applied AFTER master filters
      // Date filter (if date column exists)
      if (dateColumn && (dateFrom || dateTo)) {
        const rowDate = row[dateColumn];
        if (rowDate) {
          let rowDateObj: Date | null = null;
          if (typeof rowDate === 'string') {
            const parsedDate = parseDDMMYYYY(rowDate);
            if (parsedDate) {
              rowDateObj = parsedDate;
            } else {
              rowDateObj = new Date(rowDate);
              if (isNaN(rowDateObj.getTime())) {
                rowDateObj = null;
              }
            }
          } else if (rowDate instanceof Date) {
            rowDateObj = rowDate;
          } else if (typeof rowDate === 'number') {
            const excelDate = parseExcelDate(rowDate);
            if (excelDate) {
              rowDateObj = excelDate;
            } else {
              rowDateObj = new Date(rowDate);
            }
          }

          if (rowDateObj && !isNaN(rowDateObj.getTime())) {
            if (dateFrom) {
              const fromDate = parseDDMMYYYY(dateFrom);
              if (fromDate && rowDateObj < fromDate) return false;
            }
            if (dateTo) {
              const toDate = parseDDMMYYYY(dateTo);
              if (toDate) {
                const endOfDay = new Date(toDate);
                endOfDay.setHours(23, 59, 59, 999);
                if (rowDateObj > endOfDay) return false;
              }
            }
          }
        }
      }

      // Estado filter
      if (estadoFilter !== "all" && estadoColumn) {
        const rowEstado = String(row[estadoColumn] || "");
        if (rowEstado !== estadoFilter) return false;
      }

      // Orden filter
      if (ordenFilter && ordenColumn) {
        const rowOrden = String(row[ordenColumn] || "").toLowerCase();
        if (!rowOrden.includes(ordenFilter.toLowerCase())) return false;
      }

      // Estado de entrega filter
      if (estadoEntregaFilter !== "all" && estadoEntregaColumn) {
        const rowEstadoEntrega = String(row[estadoEntregaColumn] || "");
        if (rowEstadoEntrega !== estadoEntregaFilter) return false;
      }

      // Referencia filter
      if (referenciaFilter && referenciaColumn) {
        const rowReferencia = String(row[referenciaColumn] || "").toLowerCase();
        if (!rowReferencia.includes(referenciaFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [data, dateFrom, dateTo, estadoFilter, ordenFilter, estadoEntregaFilter, referenciaFilter, dateColumn, estadoColumn, ordenColumn, estadoEntregaColumn, referenciaColumn, masterDateFrom, masterDateTo, masterOrden]);

  const metrics = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return {
        totalVentas: 0,
        totalPagoInicial: 0,
        montoFinanciado: 0,
        porcentajeFinanciado: 0,
        serviciosPrestados: 0,
        iva16: 0,
        ivaRetenido: 0,
        ivaPagarCashea: 0,
        islrRetenido: 0,
        totalServiciosTecnologicos: 0,
      };
    }

    const totalUsdColumn = findColumn("total usd") || findColumn("total") || "";
    const pagoInicialColumn = findColumn("pago inicial usd") || findColumn("pago inicial") || findColumn("inicial") || "";

    let totalVentas = 0;
    let totalPagoInicial = 0;

    filteredData.forEach((row: any) => {
      const totalUsdValue = normalizeNumber(row[totalUsdColumn]);
      const totalUsd = isNaN(totalUsdValue) ? 0 : totalUsdValue;
      const pagoInicialValue = normalizeNumber(row[pagoInicialColumn]);
      const pagoInicial = isNaN(pagoInicialValue) ? 0 : pagoInicialValue;

      totalVentas += totalUsd;
      totalPagoInicial += pagoInicial;
    });

    const montoFinanciado = totalVentas - totalPagoInicial;
    const porcentajeFinanciado = totalVentas > 0 ? (montoFinanciado / totalVentas) * 100 : 0;

    // TODO: Calculate these values based on user's explanation
    const serviciosPrestados = 0;
    const iva16 = 0;
    const ivaRetenido = 0;
    const ivaPagarCashea = 0;
    const islrRetenido = 0;
    const totalServiciosTecnologicos = 0;

    // TODO: Calculate reconciliation adjustments based on user's explanation
    const devolucionesPagoClientes = 0;
    const cupones = 0;
    const subtotalIncidencias = 0;
    const depositosOtrosAliados = 0;
    const depositosBancoOtrosAliados = 0;
    const subtotalErroresBancarios = 0;
    const compensacionFacturasPendientes = 0;
    const avanceCajaVencido = 0;
    const servTecnologicoOrdenesCanceladas = 0;
    const totalAvancesCaja = 0;
    const totalReconocer = 0;

    return {
      totalVentas,
      totalPagoInicial,
      montoFinanciado,
      porcentajeFinanciado,
      serviciosPrestados,
      iva16,
      ivaRetenido,
      ivaPagarCashea,
      islrRetenido,
      totalServiciosTecnologicos,
      devolucionesPagoClientes,
      cupones,
      subtotalIncidencias,
      depositosOtrosAliados,
      depositosBancoOtrosAliados,
      subtotalErroresBancarios,
      compensacionFacturasPendientes,
      avanceCajaVencido,
      servTecnologicoOrdenesCanceladas,
      totalAvancesCaja,
      totalReconocer,
    };
  }, [filteredData, headers]);

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

      <Card>
        <CardHeader>
          <CardTitle>SERVICIOS TECNOLÓGICOS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span>Servicios Prestados</span>
              <span className="font-mono text-right" data-testid="servicios-prestados">
                {formatCurrency(metrics.serviciosPrestados)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span>(+) IVA 16%</span>
              <span className="font-mono text-right" data-testid="iva-16">
                {formatCurrency(metrics.iva16)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span>(-) IVA retenido por aliado (75%)</span>
              <span className="font-mono text-right" data-testid="iva-retenido">
                {formatCurrency(metrics.ivaRetenido)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span>IVA a pagar a CASHEA</span>
              <span className="font-mono text-right" data-testid="iva-pagar-cashea">
                {formatCurrency(metrics.ivaPagarCashea)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span>(-) ISLR retenido por aliado</span>
              <span className="font-mono text-right" data-testid="islr-retenido">
                {formatCurrency(metrics.islrRetenido)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 bg-muted/50 px-3 -mx-3 rounded-md">
              <span className="font-semibold">(-) Total Servicios Tecnológicos</span>
              <span className="font-mono font-semibold text-right" data-testid="total-servicios-tecnologicos">
                {formatCurrency(metrics.totalServiciosTecnologicos)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>III. AJUSTES QUE COMPENSAMOS PARA COMPLETAR LA CONCILIACIÓN</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* INCIDENCIAS SOBRE COMPRADORES */}
            <div className="space-y-3">
              <div className="border-b pb-2 mb-2">
                <h3 className="font-semibold mb-3">INCIDENCIAS SOBRE COMPRADORES</h3>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span>(+) Devoluciones por errores de pago de clientes</span>
                <span className="font-mono text-right" data-testid="devoluciones-pago-clientes">
                  {formatCurrency(metrics.devolucionesPagoClientes ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>(-) Cupones</span>
                <span className="font-mono text-right" data-testid="cupones">
                  {formatCurrency(metrics.cupones ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 bg-muted/50 px-3 -mx-3 rounded-md">
                <span className="font-semibold">(2) Subtotal incidencias</span>
                <span className="font-mono font-semibold text-right" data-testid="subtotal-incidencias">
                  {formatCurrency(metrics.subtotalIncidencias ?? 0)}
                </span>
              </div>
            </div>

            {/* ERRORES BANCARIOS */}
            <div className="space-y-3">
              <div className="border-b pb-2 mb-2">
                <h3 className="font-semibold mb-3">ERRORES BANCARIOS</h3>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span>(+) Depósitos de otros aliados</span>
                <span className="font-mono text-right" data-testid="depositos-otros-aliados">
                  {formatCurrency(metrics.depositosOtrosAliados ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>(-) Depósitos en banco de otros aliados</span>
                <span className="font-mono text-right" data-testid="depositos-banco-otros-aliados">
                  {formatCurrency(metrics.depositosBancoOtrosAliados ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 bg-muted/50 px-3 -mx-3 rounded-md">
                <span className="font-semibold">(3) Subtotal Errores Bancarios</span>
                <span className="font-mono font-semibold text-right" data-testid="subtotal-errores-bancarios">
                  {formatCurrency(metrics.subtotalErroresBancarios ?? 0)}
                </span>
              </div>
            </div>

            {/* AVANCE DE CAJA - AJUSTES */}
            <div className="space-y-3">
              <div className="border-b pb-2 mb-2">
                <h3 className="font-semibold mb-3">AVANCE DE CAJA - AJUSTES</h3>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span>Compensación de facturas pendientes</span>
                <span className="font-mono text-right" data-testid="compensacion-facturas-pendientes">
                  {formatCurrency(metrics.compensacionFacturasPendientes ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>Avance de caja vencido al 31/01/2025</span>
                <span className="font-mono text-right" data-testid="avance-caja-vencido">
                  {formatCurrency(metrics.avanceCajaVencido ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span>(-) Serv Tecnológico Órdenes Canceladas</span>
                <span className="font-mono text-right" data-testid="serv-tecnologico-ordenes-canceladas">
                  {formatCurrency(metrics.servTecnologicoOrdenesCanceladas ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 bg-muted/50 px-3 -mx-3 rounded-md">
                <span className="font-semibold">(4) Total avances de caja</span>
                <span className="font-mono font-semibold text-right" data-testid="total-avances-caja">
                  {formatCurrency(metrics.totalAvancesCaja ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IV. TOTAL A RECONOCER</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center py-2 bg-primary/10 px-3 -mx-3 rounded-md">
            <span className="font-semibold text-lg">Total a reconocer Cáshea a BOXI SLEEP, C.A. (1) + (2) + (3) + (4)</span>
            <span className="font-mono font-bold text-lg text-right" data-testid="total-reconocer">
              {formatCurrency(metrics.totalReconocer ?? 0)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
