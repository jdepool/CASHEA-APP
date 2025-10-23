import { PaymentRecordsTable } from "./PaymentRecordsTable";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

export function PaymentRecords() {
  const { toast } = useToast();

  // Fetch persisted payment records
  const { data: paymentRecordsData, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['/api/payment-records'],
    refetchOnWindowFocus: false,
  });

  // Derive data directly from query result
  const data = paymentRecordsData as any;
  const paymentData = data?.data?.rows || [];
  const headers = data?.data?.headers || [];

  const handleExport = () => {
    if (paymentData.length === 0) {
      toast({
        title: "No hay datos para exportar",
        variant: "destructive",
      });
      return;
    }

    const ws = XLSX.utils.json_to_sheet(paymentData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagos");
    XLSX.writeFile(wb, `pagos_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Archivo exportado",
      description: "Los datos se han descargado exitosamente",
    });
  };

  if (isLoadingPayments) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="mt-2 text-sm text-muted-foreground">Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {paymentData.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Registros de Pago</h3>
              <p className="text-sm text-muted-foreground">
                {paymentData.length} {paymentData.length === 1 ? 'registro' : 'registros'} de pago
              </p>
            </div>
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
          <PaymentRecordsTable records={paymentData} headers={headers} />
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
