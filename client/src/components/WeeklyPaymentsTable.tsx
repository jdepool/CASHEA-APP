import { StatusBadge } from "./StatusBadge";
import { formatDate } from "@/lib/dateUtils";
import type { Installment } from "@/lib/installmentUtils";

interface WeeklyPaymentsTableProps {
  installments: Installment[];
}

export function WeeklyPaymentsTable({ installments }: WeeklyPaymentsTableProps) {
  if (installments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="empty-weekly">
        No hay cuotas programadas para esta semana
      </div>
    );
  }

  // Sort by date, then by order number
  const sortedInstallments = [...installments].sort((a, b) => {
    if (a.fechaCuota && b.fechaCuota) {
      const dateCompare = a.fechaCuota.getTime() - b.fechaCuota.getTime();
      if (dateCompare !== 0) return dateCompare;
    }
    return a.orden.localeCompare(b.orden);
  });

  return (
    <div className="border rounded-lg overflow-auto" style={{ maxHeight: '70vh' }}>
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-muted shadow-sm">
          <tr className="border-b">
            <th className="text-left py-3 px-4 font-semibold text-sm sticky left-0 z-20 bg-muted" data-testid="header-orden">
              Orden
            </th>
            <th className="text-left py-3 px-4 font-semibold text-sm" data-testid="header-fecha">
              Fecha Cuota
            </th>
            <th className="text-left py-3 px-4 font-semibold text-sm" data-testid="header-numero">
              # de Cuota
            </th>
            <th className="text-right py-3 px-4 font-semibold text-sm" data-testid="header-monto">
              Monto
            </th>
            <th className="text-left py-3 px-4 font-semibold text-sm" data-testid="header-estado">
              Estado Cuota
            </th>
            <th className="text-left py-3 px-4 font-semibold text-sm" data-testid="header-fecha-pago">
              Fecha de Pago
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedInstallments.map((inst, idx) => (
            <tr
              key={`${inst.orden}-${inst.numeroCuota}`}
              className="border-b last:border-0 hover-elevate"
              data-testid={`row-weekly-${idx}`}
            >
              <td className="py-3 px-4 font-mono text-sm sticky left-0 z-10 bg-card" data-testid={`cell-orden-${idx}`}>
                {inst.orden}
              </td>
              <td className="py-3 px-4 text-sm" data-testid={`cell-fecha-${idx}`}>
                {formatDate(inst.fechaCuota)}
              </td>
              <td className="py-3 px-4 text-sm" data-testid={`cell-numero-${idx}`}>
                {inst.numeroCuota}
              </td>
              <td className="py-3 px-4 text-sm text-right font-mono" data-testid={`cell-monto-${idx}`}>
                ${inst.monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="py-3 px-4" data-testid={`cell-estado-${idx}`}>
                <StatusBadge status={inst.estadoCuota} />
              </td>
              <td className="py-3 px-4 text-sm" data-testid={`cell-fecha-pago-${idx}`}>
                {(inst as any).fechaPagoReal ? (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {formatDate((inst as any).fechaPagoReal)}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
