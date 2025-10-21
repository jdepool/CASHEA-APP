import { useState, useEffect } from "react";
import { FileUpload } from "./FileUpload";
import { PaymentRecordsTable } from "./PaymentRecordsTable";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export function PaymentRecords() {
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  // Fetch persisted payment records on mount
  const { data: paymentRecordsData, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['/api/payment-records'],
    refetchOnWindowFocus: false,
  });

  // Load persisted data when query succeeds
  useEffect(() => {
    if (paymentRecordsData) {
      const data = paymentRecordsData as any;
      if (data.data) {
        setPaymentData(data.data.rows || []);
        setHeaders(data.data.headers || []);
        setFileName(data.data.fileName || "");
      }
    }
  }, [paymentRecordsData]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload-payment-records', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al cargar el archivo');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setPaymentData(data.data.rows || []);
      setHeaders(data.data.headers || []);
      setFileName(data.data.fileName || "");
      toast({
        title: "Archivo cargado exitosamente",
        description: `${data.data.rowCount} registros de pago importados`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al cargar el archivo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    uploadMutation.mutate(file);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
  };

  const handleInvalidFile = (message: string) => {
    toast({
      title: "Archivo inválido",
      description: message,
      variant: "destructive",
    });
  };

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

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {uploadMutation.isPending ? (
          <div className="flex items-center justify-center py-8 border-2 border-dashed rounded-md">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Procesando archivo...</p>
            </div>
          </div>
        ) : (
          <FileUpload 
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onClearFile={handleClearFile}
            onInvalidFile={handleInvalidFile}
          />
        )}
      </div>

      {paymentData.length > 0 && (
        <PaymentRecordsTable records={paymentData} headers={headers} />
      )}
    </div>
  );
}
