import { FileSpreadsheet } from "lucide-react";

export function EmptyState() {
  return (
    <div className="text-center py-16" data-testid="empty-state">
      <FileSpreadsheet className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">No hay archivo cargado</h3>
      <p className="text-muted-foreground">
        Sube un archivo Excel para visualizar los datos de cuotas
      </p>
    </div>
  );
}
