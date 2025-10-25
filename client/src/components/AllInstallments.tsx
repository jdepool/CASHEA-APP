import { useMemo, useState } from "react";
import { WeeklyPaymentsTable } from "./WeeklyPaymentsTable";
import { InstallmentsDashboard } from "./InstallmentsDashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Filter, X } from "lucide-react";
import { extractInstallments, filterInstallmentsByDateRange } from "@/lib/installmentUtils";
import { parseExcelDate } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";

interface AllInstallmentsProps {
  tableData: any[];
}

export function AllInstallments({ tableData }: AllInstallmentsProps) {
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [ordenFilter, setOrdenFilter] = useState<string>("");

  // Fetch payment records to cross-reference
  const { data: paymentRecordsData } = useQuery({
    queryKey: ['/api/payment-records'],
    refetchOnWindowFocus: false,
  });

  // Extract all installments and enrich with payment dates
  const allInstallments = useMemo(() => {
    let installments = extractInstallments(tableData);

    // Cross-reference with payment records to add payment dates
    const apiData = paymentRecordsData as any;
    const hasPaymentData = apiData?.data?.rows && Array.isArray(apiData.data.rows) && apiData.data.rows.length > 0;
    
    if (hasPaymentData) {
      const paymentRows = apiData.data.rows;
      
      // Enrich all installments with payment dates from payment records
      installments = installments.map((installment) => {
        // Find matching payment record by order number (and optionally installment number)
        const matchingPayment = paymentRows.find((payment: any) => {
          const paymentOrder = String(payment['# Orden'] || payment['#Orden'] || payment['Orden'] || '').trim();
          const paymentInstallment = String(payment['# Cuota Pagada'] || payment['#CuotaPagada'] || payment['Cuota'] || '').trim();
          
          // Match by order number first
          const orderMatches = paymentOrder === String(installment.orden).trim();
          
          // If installment number exists in payment record, also match on that
          if (paymentInstallment) {
            return orderMatches && paymentInstallment === String(installment.numeroCuota).trim();
          }
          
          // Otherwise just match by order number
          return orderMatches;
        });

        if (matchingPayment) {
          // Get the exchange rate date (FECHA TASA DE CAMBIO)
          const fechaTasaCambio = matchingPayment['Fecha Tasa de Cambio'] || 
                                  matchingPayment['FECHA TASA DE CAMBIO'] ||
                                  matchingPayment['Fecha de Transaccion'] ||
                                  matchingPayment['FECHA DE TRANSACCION'] ||
                                  matchingPayment['Fecha Tasa Cambio'] ||
                                  matchingPayment['FechaTasaCambio'];
          
          if (fechaTasaCambio) {
            // Parse date using parseExcelDate to handle Excel serial numbers and date strings
            const parsedDate = parseExcelDate(fechaTasaCambio);
            
            if (parsedDate) {
              return { ...installment, fechaPagoReal: parsedDate };
            }
          }
        }
        
        return installment;
      });
    }

    return installments;
  }, [tableData, paymentRecordsData]);

  // Apply filters to installments
  const filteredInstallments = useMemo(() => {
    return allInstallments.filter((installment: any) => {
      // Date filter
      if (dateFrom || dateTo) {
        // Determine the effective date to use for filtering
        // Priority: fechaPagoReal (from payment records) > fechaPago (from order file) > fechaCuota (scheduled)
        const effectiveDate = installment.fechaPagoReal || installment.fechaPago || installment.fechaCuota;
        
        if (effectiveDate) {
          const installmentDate = typeof effectiveDate === 'string' ? parseExcelDate(effectiveDate) : effectiveDate;
          
          if (installmentDate) {
            // Normalize installment date to midnight for date-only comparison
            const normalizedInstallmentDate = new Date(installmentDate);
            normalizedInstallmentDate.setHours(0, 0, 0, 0);
            
            if (dateFrom) {
              const fromDate = new Date(dateFrom);
              fromDate.setHours(0, 0, 0, 0);
              if (normalizedInstallmentDate < fromDate) return false;
            }
            if (dateTo) {
              const toDate = new Date(dateTo);
              toDate.setHours(23, 59, 59, 999);
              if (normalizedInstallmentDate > toDate) return false;
            }
          }
        }
      }

      // Orden filter
      if (ordenFilter) {
        const ordenValue = String(installment.orden || '').toLowerCase();
        if (!ordenValue.includes(ordenFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [allInstallments, dateFrom, dateTo, ordenFilter]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setOrdenFilter("");
  };

  const hasActiveFilters = dateFrom || dateTo || ordenFilter;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Todas las Cuotas</h3>
            <p className="text-sm text-muted-foreground">
              Vista completa de cuotas programadas y pagadas
            </p>
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-installment-filters"
          >
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
          </Button>
        </div>

        {showFilters && (
          <div className="bg-muted/50 border rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="installment-date-from">Fecha Desde</Label>
                <Input
                  id="installment-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="Fecha desde"
                  data-testid="input-installment-date-from"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="installment-date-to">Fecha Hasta</Label>
                <Input
                  id="installment-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="Fecha hasta"
                  data-testid="input-installment-date-to"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="installment-orden-filter">Orden</Label>
                <Input
                  id="installment-orden-filter"
                  type="text"
                  value={ordenFilter}
                  onChange={(e) => setOrdenFilter(e.target.value)}
                  placeholder="Buscar orden..."
                  data-testid="input-installment-orden-filter"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  {filteredInstallments.length} de {allInstallments.length} cuotas
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  data-testid="button-clear-installment-filters"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
        )}

        <InstallmentsDashboard installments={filteredInstallments} />
      </div>

      <WeeklyPaymentsTable installments={filteredInstallments} />
    </div>
  );
}
