import { useState, useMemo } from "react";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "@/lib/dateUtils";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { Installment } from "@/lib/installmentUtils";

interface WeeklyPaymentsTableProps {
  installments: Installment[];
}

export function WeeklyPaymentsTable({ installments }: WeeklyPaymentsTableProps) {
  const [sortColumn, setSortColumn] = useState<string>('fechaCuota');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort installments based on selected column
  const sortedInstallments = useMemo(() => {
    return [...installments].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'orden': {
          const aStr = a.orden || '';
          const bStr = b.orden || '';
          comparison = aStr.localeCompare(bStr);
          break;
        }
        case 'fechaCuota': {
          const aTime = a.fechaCuota?.getTime() || 0;
          const bTime = b.fechaCuota?.getTime() || 0;
          comparison = aTime - bTime;
          break;
        }
        case 'numeroCuota': {
          const aNum = Number(a.numeroCuota) || 0;
          const bNum = Number(b.numeroCuota) || 0;
          comparison = aNum - bNum;
          break;
        }
        case 'monto': {
          const aVal = a.monto || 0;
          const bVal = b.monto || 0;
          comparison = aVal - bVal;
          break;
        }
        case 'estadoCuota': {
          const aStr = (a.estadoCuota || '').toLowerCase();
          const bStr = (b.estadoCuota || '').toLowerCase();
          comparison = aStr.localeCompare(bStr);
          break;
        }
        case 'fechaPagoReal': {
          const aTime = (a as any).fechaPagoReal?.getTime() || 0;
          const bTime = (b as any).fechaPagoReal?.getTime() || 0;
          comparison = aTime - bTime;
          break;
        }
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [installments, sortColumn, sortDirection]);

  if (installments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="empty-weekly">
        No hay cuotas programadas para esta semana
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-auto" style={{ maxHeight: '70vh' }}>
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-muted shadow-sm">
          <tr className="border-b">
            <th 
              onClick={() => handleSort('orden')}
              className="text-left py-3 px-4 font-semibold text-sm sticky left-0 z-20 bg-muted cursor-pointer hover-elevate" 
              data-testid="header-orden"
            >
              <div className="flex items-center gap-1">
                <span>Orden</span>
                {sortColumn === 'orden' ? (
                  sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                )}
              </div>
            </th>
            <th 
              onClick={() => handleSort('fechaCuota')}
              className="text-left py-3 px-4 font-semibold text-sm cursor-pointer hover-elevate" 
              data-testid="header-fecha"
            >
              <div className="flex items-center gap-1">
                <span>Fecha Cuota</span>
                {sortColumn === 'fechaCuota' ? (
                  sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                )}
              </div>
            </th>
            <th 
              onClick={() => handleSort('numeroCuota')}
              className="text-left py-3 px-4 font-semibold text-sm cursor-pointer hover-elevate" 
              data-testid="header-numero"
            >
              <div className="flex items-center gap-1">
                <span># de Cuota</span>
                {sortColumn === 'numeroCuota' ? (
                  sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                )}
              </div>
            </th>
            <th 
              onClick={() => handleSort('monto')}
              className="text-right py-3 px-4 font-semibold text-sm cursor-pointer hover-elevate" 
              data-testid="header-monto"
            >
              <div className="flex items-center gap-1 justify-end">
                <span>Monto</span>
                {sortColumn === 'monto' ? (
                  sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                )}
              </div>
            </th>
            <th 
              onClick={() => handleSort('estadoCuota')}
              className="text-left py-3 px-4 font-semibold text-sm cursor-pointer hover-elevate" 
              data-testid="header-estado"
            >
              <div className="flex items-center gap-1">
                <span>Estado Cuota</span>
                {sortColumn === 'estadoCuota' ? (
                  sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                )}
              </div>
            </th>
            <th 
              onClick={() => handleSort('fechaPagoReal')}
              className="text-left py-3 px-4 font-semibold text-sm cursor-pointer hover-elevate" 
              data-testid="header-fecha-pago"
            >
              <div className="flex items-center gap-1">
                <span>Fecha de Pago</span>
                {sortColumn === 'fechaPagoReal' ? (
                  sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                )}
              </div>
            </th>
            <th className="text-left py-3 px-4 font-semibold text-sm" data-testid="header-referencia">
              # Referencia
            </th>
            <th className="text-left py-3 px-4 font-semibold text-sm" data-testid="header-status">
              STATUS
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedInstallments.map((inst, idx) => {
            // Create unique key including reference number for multiple payments of same installment
            const uniqueKey = (inst as any).paymentDetails?.referencia 
              ? `${inst.orden}-${inst.numeroCuota}-${(inst as any).paymentDetails.referencia}`
              : `${inst.orden}-${inst.numeroCuota}-${idx}`;
            
            return (
              <tr
                key={uniqueKey}
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
                {inst.numeroCuota >= 0 ? inst.numeroCuota : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
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
              <td className="py-3 px-4 text-sm font-mono" data-testid={`cell-referencia-${idx}`}>
                {(inst as any).paymentDetails?.referencia || (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </td>
              <td className="py-3 px-4 text-sm" data-testid={`cell-status-${idx}`}>
                {(() => {
                  const fechaPago = (inst as any).fechaPagoReal;
                  const fechaCuota = inst.fechaCuota;
                  
                  // Only show status if payment has been made and due date exists
                  if (!fechaPago || !fechaCuota) {
                    return <span className="text-muted-foreground text-xs">—</span>;
                  }
                  
                  // Compare dates: A TIEMPO if paid on/before due date, ADELANTADO if paid after
                  const isOnTime = fechaPago <= fechaCuota;
                  
                  return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      isOnTime 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {isOnTime ? 'A TIEMPO' : 'ADELANTADO'}
                    </span>
                  );
                })()}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
