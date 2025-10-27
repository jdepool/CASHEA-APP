import { useMemo, useState } from "react";
import { PaymentRecordsTable } from "./PaymentRecordsTable";
import { PaymentRecordsDashboard } from "./PaymentRecordsDashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, FileSpreadsheet, Filter } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { parseExcelDate, parseDDMMYYYY } from "@/lib/dateUtils";

interface PaymentRecordsProps {
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  dateFrom: string;
  setDateFrom: (date: string) => void;
  dateTo: string;
  setDateTo: (date: string) => void;
  ordenFilter: string;
  setOrdenFilter: (orden: string) => void;
  referenciaFilter: string;
  setReferenciaFilter: (referencia: string) => void;
}

export function PaymentRecords({
  showFilters,
  setShowFilters,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  ordenFilter,
  setOrdenFilter,
  referenciaFilter,
  setReferenciaFilter
}: PaymentRecordsProps) {
  const { toast } = useToast();

  // Fetch persisted payment records
  const { data: paymentRecordsData, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['/api/payment-records'],
    refetchOnWindowFocus: false,
  });

  // Fetch orders data to compare expected vs actual payment amounts
  const { data: ordersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['/api/orders'],
    refetchOnWindowFocus: false,
  });

  // Derive data directly from query result
  const data = paymentRecordsData as any;
  const rawPaymentData = data?.data?.rows || [];
  const headers = data?.data?.headers || [];

  // Extract orders data for comparing expected installment amounts
  const ordersTableData = (ordersData as any)?.data?.rows || [];

  // Sort payment data by transaction date (newest to oldest)
  const sortedPaymentData = useMemo(() => {
    if (!rawPaymentData.length || !headers.length) return rawPaymentData;

    // Find the transaction date header (case-insensitive, flexible matching)
    const transactionDateHeader = headers.find((h: string) => 
      h.toLowerCase().includes('fecha') && h.toLowerCase().includes('transac')
    );

    if (!transactionDateHeader) return rawPaymentData;

    // Sort by transaction date in descending order (newest first)
    return [...rawPaymentData].sort((a, b) => {
      const dateA = parseExcelDate(a[transactionDateHeader]);
      const dateB = parseExcelDate(b[transactionDateHeader]);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateB.getTime() - dateA.getTime();
    });
  }, [rawPaymentData, headers]);

  // Apply filters
  const paymentData = useMemo(() => {
    return sortedPaymentData.filter((row: any) => {
      // Date filter
      if (dateFrom || dateTo) {
        const transactionDateHeader = headers.find((h: string) => 
          h.toLowerCase().includes('fecha') && h.toLowerCase().includes('transac')
        );
        
        if (transactionDateHeader) {
          const rowDate = parseExcelDate(row[transactionDateHeader]);
          if (rowDate) {
            if (dateFrom) {
              const fromDate = parseDDMMYYYY(dateFrom);
              if (fromDate) {
                fromDate.setHours(0, 0, 0, 0);
                if (rowDate < fromDate) return false;
              }
            }
            if (dateTo) {
              const toDate = parseDDMMYYYY(dateTo);
              if (toDate) {
                toDate.setHours(23, 59, 59, 999);
                if (rowDate > toDate) return false;
              }
            }
          }
        }
      }

      // Orden filter
      if (ordenFilter) {
        const ordenHeader = headers.find((h: string) => 
          h.toLowerCase().includes('orden') && !h.toLowerCase().includes('cuota')
        );
        if (ordenHeader) {
          const ordenValue = String(row[ordenHeader] || '').toLowerCase();
          if (!ordenValue.includes(ordenFilter.toLowerCase())) return false;
        }
      }

      // Referencia filter
      if (referenciaFilter) {
        const referenciaHeader = headers.find((h: string) => 
          h.toLowerCase().includes('referencia')
        );
        if (referenciaHeader) {
          const referenciaValue = String(row[referenciaHeader] || '').toLowerCase();
          if (!referenciaValue.includes(referenciaFilter.toLowerCase())) return false;
        }
      }

      return true;
    });
  }, [sortedPaymentData, headers, dateFrom, dateTo, ordenFilter, referenciaFilter]);

  const handleExport = () => {
    if (paymentData.length === 0) {
      toast({
        title: "No hay datos para exportar",
        variant: "destructive",
      });
      return;
    }

    // Format data for export - convert all date fields to readable format
    const exportData = paymentData.map((row: any) => {
      const formattedRow = { ...row };
      
      // Convert all date fields using parseExcelDate utility
      headers.forEach((header: string) => {
        if (header.toLowerCase().includes('fecha') && formattedRow[header]) {
          const parsedDate = parseExcelDate(formattedRow[header]);
          if (parsedDate) {
            formattedRow[header] = parsedDate.toLocaleDateString('es-ES');
          }
        }
      });
      
      return formattedRow;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagos");
    XLSX.writeFile(wb, `pagos_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Archivo exportado",
      description: "Los datos se han descargado exitosamente",
    });
  };

  if (isLoadingPayments || isLoadingOrders) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="mt-2 text-sm text-muted-foreground">Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedPaymentData.length > 0 ? (
        <>
          <PaymentRecordsDashboard data={paymentData} headers={headers} />
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Registros de Pago</h3>
              <p className="text-sm text-muted-foreground">
                {paymentData.length} de {sortedPaymentData.length} {paymentData.length === 1 ? 'registro' : 'registros'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-toggle-payment-filters"
              >
                <Filter className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                data-testid="button-export-payments"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="bg-card border rounded-lg p-6 space-y-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment-date-from">Fecha Desde</Label>
                  <DatePicker
                    id="payment-date-from"
                    value={dateFrom}
                    onChange={setDateFrom}
                    data-testid="input-payment-date-from"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="payment-date-to">Fecha Hasta</Label>
                  <DatePicker
                    id="payment-date-to"
                    value={dateTo}
                    onChange={setDateTo}
                    data-testid="input-payment-date-to"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="payment-orden-filter">Orden</Label>
                  <Input
                    id="payment-orden-filter"
                    type="text"
                    placeholder="Buscar orden..."
                    value={ordenFilter}
                    onChange={(e) => setOrdenFilter(e.target.value)}
                    className="w-full"
                    data-testid="input-payment-orden-filter"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="payment-referencia-filter"># Referencia</Label>
                  <Input
                    id="payment-referencia-filter"
                    type="text"
                    placeholder="Buscar referencia..."
                    value={referenciaFilter}
                    onChange={(e) => setReferenciaFilter(e.target.value)}
                    className="w-full"
                    data-testid="input-payment-referencia-filter"
                  />
                </div>
              </div>
              
              {(dateFrom || dateTo || ordenFilter || referenciaFilter) && (
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setOrdenFilter("");
                      setReferenciaFilter("");
                    }}
                    data-testid="button-clear-payment-filters"
                  >
                    Limpiar filtros
                  </Button>
                </div>
              )}
            </div>
          )}

          <PaymentRecordsTable records={paymentData} headers={headers} ordersData={ordersTableData} />
        </>
      ) : (
        <div className="text-center py-12">
          <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay registros de pago</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Carga un archivo de pagos desde la pestaña "CARGAR DATOS"
          </p>
        </div>
      )}
    </div>
  );
}
