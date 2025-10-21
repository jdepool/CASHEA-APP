import { DataTable } from '../DataTable';

export default function DataTableExample() {
  const headers = [
    "Orden",
    "Nombre del comprador",
    "Venta total",
    "Fecha de compra",
    "Estado cuota 1",
    "Cuota 1",
    "Pagado de cuota 1"
  ];

  const data = [
    {
      "Orden": "ORD-001",
      "Nombre del comprador": "Juan Pérez",
      "Venta total": 5000,
      "Fecha de compra": "2024-01-15",
      "Estado cuota 1": "Pagado",
      "Cuota 1": 500,
      "Pagado de cuota 1": 500
    },
    {
      "Orden": "ORD-002",
      "Nombre del comprador": "María García",
      "Venta total": 3000,
      "Fecha de compra": "2024-02-20",
      "Estado cuota 1": "Pendiente",
      "Cuota 1": 300,
      "Pagado de cuota 1": 0
    }
  ];

  return (
    <div className="p-6">
      <DataTable data={data} headers={headers} />
    </div>
  );
}
