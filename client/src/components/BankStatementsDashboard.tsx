import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { normalizeNumber } from "@shared/numberUtils";

interface BankStatementsDashboardProps {
  statements: any[];
  headers: string[];
}

export function BankStatementsDashboard({ statements, headers }: BankStatementsDashboardProps) {
  const metrics = useMemo(() => {
    // Find column names (case-insensitive search)
    const saldoHeader = headers.find((h: string) => h.toLowerCase().includes('saldo'));
    const debeHeader = headers.find((h: string) => h.toLowerCase() === 'debe');
    const haberHeader = headers.find((h: string) => h.toLowerCase() === 'haber');

    if (!saldoHeader || !debeHeader || !haberHeader || statements.length === 0) {
      return {
        saldoInicial: 0,
        debe: 0,
        haber: 0,
        saldoFinal: 0,
      };
    }

    // Get first row values
    const firstRow = statements[0];
    const firstSaldo = normalizeNumber(firstRow[saldoHeader]);
    const firstDebe = normalizeNumber(firstRow[debeHeader]);
    const firstHaber = normalizeNumber(firstRow[haberHeader]);

    // Calculate SALDO INICIAL = First Saldo - First Haber + First Debe
    const saldoInicial = firstSaldo - firstHaber + firstDebe;

    // Sum all Debe and Haber columns
    let totalDebe = 0;
    let totalHaber = 0;

    statements.forEach((row: any) => {
      const debeValue = normalizeNumber(row[debeHeader]);
      const haberValue = normalizeNumber(row[haberHeader]);
      
      totalDebe += debeValue;
      totalHaber += haberValue;
    });

    // Calculate SALDO FINAL = SALDO INICIAL - DEBE + HABER
    const saldoFinal = saldoInicial - totalDebe + totalHaber;

    return {
      saldoInicial,
      debe: totalDebe,
      haber: totalHaber,
      saldoFinal,
    };
  }, [statements, headers]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Saldo Inicial</p>
              <p className="text-3xl font-bold" data-testid="metric-saldo-inicial">
                {formatCurrency(metrics.saldoInicial)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Debe</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400" data-testid="metric-debe">
                {formatCurrency(metrics.debe)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Haber</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="metric-haber">
                {formatCurrency(metrics.haber)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Saldo Final</p>
              <p className="text-3xl font-bold" data-testid="metric-saldo-final">
                {formatCurrency(metrics.saldoFinal)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
