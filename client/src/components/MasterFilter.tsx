import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MasterFilterProps {
  dateFrom: string;
  dateTo: string;
  orden: string;
  tienda: string;
  uniqueTiendas: string[];
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onOrdenChange: (value: string) => void;
  onTiendaChange: (value: string) => void;
  onClearFilters: () => void;
}

export function MasterFilter({
  dateFrom,
  dateTo,
  orden,
  tienda,
  uniqueTiendas,
  onDateFromChange,
  onDateToChange,
  onOrdenChange,
  onTiendaChange,
  onClearFilters
}: MasterFilterProps) {
  const hasActiveFilters = dateFrom || dateTo || orden || (tienda && tienda !== "all");

  return (
    <Card className="p-4 mb-4 border-primary/20">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-primary">Filtro Master</span>
          {hasActiveFilters && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              Activo
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4 flex-1 flex-wrap">
          <div className="flex items-center gap-2">
            <Label htmlFor="master-date-from" className="text-xs whitespace-nowrap">
              Desde:
            </Label>
            <div className="w-36">
              <DatePicker
                id="master-date-from"
                value={dateFrom}
                onChange={onDateFromChange}
                data-testid="master-date-from"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="master-date-to" className="text-xs whitespace-nowrap">
              Hasta:
            </Label>
            <div className="w-36">
              <DatePicker
                id="master-date-to"
                value={dateTo}
                onChange={onDateToChange}
                data-testid="master-date-to"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="master-orden" className="text-xs whitespace-nowrap">
              Orden:
            </Label>
            <Input
              id="master-orden"
              type="text"
              placeholder="Filtrar por orden..."
              value={orden}
              onChange={(e) => onOrdenChange(e.target.value)}
              className="w-48"
              data-testid="master-orden-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="master-tienda" className="text-xs whitespace-nowrap">
              Tienda:
            </Label>
            <Select value={tienda} onValueChange={onTiendaChange}>
              <SelectTrigger id="master-tienda" className="w-48" data-testid="master-tienda-select">
                <SelectValue placeholder="Todas las tiendas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las tiendas</SelectItem>
                {uniqueTiendas.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="ml-auto"
            data-testid="clear-master-filters"
          >
            <X className="h-4 w-4 mr-1" />
            Limpiar filtros
          </Button>
        )}
      </div>
    </Card>
  );
}
