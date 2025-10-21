import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { FileUpload } from "@/components/FileUpload";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
        header: 1,
        defval: ""
      }) as any[][];

      if (jsonData.length === 0) {
        toast({
          title: "Error",
          description: "El archivo está vacío",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }

      const fileHeaders = jsonData[0] as string[];
      const rows = jsonData.slice(1).map(row => {
        const rowObj: any = {};
        fileHeaders.forEach((header, idx) => {
          rowObj[header] = row[idx];
        });
        return rowObj;
      });

      setHeaders(fileHeaders);
      setTableData(rows);
      
      toast({
        title: "Archivo procesado",
        description: `Se cargaron ${rows.length} registros correctamente`,
      });
    } catch (error) {
      console.error("Error processing file:", error);
      toast({
        title: "Error al procesar archivo",
        description: "No se pudo leer el archivo. Verifica que sea un archivo Excel válido.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    processFile(file);
  }, [processFile]);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setTableData([]);
    setHeaders([]);
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
          <div>
            <h2 className="text-2xl font-semibold mb-2">
              Carga de Archivo
            </h2>
            <p className="text-muted-foreground">
              Sube un archivo Excel con los datos de órdenes y cuotas de pago
            </p>
          </div>

          <FileUpload
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onClearFile={handleClearFile}
          />

          {isProcessing && (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-2 text-sm text-muted-foreground">Procesando archivo...</p>
            </div>
          )}

          {!isProcessing && tableData.length > 0 && (
            <div className="space-y-4">
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
            </div>
          )}

          {!isProcessing && !selectedFile && tableData.length === 0 && (
            <EmptyState />
          )}
        </div>
      </main>
    </div>
  );
}
