import { StatusBadge } from '../StatusBadge';

export default function StatusBadgeExample() {
  return (
    <div className="p-6 flex gap-3 flex-wrap">
      <StatusBadge status="Pagado" />
      <StatusBadge status="Pendiente" />
      <StatusBadge status="Vencido" />
      <StatusBadge status="" />
    </div>
  );
}
