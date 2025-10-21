import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClearFile: () => void;
  onInvalidFile?: (message: string) => void;
}

export function FileUpload({ onFileSelect, selectedFile, onClearFile, onInvalidFile }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = useCallback((file: File): boolean => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      onInvalidFile?.('Por favor, selecciona un archivo Excel (.xlsx o .xls)');
      return false;
    }
    
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      onInvalidFile?.('El archivo es demasiado grande. Tamaño máximo: 10MB');
      return false;
    }
    
    return true;
  }, [onInvalidFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect, validateFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
    e.target.value = '';
  }, [onFileSelect, validateFile]);

  if (selectedFile) {
    return (
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <div>
            <p className="font-medium text-sm" data-testid="text-filename">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(2)} KB
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearFile}
          data-testid="button-clear-file"
        >
          <X className="h-4 w-4" />
        </Button>
      </Card>
    );
  }

  return (
    <Card
      className={`border-2 border-dashed transition-colors ${
        isDragging ? "border-primary bg-accent" : "border-border"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <label
        htmlFor="file-upload"
        className="cursor-pointer block p-12 text-center"
        data-testid="label-upload-zone"
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-2">
          Arrastra tu archivo Excel aquí
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          o haz clic para seleccionar
        </p>
        <p className="text-xs text-muted-foreground">
          Formatos soportados: .xlsx, .xls
        </p>
        <input
          id="file-upload"
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileInput}
          className="hidden"
          data-testid="input-file"
        />
      </label>
    </Card>
  );
}
