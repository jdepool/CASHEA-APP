import { useState, useCallback, useEffect } from "react";
import { FileUpload } from "@/components/FileUpload";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WeeklyPayments } from "@/components/WeeklyPayments";
import { PaymentRecords } from "@/components/PaymentRecords";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPaymentFile, setSelectedPaymentFile] = useState<File | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Fetch persisted orders on mount
  const { data: ordersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['/api/orders'],
    refetchOnWindowFocus: false,
  });

  // Load persisted data when query succeeds
  useEffect(() => {
    if (ordersData) {
      const data = ordersData as any;
      if (data.data) {
        setHeaders(data.data.headers || []);
        setTableData(data.data.rows || []);
      }
    }
  }, [ordersData]);

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload-excel', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al procesar el archivo');
      }

      if (result.success && result.data) {
        // Refetch to get the complete merged data
        const ordersResponse = await fetch('/api/orders');
        const ordersResult = await ordersResponse.json();
        
        if (ordersResult.success && ordersResult.data) {
          setHeaders(ordersResult.data.headers);
          setTableData(ordersResult.data.rows);
        }
        
        // Show merge statistics
        const mergeInfo = result.merge;
        if (mergeInfo) {
          toast({
            title: "Archivo procesado",
            description: mergeInfo.message,
          });
        } else {
          toast({
            title: "Archivo procesado",
            description: `Se cargaron ${result.data.rowCount} registros correctamente`,
          });
        }
      }
    } catch (error) {
      console.error("Error processing file:", error);
      toast({
        title: "Error al procesar archivo",
        description: error instanceof Error ? error.message : "No se pudo procesar el archivo",
        variant: "destructive"
      });
      setSelectedFile(null);
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    processFile(file);
  }, [processFile]);

  const handleInvalidFile = useCallback((message: string) => {
    toast({
      title: "Archivo no válido",
      description: message,
      variant: "destructive"
    });
  }, [toast]);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const handleExport = useCallback(() => {
    if (tableData.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(tableData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, `cuotas-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Exportado",
      description: "Los datos se han exportado correctamente",
    });
  }, [tableData, toast]);

  // Payment records upload mutation
  const uploadPaymentMutation = useMutation({
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
    onSuccess: async (data) => {
      // Refetch payment records query to update the PaymentRecords component
      await queryClient.refetchQueries({ queryKey: ['/api/payment-records'] });
      
      // Show merge statistics
      const mergeInfo = data.merge;
      if (mergeInfo) {
        toast({
          title: "Archivo de pagos cargado",
          description: mergeInfo.message,
        });
      } else {
        toast({
          title: "Archivo de pagos cargado",
          description: `${data.data.rowCount} registros de pago importados`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error al cargar el archivo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePaymentFileSelect = useCallback((file: File) => {
    setSelectedPaymentFile(file);
    uploadPaymentMutation.mutate(file);
  }, [uploadPaymentMutation]);

  const handleClearPaymentFile = useCallback(() => {
    setSelectedPaymentFile(null);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-7 w-7 text-primary" />
              <h1 className="text-xl font-semibold tracking-tight">
                Gestor de Cuotas
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {tableData.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  data-testid="button-export"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {isProcessing && (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-2 text-sm text-muted-foreground">Procesando archivo...</p>
            </div>
          )}

          {!isProcessing && (
            <Tabs defaultValue="upload" className="space-y-4">
              <TabsList data-testid="tabs-list">
                <TabsTrigger value="upload" data-testid="tab-upload">
                  CARGAR DATOS
                </TabsTrigger>
                <TabsTrigger value="all" data-testid="tab-all">
                  TODAS LAS ÓRDENES
                </TabsTrigger>
                <TabsTrigger value="payments" data-testid="tab-payments">
                  PAGO DE CUOTAS
                </TabsTrigger>
                <TabsTrigger value="weekly" data-testid="tab-weekly">
                  CUOTAS SEMANAL
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">
                    Cargar Archivos
                  </h2>
                  <p className="text-muted-foreground">
                    Selecciona los archivos Excel que deseas importar
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Orders Upload Section */}
                  <div className="space-y-4">
                    <div className="bg-card border rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileSpreadsheet className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">Órdenes y Cuotas</h3>
                          <p className="text-sm text-muted-foreground">
                            Archivo principal con datos de órdenes
                          </p>
                        </div>
                      </div>
                      <FileUpload
                        onFileSelect={handleFileSelect}
                        selectedFile={selectedFile}
                        onClearFile={handleClearFile}
                        onInvalidFile={handleInvalidFile}
                      />
                    </div>
                  </div>

                  {/* Payment Records Upload Section */}
                  <div className="space-y-4">
                    <div className="bg-card border rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Upload className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">Pago de Cuotas</h3>
                          <p className="text-sm text-muted-foreground">
                            Archivo de registros de pagos realizados
                          </p>
                        </div>
                      </div>
                      {uploadPaymentMutation.isPending ? (
                        <div className="flex items-center justify-center py-8 border-2 border-dashed rounded-lg">
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">Procesando archivo...</p>
                          </div>
                        </div>
                      ) : (
                        <FileUpload
                          onFileSelect={handlePaymentFileSelect}
                          selectedFile={selectedPaymentFile}
                          onClearFile={handleClearPaymentFile}
                          onInvalidFile={handleInvalidFile}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="all" className="space-y-4">
                {tableData.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">
                          Datos de Cuotas
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {tableData.length} {tableData.length === 1 ? 'registro' : 'registros'} encontrados
                        </p>
                      </div>
                    </div>
                    <DataTable data={tableData} headers={headers} />
                  </>
                ) : (
                  <div className="text-center py-12">
                    <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No hay datos de órdenes</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Carga un archivo desde la pestaña "CARGAR DATOS"
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="payments">
                <PaymentRecords />
              </TabsContent>

              <TabsContent value="weekly">
                {tableData.length > 0 ? (
                  <WeeklyPayments tableData={tableData} />
                ) : (
                  <div className="text-center py-12">
                    <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No hay datos de órdenes</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Carga un archivo desde la pestaña "CARGAR DATOS"
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
}
