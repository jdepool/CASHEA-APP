import { useState, useCallback, useEffect, useMemo } from "react";
import { FileUpload } from "@/components/FileUpload";
import { DataTable } from "@/components/DataTable";
import { Dashboard } from "@/components/Dashboard";
import { EmptyState } from "@/components/EmptyState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AllInstallments } from "@/components/AllInstallments";
import { PaymentRecords } from "@/components/PaymentRecords";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Upload, Filter, CheckCircle2 } from "lucide-react";
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
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [ordenFilter, setOrdenFilter] = useState<string>("");
  const [referenciaFilter, setReferenciaFilter] = useState<string>("");
  const [estadoCuotaFilter, setEstadoCuotaFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [hideFullyPaid, setHideFullyPaid] = useState<boolean>(false);
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

  // Filter logic for TODAS LAS ORDENES tab
  const filteredTableData = useMemo(() => {
    if (!tableData || tableData.length === 0) return [];

    return tableData.filter((row) => {
      // Hide fully paid orders filter
      if (hideFullyPaid) {
        const ventaTotal = parseFloat(row["Venta total"] || 0);
        const pagoInicial = parseFloat(row["PAGO INICIAL"] || 0);
        let totalPagado = isNaN(pagoInicial) ? 0 : pagoInicial;
        
        // Sum all installment payments
        for (let i = 1; i <= 14; i++) {
          const pagadoCuota = parseFloat(row[`Pagado de cuota ${i}`] || 0);
          if (!isNaN(pagadoCuota)) {
            totalPagado += pagadoCuota;
          }
        }
        
        const saldo = ventaTotal - totalPagado;
        // Hide if fully paid (saldo <= $0.01)
        if (saldo <= 0.01) {
          return false;
        }
      }

      // Date range filter
      if (dateFrom || dateTo) {
        const fechaCompraHeader = headers.find(h => h.toLowerCase().includes('fecha de compra'));
        if (fechaCompraHeader) {
          const fechaValue = row[fechaCompraHeader];
          let rowDate: Date | null = null;
          
          if (typeof fechaValue === 'number') {
            const utcDays = Math.floor(fechaValue - 25569);
            const utcValue = utcDays * 86400;
            rowDate = new Date(utcValue * 1000);
          } else if (fechaValue) {
            rowDate = new Date(fechaValue);
          }

          if (rowDate && !isNaN(rowDate.getTime())) {
            if (dateFrom) {
              const fromDate = new Date(dateFrom);
              if (rowDate < fromDate) return false;
            }
            if (dateTo) {
              const toDate = new Date(dateTo);
              toDate.setHours(23, 59, 59, 999);
              if (rowDate > toDate) return false;
            }
          }
        }
      }

      // Orden filter
      if (ordenFilter) {
        const ordenHeader = headers.find(h => h.toLowerCase() === 'orden');
        if (ordenHeader) {
          const ordenValue = String(row[ordenHeader] || '').toLowerCase();
          if (!ordenValue.includes(ordenFilter.toLowerCase())) return false;
        }
      }

      // Referencia filter
      if (referenciaFilter) {
        const referenciaHeader = headers.find(h => h.toLowerCase().includes('referencia'));
        if (referenciaHeader) {
          const referenciaValue = String(row[referenciaHeader] || '').toLowerCase();
          if (!referenciaValue.includes(referenciaFilter.toLowerCase())) return false;
        }
      }

      // Estado Cuota filter
      if (estadoCuotaFilter && estadoCuotaFilter !== 'all') {
        const estadoHeaders = headers.filter(h => h.toLowerCase().includes('estado cuota'));
        if (estadoHeaders.length > 0) {
          const hasMatchingStatus = estadoHeaders.some(header => {
            const estadoValue = String(row[header] || '').toLowerCase();
            return estadoValue === estadoCuotaFilter.toLowerCase();
          });
          if (!hasMatchingStatus) return false;
        }
      }

      return true;
    });
  }, [tableData, headers, dateFrom, dateTo, ordenFilter, referenciaFilter, estadoCuotaFilter, hideFullyPaid]);

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
                  CONCILIACION DE CUOTAS
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
                        inputId="file-upload-orders"
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
                          inputId="file-upload-payments"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="all" className="space-y-4">
                {tableData.length > 0 ? (
                  <>
                    <Dashboard data={filteredTableData} headers={headers} />
                    
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">
                          Datos de Cuotas
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {filteredTableData.length} de {tableData.length} {filteredTableData.length === 1 ? 'registro' : 'registros'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={hideFullyPaid ? "default" : "outline"}
                          size="sm"
                          onClick={() => setHideFullyPaid(!hideFullyPaid)}
                          data-testid="button-hide-fully-paid"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {hideFullyPaid ? "Mostrar todas" : "Solo activas"}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowFilters(!showFilters)}
                          data-testid="button-toggle-filters"
                        >
                          <Filter className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {showFilters && (
                      <div className="bg-card border rounded-lg p-6 space-y-4 mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="date-from">Fecha Desde</Label>
                            <Input
                              id="date-from"
                              type="date"
                              value={dateFrom}
                              onChange={(e) => setDateFrom(e.target.value)}
                              className="w-full"
                              data-testid="input-date-from"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="date-to">Fecha Hasta</Label>
                            <Input
                              id="date-to"
                              type="date"
                              value={dateTo}
                              onChange={(e) => setDateTo(e.target.value)}
                              className="w-full"
                              data-testid="input-date-to"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="orden-filter">Orden</Label>
                            <Input
                              id="orden-filter"
                              type="text"
                              placeholder="Buscar orden..."
                              value={ordenFilter}
                              onChange={(e) => setOrdenFilter(e.target.value)}
                              className="w-full"
                              data-testid="input-orden-filter"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="referencia-filter">Referencia</Label>
                            <Input
                              id="referencia-filter"
                              type="text"
                              placeholder="Buscar referencia..."
                              value={referenciaFilter}
                              onChange={(e) => setReferenciaFilter(e.target.value)}
                              className="w-full"
                              data-testid="input-referencia-filter"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="estado-filter">Estado Cuota</Label>
                            <Select value={estadoCuotaFilter} onValueChange={setEstadoCuotaFilter}>
                              <SelectTrigger id="estado-filter" className="w-full" data-testid="select-estado-filter">
                                <SelectValue placeholder="Todos los estados" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                                <SelectItem value="pendiente">Pendiente</SelectItem>
                                <SelectItem value="vencido">Vencido</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        {(dateFrom || dateTo || ordenFilter || referenciaFilter || (estadoCuotaFilter && estadoCuotaFilter !== 'all')) && (
                          <div className="flex justify-end pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDateFrom("");
                                setDateTo("");
                                setOrdenFilter("");
                                setReferenciaFilter("");
                                setEstadoCuotaFilter("all");
                              }}
                              data-testid="button-clear-filters"
                            >
                              Limpiar filtros
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    <DataTable data={filteredTableData} headers={headers} />
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
                  <AllInstallments tableData={tableData} />
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
