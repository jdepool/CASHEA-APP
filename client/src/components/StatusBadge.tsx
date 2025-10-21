import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalizedStatus = status?.toLowerCase().trim() || "";
  
  let variant: "default" | "secondary" | "outline" | "destructive" = "secondary";
  let displayText = status || "-";
  
  if (normalizedStatus.includes("pagado") || normalizedStatus.includes("completado")) {
    variant = "default";
    displayText = "Pagado";
  } else if (normalizedStatus.includes("pendiente") || normalizedStatus.includes("pend")) {
    variant = "outline";
    displayText = "Pendiente";
  } else if (normalizedStatus.includes("vencido") || normalizedStatus.includes("atrasado")) {
    variant = "destructive";
    displayText = "Vencido";
  }

  return (
    <Badge 
      variant={variant}
      className={
        variant === "default" 
          ? "bg-chart-2 text-white hover:bg-chart-2" 
          : variant === "destructive"
          ? "bg-destructive text-destructive-foreground"
          : ""
      }
      data-testid={`badge-status-${displayText.toLowerCase()}`}
    >
      {displayText}
    </Badge>
  );
}
