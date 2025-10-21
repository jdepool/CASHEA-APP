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
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left py-3 px-4 font-semibold text-sm" data-testid="header-orden">
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
                Estado Cuota / Fecha de Pago
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
                <td className="py-3 px-4 font-mono text-sm" data-testid={`cell-orden-${idx}`}>
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
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={inst.estadoCuota} />
                    {inst.estadoCuota.toLowerCase() === 'done' && inst.fechaPago && (
                      <span className="text-xs text-muted-foreground">
                        Pagado: {formatDate(inst.fechaPago)}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
