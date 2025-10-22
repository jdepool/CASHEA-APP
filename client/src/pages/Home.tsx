import { useState, useCallback, useEffect } from "react";
import { FileUpload } from "@/components/FileUpload";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WeeklyPayments } from "@/components/WeeklyPayments";
import { PaymentRecords } from "@/components/PaymentRecords";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
        setHeaders(result.data.headers);
        setTableData(result.data.rows);
        
        toast({
          title: "Archivo procesado",
          description: `Se cargaron ${result.data.rowCount} registros correctamente`,
        });
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
    // Only clear the selected file, NOT the persisted data from database
    // This prevents data from disappearing when user clears the file input
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
          {(selectedFile || tableData.length > 0) && (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Cargar nuevo archivo de órdenes:
                </p>
              </div>
              <div className="flex-1">
                <FileUpload
                  onFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                  onClearFile={handleClearFile}
                  onInvalidFile={handleInvalidFile}
                />
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-2 text-sm text-muted-foreground">Procesando archivo...</p>
            </div>
          )}

          {!isProcessing && tableData.length > 0 && (
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList data-testid="tabs-list">
                <TabsTrigger value="all" data-testid="tab-all">
                  TODAS LAS ÓRDENES
                </TabsTrigger>
                <TabsTrigger value="weekly" data-testid="tab-weekly">
                  CUOTAS SEMANAL
                </TabsTrigger>
                <TabsTrigger value="payments" data-testid="tab-payments">
                  PAGO DE CUOTAS
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4">
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
              </TabsContent>

              <TabsContent value="weekly">
                <WeeklyPayments tableData={tableData} />
              </TabsContent>

              <TabsContent value="payments">
                <PaymentRecords />
              </TabsContent>
            </Tabs>
          )}

          {!isProcessing && !selectedFile && tableData.length === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold mb-2">
                  Bienvenido al Gestor de Cuotas
                </h2>
                <p className="text-muted-foreground">
                  Selecciona qué tipo de archivo deseas cargar
                </p>
              </div>

              <Tabs defaultValue="payments" className="space-y-4">
                <TabsList data-testid="tabs-list-empty">
                  <TabsTrigger value="payments" data-testid="tab-payments-empty">
                    PAGO DE CUOTAS
                  </TabsTrigger>
                  <TabsTrigger value="orders" data-testid="tab-orders-empty">
                    ÓRDENES Y CUOTAS
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="payments">
                  <PaymentRecords />
                </TabsContent>

                <TabsContent value="orders">
                  <div className="space-y-4">
                    <div className="bg-muted/50 border rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-2">📦 Cargar Órdenes y Cuotas</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Carga aquí tu archivo Excel con los datos de órdenes de compra y sus cuotas programadas
                      </p>
                    </div>
                    <FileUpload
                      onFileSelect={handleFileSelect}
                      selectedFile={selectedFile}
                      onClearFile={handleClearFile}
                      onInvalidFile={handleInvalidFile}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
