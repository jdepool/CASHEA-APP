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

  // Helper function to calculate STATUS for sorting
  const getStatusValue = (inst: any): number => {
    const fechaPago = inst.fechaPagoReal;
    const fechaCuota = inst.fechaCuota;
    
    if (!fechaPago || !fechaCuota) return 0; // No status (—)
    
    const pagoNormalized = new Date(fechaPago);
    pagoNormalized.setHours(0, 0, 0, 0);
    
    const cuotaNormalized = new Date(fechaCuota);
    cuotaNormalized.setHours(0, 0, 0, 0);
    
    // Calculate day difference: (Fecha de Pago - Fecha de Cuota)
    const DAY_MS = 1000 * 60 * 60 * 24;
    const daysDiff = Math.round((pagoNormalized.getTime() - cuotaNormalized.getTime()) / DAY_MS);
    
    // Get month/year for comparison
    const pagoMonth = pagoNormalized.getMonth();
    const pagoYear = pagoNormalized.getFullYear();
    const cuotaMonth = cuotaNormalized.getMonth();
    const cuotaYear = cuotaNormalized.getFullYear();
    
    // ADELANTADO: Payment made at least 15 days before due date AND cuota month is after payment month
    if (daysDiff <= -15) {
      // Check if cuota month is after payment month
      if (cuotaYear > pagoYear || (cuotaYear === pagoYear && cuotaMonth > pagoMonth)) {
        return 1; // ADELANTADO (advanced)
      }
    }
    
    // ATRASADO: Payment made MORE than 2 days after due date
    if (daysDiff > 2) {
      return 3; // ATRASADO (late)
    }
    
    // A TIEMPO: Payment made within 2 days of due date or earlier (but not ADELANTADO)
    return 2; // A TIEMPO (on time)
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
        case 'status': {
          const aStatus = getStatusValue(a);
          const bStatus = getStatusValue(b);
          comparison = aStatus - bStatus;
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
            <th 
              onClick={() => handleSort('status')}
              className="text-left py-3 px-4 font-semibold text-sm cursor-pointer hover-elevate" 
              data-testid="header-status"
            >
              <div className="flex items-center gap-1">
                <span>STATUS</span>
                {sortColumn === 'status' ? (
                  sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                )}
              </div>
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
                  
                  // Normalize dates to midnight for proper date-only comparison (ignore time)
                  const pagoNormalized = new Date(fechaPago);
                  pagoNormalized.setHours(0, 0, 0, 0);
                  
                  const cuotaNormalized = new Date(fechaCuota);
                  cuotaNormalized.setHours(0, 0, 0, 0);
                  
                  // Calculate day difference: (Fecha de Pago - Fecha de Cuota)
                  const DAY_MS = 1000 * 60 * 60 * 24;
                  const daysDiff = Math.round((pagoNormalized.getTime() - cuotaNormalized.getTime()) / DAY_MS);
                  
                  // Get month/year for comparison
                  const pagoMonth = pagoNormalized.getMonth();
                  const pagoYear = pagoNormalized.getFullYear();
                  const cuotaMonth = cuotaNormalized.getMonth();
                  const cuotaYear = cuotaNormalized.getFullYear();
                  
                  let status: string;
                  let badgeClass: string;
                  
                  // ADELANTADO: Payment made at least 15 days before due date AND cuota month is after payment month
                  if (daysDiff <= -15) {
                    // Check if cuota month is after payment month
                    if (cuotaYear > pagoYear || (cuotaYear === pagoYear && cuotaMonth > pagoMonth)) {
                      status = 'ADELANTADO';
                      badgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
                    } else {
                      // Payment early but not meeting ADELANTADO criteria → A TIEMPO
                      status = 'A TIEMPO';
                      badgeClass = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
                    }
                  } else if (daysDiff > 2) {
                    // ATRASADO: Payment made MORE than 2 days after due date
                    status = 'ATRASADO';
                    badgeClass = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
                  } else {
                    // A TIEMPO: Payment made within 2 days of due date or earlier (but not ADELANTADO)
                    status = 'A TIEMPO';
                    badgeClass = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
                  }
                  
                  return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
                      {status}
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
