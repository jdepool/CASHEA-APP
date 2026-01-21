import { useState, useCallback, useEffect, useMemo, lazy, Suspense, useTransition, useDeferredValue, useRef } from "react";
import { FileUpload } from "@/components/FileUpload";
import { EmptyState } from "@/components/EmptyState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MasterFilter } from "@/components/MasterFilter";

// Lazy-loaded heavy components for faster initial page load
const DataTable = lazy(() => import("@/components/DataTable").then(m => ({ default: m.DataTable })));
const Dashboard = lazy(() => import("@/components/Dashboard").then(m => ({ default: m.Dashboard })));
const AllInstallments = lazy(() => import("@/components/AllInstallments").then(m => ({ default: m.AllInstallments })));
const AllPagosInstallments = lazy(() => import("@/components/AllPagosInstallments").then(m => ({ default: m.AllPagosInstallments })));
const ConciliacionPagosTable = lazy(() => import("@/components/ConciliacionPagosTable").then(m => ({ default: m.ConciliacionPagosTable })));
const PaymentRecords = lazy(() => import("@/components/PaymentRecords").then(m => ({ default: m.PaymentRecords })));
const MarketplaceOrdersTable = lazy(() => import("@/components/MarketplaceOrdersTable").then(m => ({ default: m.MarketplaceOrdersTable })));
const CuotasTable = lazy(() => import("@/components/CuotasTable").then(m => ({ default: m.CuotasTable })));
const MonthlyReport = lazy(() => import("@/components/MonthlyReport").then(m => ({ default: m.MonthlyReport })));
const BankStatementsTable = lazy(() => import("@/components/BankStatementsTable").then(m => ({ default: m.BankStatementsTable })));
const AIAssistant = lazy(() => import("@/components/AIAssistant").then(m => ({ default: m.AIAssistant })));
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Download, FileSpreadsheet, Upload, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { parseExcelDate, parseDDMMYYYY } from "@/lib/dateUtils";
import { extractInstallments, calculateInstallmentStatus } from "@/lib/installmentUtils";
import { verifyInPaymentRecords, findMatchingPaymentRecord } from "@/lib/verificationUtils";
import { generateDataHash, shouldUpdateStatuses, updateTimeBasedStatuses, getCacheMetadata, invalidateCacheWithNewHash, saveCacheWithHash } from "@/lib/cacheUtils";

// Loading fallback for lazy-loaded tab components
const TabLoader = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="ml-2 text-muted-foreground">Cargando...</span>
  </div>
);

// Type for cached installment data (uses 'any' for compatibility with existing Installment type)
interface ProcessedInstallment {
  orden: string;
  numeroCuota: number;
  monto?: number | null;
  fechaCuota?: Date | string | null;
  fechaPagoReal?: Date | string | null;
  estadoCuota?: string;
  status?: string;
  isPaymentBased?: boolean;
  tienda?: string | null;
  paymentDetails?: {
    referencia?: string;
    metodoPago?: string;
    montoPagadoUSD?: number;
    montoPagadoVES?: number;
    tasaCambio?: number;
  };
  verificacion?: string;
  scheduledAmount?: number;
}

// Type for cached bank statement data
interface ProcessedBankStatement {
  [key: string]: any;
  CONCILIADO?: string;
}

// Type for cached data state
interface CachedDataState {
  installments: {
    scheduleInstallments: ProcessedInstallment[];
    paymentInstallments: ProcessedInstallment[];
  };
  bankStatements: {
    headers: string[];
    rows: ProcessedBankStatement[];
    extendedHeaders: string[];
  };
  ordenTiendaMap: Map<string, string>;
  uniqueTiendas: string[];
  lastCalculated: Date | null;
  isLoading: boolean;
  isRecalculating: boolean;
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPaymentFile, setSelectedPaymentFile] = useState<File | null>(null);
  const [selectedMarketplaceFile, setSelectedMarketplaceFile] = useState<File | null>(null);
  const [selectedBankFile, setSelectedBankFile] = useState<File | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Cached data state - uses database cache instead of useMemo calculations
  const [cachedData, setCachedData] = useState<CachedDataState>({
    installments: { scheduleInstallments: [], paymentInstallments: [] },
    bankStatements: { headers: [], rows: [], extendedHeaders: [] },
    ordenTiendaMap: new Map(),
    uniqueTiendas: [],
    lastCalculated: null,
    isLoading: true,
    isRecalculating: false
  });
  
  // Master filter state (applies across all tabs)
  const [masterDateFrom, setMasterDateFrom] = useState<string>("");
  const [masterDateTo, setMasterDateTo] = useState<string>("");
  const [masterOrden, setMasterOrden] = useState<string>("");
  const [masterTienda, setMasterTienda] = useState<string>("all");
  
  // TODAS LAS ORDENES tab filters
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [ordenFilter, setOrdenFilter] = useState<string>("");
  const [referenciaFilter, setReferenciaFilter] = useState<string>("");
  const [estadoCuotaFilter, setEstadoCuotaFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
  // CONCILIACION DE CUOTAS tab filters
  const [installmentsShowFilters, setInstallmentsShowFilters] = useState<boolean>(false);
  const [installmentsDateFrom, setInstallmentsDateFrom] = useState<string>("");
  const [installmentsDateTo, setInstallmentsDateTo] = useState<string>("");
  const [installmentsOrdenFilter, setInstallmentsOrdenFilter] = useState<string>("");
  const [installmentsEstadoCuotaFilter, setInstallmentsEstadoCuotaFilter] = useState<string>("all");
  const [installmentsDateFieldFilter, setInstallmentsDateFieldFilter] = useState<string>("fechaCuota");
  const [filteredInstallmentsData, setFilteredInstallmentsData] = useState<any[]>([]);
  const [filteredPagosInstallmentsData, setFilteredPagosInstallmentsData] = useState<any[]>([]);
  const [filteredPagosMasterOnlyData, setFilteredPagosMasterOnlyData] = useState<any[]>([]);
  
  // CONCILIACION DE PAGOS tab filters
  const [pagosShowFilters, setPagosShowFilters] = useState<boolean>(false);
  const [pagosDateFrom, setPagosDateFrom] = useState<string>("");
  const [pagosDateTo, setPagosDateTo] = useState<string>("");
  const [pagosOrdenFilter, setPagosOrdenFilter] = useState<string>("");
  const [pagosEstadoCuotaFilter, setPagosEstadoCuotaFilter] = useState<string>("all");
  
  // PAGO DE CUOTAS tab filters
  const [paymentsShowFilters, setPaymentsShowFilters] = useState<boolean>(false);
  const [paymentsDateFrom, setPaymentsDateFrom] = useState<string>("");
  const [paymentsDateTo, setPaymentsDateTo] = useState<string>("");
  const [paymentsOrdenFilter, setPaymentsOrdenFilter] = useState<string>("");
  const [paymentsReferenciaFilter, setPaymentsReferenciaFilter] = useState<string>("");
  
  // CUOTAS tab filters
  const [cuotasShowFilters, setCuotasShowFilters] = useState<boolean>(false);
  const [cuotasDateFrom, setCuotasDateFrom] = useState<string>("");
  const [cuotasDateTo, setCuotasDateTo] = useState<string>("");
  const [cuotasOrdenFilter, setCuotasOrdenFilter] = useState<string>("");
  const [cuotasEstadoFilter, setCuotasEstadoFilter] = useState<string>("all");
  
  // MARKETPLACE ORDERS tab filters
  const [marketplaceShowFilters, setMarketplaceShowFilters] = useState<boolean>(false);
  const [marketplaceDateFrom, setMarketplaceDateFrom] = useState<string>("");
  const [marketplaceDateTo, setMarketplaceDateTo] = useState<string>("");
  const [marketplaceEstadoFilter, setMarketplaceEstadoFilter] = useState<string>("all");
  const [marketplaceOrdenFilter, setMarketplaceOrdenFilter] = useState<string>("");
  const [marketplaceEstadoEntregaFilter, setMarketplaceEstadoEntregaFilter] = useState<string>("all");
  const [marketplaceReferenciaFilter, setMarketplaceReferenciaFilter] = useState<string>("");
  
  // Tab state with transition for lazy-loaded components
  const [activeTab, setActiveTab] = useState<string>("upload");
  const [isPending, startTransition] = useTransition();
  
  const handleTabChange = useCallback((value: string) => {
    startTransition(() => {
      setActiveTab(value);
    });
  }, []);
  
  const { toast } = useToast();

  // Fetch persisted orders on mount
  const { data: ordersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['/api/orders'],
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // Fetch persisted marketplace orders on mount
  const { data: marketplaceData, isLoading: isLoadingMarketplace } = useQuery({
    queryKey: ['/api/marketplace-orders'],
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // Fetch payment records for MonthlyReport calculations
  const { data: paymentRecordsData } = useQuery({
    queryKey: ['/api/payment-records'],
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // Fetch bank statements for MonthlyReport calculations
  const { data: bankStatementsData } = useQuery({
    queryKey: ['/api/bank-statements'],
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // Query hooks for loading cached data from database
  const { data: cachedInstallments, isLoading: isLoadingCachedInstallments } = useQuery({
    queryKey: ['/api/cache/installments'],
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const { data: cachedOrdenMap, isLoading: isLoadingCachedOrdenMap } = useQuery({
    queryKey: ['/api/cache/orden-tienda-map'],
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const { data: cachedBankStatements, isLoading: isLoadingCachedBankStatements } = useQuery({
    queryKey: ['/api/cache/bank-statements'],
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  // Helper function to deduplicate orders by order number (keeps last occurrence)
  const deduplicateOrders = useCallback((rows: any[], headers: string[]) => {
    const ordenHeader = headers.find((h: string) => h.toLowerCase() === 'orden');
    if (!ordenHeader) return rows;
    
    const ordersMap = new Map<string, any>();
    const rowsWithoutOrden: any[] = [];
    
    rows.forEach((row: any) => {
      const ordenValue = String(row[ordenHeader] || '').trim();
      if (!ordenValue) {
        rowsWithoutOrden.push(row); // Keep rows without order number
      } else {
        ordersMap.set(ordenValue, row); // Overwrites previous, keeping last occurrence
      }
    });
    
    return [...Array.from(ordersMap.values()), ...rowsWithoutOrden];
  }, []);

  // Load persisted data when query succeeds
  useEffect(() => {
    if (ordersData) {
      const data = ordersData as any;
      if (data.data) {
        const headers = data.data.headers || [];
        const rows = data.data.rows || [];
        
        // Deduplicate orders by order number before setting state
        const deduplicatedRows = deduplicateOrders(rows, headers);
        
        setHeaders(headers);
        setTableData(deduplicatedRows);
      }
    }
  }, [ordersData]);

  // Load cached installments from database on mount
  useEffect(() => {
    if (cachedInstallments && !isLoadingCachedInstallments) {
      const data = cachedInstallments as any;
      if (data.success && data.data && data.data.length > 0) {
        console.log(`Loaded ${data.data.length} cached installments from database`);
        
        // Separate schedule-based and payment-based installments
        const scheduleInstallments = data.data
          .filter((inst: any) => !inst.isPaymentBased)
          .map((inst: any) => ({
            ...inst,
            monto: inst.monto ? parseFloat(inst.monto) : null,
            fechaCuota: inst.fechaCuota ? new Date(inst.fechaCuota) : null,
            fechaPagoReal: inst.fechaPagoReal ? new Date(inst.fechaPagoReal) : null,
            paymentDetails: inst.paymentReferencia ? {
              referencia: inst.paymentReferencia,
              metodoPago: inst.paymentMetodo,
              montoPagadoUSD: inst.paymentMontoUSD ? parseFloat(inst.paymentMontoUSD) : undefined,
              montoPagadoVES: inst.paymentMontoVES ? parseFloat(inst.paymentMontoVES) : undefined,
              tasaCambio: inst.paymentTasaCambio ? parseFloat(inst.paymentTasaCambio) : undefined,
            } : undefined
          }));
        
        const paymentInstallments = data.data
          .filter((inst: any) => inst.isPaymentBased)
          .map((inst: any) => ({
            ...inst,
            monto: inst.monto ? parseFloat(inst.monto) : null,
            fechaCuota: inst.fechaCuota ? new Date(inst.fechaCuota) : null,
            fechaPagoReal: inst.fechaPagoReal ? new Date(inst.fechaPagoReal) : null,
            paymentDetails: inst.paymentReferencia ? {
              referencia: inst.paymentReferencia,
              metodoPago: inst.paymentMetodo,
              montoPagadoUSD: inst.paymentMontoUSD ? parseFloat(inst.paymentMontoUSD) : undefined,
              montoPagadoVES: inst.paymentMontoVES ? parseFloat(inst.paymentMontoVES) : undefined,
              tasaCambio: inst.paymentTasaCambio ? parseFloat(inst.paymentTasaCambio) : undefined,
            } : undefined
          }));

        setCachedData(prev => ({
          ...prev,
          installments: { scheduleInstallments, paymentInstallments },
          isLoading: false
        }));
      } else {
        // No cached data, mark as not loading so calculation can proceed
        setCachedData(prev => ({ ...prev, isLoading: false }));
      }
    }
  }, [cachedInstallments, isLoadingCachedInstallments]);

  // Load cached orden-tienda map from database on mount
  useEffect(() => {
    if (cachedOrdenMap && !isLoadingCachedOrdenMap) {
      const data = cachedOrdenMap as any;
      if (data.success && data.data && Object.keys(data.data).length > 0) {
        console.log(`Loaded cached orden-tienda map with ${Object.keys(data.data).length} entries`);
        const map = new Map<string, string>(Object.entries(data.data));
        const tiendas = Array.from(new Set(map.values())).sort();
        
        setCachedData(prev => ({
          ...prev,
          ordenTiendaMap: map,
          uniqueTiendas: tiendas
        }));
      }
    }
  }, [cachedOrdenMap, isLoadingCachedOrdenMap]);

  // Recalculate and cache installments (called after file uploads)
  // IMPORTANT: Fetches fresh data from API to avoid stale React state issues
  const recalculateAndCacheInstallments = useCallback(async () => {
    console.log('Recalculating installments with fresh API data...');
    setCachedData(prev => ({ ...prev, isRecalculating: true }));
    
    try {
      // Fetch fresh data directly from API to avoid stale state issues
      const [ordersResponse, paymentsResponse, marketplaceResponse, bankResponse] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/payment-records'),
        fetch('/api/marketplace-orders'),
        fetch('/api/bank-statements')
      ]);
      
      const [ordersResult, paymentsResult, marketplaceResult, bankResult] = await Promise.all([
        ordersResponse.json(),
        paymentsResponse.json(),
        marketplaceResponse.json(),
        bankResponse.json()
      ]);
      
      // Get fresh data from API responses
      const currentOrders = ordersResult?.success ? (ordersResult?.data?.rows || []) : tableData;
      const paymentRows = paymentsResult?.success ? (paymentsResult?.data?.rows || []) : [];
      const freshMarketplaceData = marketplaceResult?.success ? marketplaceResult?.data : null;
      const freshBankData = bankResult?.success ? bankResult?.data : null;
      
      // Get the current orden-to-tienda map from fresh marketplace data
      let currentOrdenToTiendaMap = new Map<string, string>();
      
      if (freshMarketplaceData?.rows && freshMarketplaceData?.headers) {
        const mpHeaders = freshMarketplaceData.headers;
        const mpRows = freshMarketplaceData.rows;
        const tiendaColumn = mpHeaders.find((h: string) => 
          h.toLowerCase().includes('tienda') || h.toLowerCase() === 'store'
        );
        const ordenColumn = mpHeaders.find((h: string) => 
          h.toLowerCase().includes('orden') || h.toLowerCase() === '# orden'
        );
        
        if (tiendaColumn && ordenColumn) {
          mpRows.forEach((row: any) => {
            const orden = row[ordenColumn];
            const tienda = row[tiendaColumn];
            if (orden && tienda) {
              const normalizedOrden = String(orden).replace(/^0+/, '') || '0';
              currentOrdenToTiendaMap.set(normalizedOrden, String(tienda).trim());
            }
          });
        }
      }
      
      // Calculate installments (same logic as processedInstallmentsData useMemo)
      const isCancelledOrderFn = (row: any): boolean => {
        const statusOrden = String(row["STATUS ORDEN"] || "").toLowerCase().trim();
        return statusOrden.includes("cancel");
      };
      
      // Filter out cancelled orders AND orders not in marketplace data
      const validOrders = currentOrders.filter((row: any) => {
        if (isCancelledOrderFn(row)) return false;
        const ordenValue = String(row["Orden"] || '').replace(/^0+/, '') || '0';
        if (!currentOrdenToTiendaMap.has(ordenValue)) return false;
        return true;
      });
      
      // Extract schedule-based installments
      let scheduleInstallments = extractInstallments(validOrders);
      
      // Build first reference map for schedule installments (use first payment's reference for each cuota)
      const scheduleFirstRef: Map<string, { payment: any; date: Date | null }> = new Map();
      if (paymentRows.length > 0) {
        paymentRows.forEach((payment: any) => {
          const paymentOrder = String(payment['# Orden'] || payment['#Orden'] || payment['Orden'] || '').trim();
          const paymentInstallmentStr = String(payment['# Cuota Pagada'] || payment['#CuotaPagada'] || payment['Cuota'] || '').trim();
          const fechaTasaCambio = payment['Fecha de Transaccion'] ||
                                  payment['FECHA DE TRANSACCION'] ||
                                  payment['Fecha de Transacción'] ||
                                  payment['FECHA DE TRANSACCIÓN'];
          const parsedDate = fechaTasaCambio ? parseExcelDate(fechaTasaCambio) : null;
          
          if (paymentInstallmentStr) {
            const cuotaParts = paymentInstallmentStr.split(',').map((s: string) => s.trim());
            for (const part of cuotaParts) {
              const parsed = parseInt(part, 10);
              if (!isNaN(parsed)) {
                const key = `${paymentOrder}_${parsed}`;
                // Only store first reference (by order of appearance in payment records)
                if (!scheduleFirstRef.has(key)) {
                  scheduleFirstRef.set(key, { payment, date: parsedDate });
                }
              }
            }
          }
        });
      }
      
      // Enrich with payment data (using only FIRST reference for each cuota)
      if (paymentRows.length > 0) {
        scheduleInstallments = scheduleInstallments.map((installment: any) => {
          const key = `${String(installment.orden).trim()}_${installment.numeroCuota}`;
          const firstRefData = scheduleFirstRef.get(key);

          if (firstRefData && firstRefData.date) {
            const matchingPayment = firstRefData.payment;
            const verificacion = matchingPayment['VERIFICACION'] || '-';
            return { 
              ...installment, 
              fechaPagoReal: firstRefData.date,
              paymentDetails: {
                referencia: matchingPayment['# Referencia'] || matchingPayment['#Referencia'] || matchingPayment['Referencia'],
                metodoPago: matchingPayment['Método de Pago'] || matchingPayment['Metodo de Pago'] || matchingPayment['MÉTODO DE PAGO'],
                montoPagadoUSD: matchingPayment['Monto Pagado en USD'] || matchingPayment['MONTO PAGADO EN USD'] || matchingPayment['Monto'],
                montoPagadoVES: matchingPayment['Monto Pagado en VES'] || matchingPayment['MONTO PAGADO EN VES'],
                tasaCambio: matchingPayment['Tasa de Cambio'] || matchingPayment['TASA DE CAMBIO']
              },
              verificacion
            };
          }
          return installment;
        });
      }
      
      // Create payment-based installments
      // KEY LOGIC: 
      // 1. Track cuotas and use only FIRST reference for bank reconciliation
      // 2. Aggregate all payment amounts per cuota (for when schedule data is missing)
      // 3. If ANY payment for a cuota is verified (SI), the cuota inherits verified status
      const paymentInstallments: any[] = [];
      
      // Data structure to aggregate per cuota: first reference, total amount, and best verification
      interface CuotaAggregation {
        firstReferencia: string;
        firstVerificacion: string;
        firstFechaPago: Date | null;
        firstPaymentDetails: any;
        totalAmountUSD: number;
        hasVerifiedPayment: boolean; // True if ANY payment is verified "SI"
      }
      const cuotaAggregation: Map<string, CuotaAggregation> = new Map();
      
      if (paymentRows.length > 0) {
        // Single pass: Collect first reference AND aggregate amounts per cuota
        paymentRows.forEach((payment: any) => {
          const paymentOrder = String(payment['# Orden'] || payment['#Orden'] || payment['Orden'] || '').trim();
          const paymentInstallment = String(payment['# Cuota Pagada'] || payment['#CuotaPagada'] || payment['Cuota'] || '').trim();
          
          const fechaTasaCambio = payment['Fecha de Transaccion'] ||
                                  payment['FECHA DE TRANSACCION'] ||
                                  payment['Fecha de Transacción'] ||
                                  payment['FECHA DE TRANSACCIÓN'];
          
          const parsedDate = fechaTasaCambio ? parseExcelDate(fechaTasaCambio) : null;
          const referencia = payment['# Referencia'] || payment['#Referencia'] || payment['Referencia'] || '';
          const verificacion = payment['VERIFICACION'] || '-';
          const montoPagadoUSD = parseFloat(payment['Monto Pagado en USD'] || payment['MONTO PAGADO EN USD'] || payment['Monto'] || 0) || 0;
          
          if (!paymentOrder) return;
          
          const cuotaParts = paymentInstallment ? paymentInstallment.split(',').map((s: string) => s.trim()) : ['-1'];
          const numberOfCuotas = cuotaParts.filter(p => parseInt(p, 10) !== -1).length || 1;
          const amountPerCuota = montoPagadoUSD / numberOfCuotas;
          
          for (const part of cuotaParts) {
            const cuotaNum = parseInt(part, 10);
            const cuotaKey = `${paymentOrder}_${isNaN(cuotaNum) ? -1 : cuotaNum}`;
            
            const existing = cuotaAggregation.get(cuotaKey);
            
            if (!existing) {
              // First payment for this cuota - store as first reference
              cuotaAggregation.set(cuotaKey, {
                firstReferencia: referencia,
                firstVerificacion: verificacion,
                firstFechaPago: parsedDate,
                firstPaymentDetails: {
                  referencia,
                  metodoPago: payment['Método de Pago'] || payment['Metodo de Pago'] || payment['MÉTODO DE PAGO'],
                  montoPagadoUSD,
                  montoPagadoVES: payment['Monto Pagado en VES'] || payment['MONTO PAGADO EN VES'],
                  tasaCambio: payment['Tasa de Cambio'] || payment['TASA DE CAMBIO']
                },
                totalAmountUSD: amountPerCuota,
                hasVerifiedPayment: verificacion === 'SI'
              });
            } else {
              // Additional payment for this cuota - aggregate amount and check verification
              existing.totalAmountUSD += amountPerCuota;
              if (verificacion === 'SI') {
                existing.hasVerifiedPayment = true;
              }
            }
          }
        });
        
        // Create ONE payment installment per unique cuota
        cuotaAggregation.forEach((aggData, cuotaKey) => {
          const [paymentOrder, cuotaNumStr] = cuotaKey.split('_');
          const cuotaNum = parseInt(cuotaNumStr, 10);
          
          const matchingScheduleInstallment = scheduleInstallments.find(
            (inst: any) => String(inst.orden).trim() === paymentOrder && inst.numeroCuota === cuotaNum
          );
          
          // Use scheduled amount if available, otherwise use aggregated payment amount
          const splitAmount = matchingScheduleInstallment?.monto || aggData.totalAmountUSD;
          
          // Verification: If ANY payment is verified, use SI; otherwise use first payment's status
          const effectiveVerificacion = aggData.hasVerifiedPayment ? 'SI' : aggData.firstVerificacion;
          
          paymentInstallments.push({
            orden: paymentOrder,
            numeroCuota: cuotaNum,
            monto: splitAmount,
            fechaCuota: matchingScheduleInstallment?.fechaCuota || null,
            fechaPagoReal: aggData.firstFechaPago,
            isPaymentBased: true,
            paymentDetails: aggData.firstPaymentDetails,
            verificacion: effectiveVerificacion,
            scheduledAmount: matchingScheduleInstallment?.monto
          });
        });
      }
      
      // Format installments for cache
      const formatInstallment = (inst: any, isPaymentBased: boolean) => ({
        orden: String(inst.orden || ''),
        numeroCuota: inst.numeroCuota || 0,
        monto: inst.monto ? String(inst.monto) : null,
        fechaCuota: inst.fechaCuota instanceof Date 
          ? inst.fechaCuota.toISOString().split('T')[0] 
          : inst.fechaCuota || null,
        fechaPagoReal: inst.fechaPagoReal instanceof Date
          ? inst.fechaPagoReal.toISOString().split('T')[0]
          : inst.fechaPagoReal || null,
        status: inst.status || inst.estadoCuota || null,
        isPaymentBased,
        tienda: currentOrdenToTiendaMap.get(String(inst.orden).replace(/^0+/, '') || '0') || null,
        paymentReferencia: inst.paymentDetails?.referencia || null,
        paymentMetodo: inst.paymentDetails?.metodoPago || null,
        paymentMontoUSD: inst.paymentDetails?.montoPagadoUSD ? String(inst.paymentDetails.montoPagadoUSD) : null,
        paymentMontoVES: inst.paymentDetails?.montoPagadoVES ? String(inst.paymentDetails.montoPagadoVES) : null,
        paymentTasaCambio: inst.paymentDetails?.tasaCambio ? String(inst.paymentDetails.tasaCambio) : null,
        verificacion: inst.verificacion || null,
        sourceVersion: 1
      });
      
      const scheduleFormatted = scheduleInstallments.map((inst: any) => formatInstallment(inst, false));
      const paymentFormatted = paymentInstallments.map((inst: any) => formatInstallment(inst, true));
      const allInstallmentsForCache = [...scheduleFormatted, ...paymentFormatted];
      
      // Generate hash for cache using fresh data
      const ordersHash = generateDataHash(currentOrders);
      const paymentsHash = generateDataHash(paymentRows);
      const bankRows = freshBankData?.rows || [];
      const bankHash = generateDataHash(bankRows);
      const marketplaceRows = freshMarketplaceData?.rows || [];
      const marketplaceHash = generateDataHash(marketplaceRows);
      const combinedHash = `${ordersHash}|${paymentsHash}|${bankHash}|${marketplaceHash}`;
      
      // Save to cache
      await saveCacheWithHash(allInstallmentsForCache, combinedHash);
      console.log(`Saved ${allInstallmentsForCache.length} installments to cache`);
      
      // Update local state
      setCachedData(prev => ({
        ...prev,
        installments: { scheduleInstallments, paymentInstallments },
        ordenTiendaMap: currentOrdenToTiendaMap,
        uniqueTiendas: Array.from(new Set(currentOrdenToTiendaMap.values())).sort(),
        lastCalculated: new Date(),
        isRecalculating: false
      }));
      
      // Invalidate React Query cache to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['/api/cache/installments'] });
      
    } catch (error) {
      console.error('Error recalculating installments:', error);
      setCachedData(prev => ({ ...prev, isRecalculating: false }));
    }
  }, [tableData]); // tableData is only fallback, main data comes from fresh API fetch

  // Recalculate and cache orden-tienda map (called after marketplace file upload)
  // IMPORTANT: Fetches fresh data from API to avoid stale React state issues
  const recalculateAndCacheOrdenMap = useCallback(async () => {
    console.log('Recalculating orden-tienda map with fresh API data...');
    
    try {
      // Fetch fresh marketplace data directly from API
      const marketplaceResponse = await fetch('/api/marketplace-orders');
      const marketplaceResult = await marketplaceResponse.json();
      
      const freshMpData = marketplaceResult?.success ? marketplaceResult?.data : null;
      if (!freshMpData?.rows || !freshMpData?.headers) return;
      
      const mpHeaders = freshMpData.headers;
      const mpRows = freshMpData.rows;
      
      const tiendaColumn = mpHeaders.find((h: string) => 
        h.toLowerCase().includes('tienda') || h.toLowerCase() === 'store'
      );
      const ordenColumn = mpHeaders.find((h: string) => 
        h.toLowerCase().includes('orden') || h.toLowerCase() === '# orden'
      );
      
      if (!tiendaColumn || !ordenColumn) return;
      
      const mapping: Record<string, string> = {};
      mpRows.forEach((row: any) => {
        const orden = row[ordenColumn];
        const tienda = row[tiendaColumn];
        if (orden && tienda) {
          const normalizedOrden = String(orden).replace(/^0+/, '') || '0';
          mapping[normalizedOrden] = String(tienda).trim();
        }
      });
      
      // Save to database
      await fetch('/api/cache/orden-tienda-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: mapping })
      });
      
      const map = new Map<string, string>(Object.entries(mapping));
      const tiendas = Array.from(new Set(map.values())).sort();
      
      setCachedData(prev => ({
        ...prev,
        ordenTiendaMap: map,
        uniqueTiendas: tiendas
      }));
      
      // Also recalculate installments since orden-tienda mapping changed
      await recalculateAndCacheInstallments();
      
      await queryClient.invalidateQueries({ queryKey: ['/api/cache/orden-tienda-map'] });
      
    } catch (error) {
      console.error('Error recalculating orden-tienda map:', error);
    }
  }, [recalculateAndCacheInstallments]); // Removed stale marketplaceData dependency

  // Recalculate and cache enriched bank statements (called after bank or payment file upload)
  // Fetches fresh data from API to avoid stale React state issues
  const recalculateAndCacheBankStatements = useCallback(async () => {
    console.log('Recalculating enriched bank statements with fresh API data...');
    
    try {
      // Fetch fresh data directly from API
      const [bankResponse, paymentsResponse, ordersResponse] = await Promise.all([
        fetch('/api/bank-statements'),
        fetch('/api/payment-records'),
        fetch('/api/orders')
      ]);
      
      const [bankResult, paymentsResult, ordersResult] = await Promise.all([
        bankResponse.json(),
        paymentsResponse.json(),
        ordersResponse.json()
      ]);
      
      const freshBankData = bankResult?.success ? bankResult?.data : null;
      const freshPaymentData = paymentsResult?.success ? paymentsResult?.data : null;
      const freshOrdersData = ordersResult?.success ? ordersResult?.data : null;
      
      if (!freshBankData?.rows || !freshBankData?.headers) {
        console.log('No bank data available for caching');
        return;
      }
      
      const bankHeaders = freshBankData.headers;
      const rawBankRows = freshBankData.rows;
      const paymentHeaders = freshPaymentData?.headers || [];
      const paymentRows = freshPaymentData?.rows || [];
      const orderRows = freshOrdersData?.rows || [];
      const orderHeaders = freshOrdersData?.headers || [];
      
      // Build Order → Nombre del comprador map from orders
      const ordenToNombreMap = new Map<string, string>();
      const ordenHeader = orderHeaders.find((h: string) => h.toLowerCase() === 'orden');
      const nombreHeader = orderHeaders.find((h: string) => 
        h.toLowerCase().includes('nombre') && h.toLowerCase().includes('comprador')
      );
      if (ordenHeader && nombreHeader) {
        orderRows.forEach((row: any) => {
          const orden = String(row[ordenHeader] || '').replace(/^0+/, '');
          const nombre = row[nombreHeader] || '';
          if (orden && nombre) {
            ordenToNombreMap.set(orden, nombre);
          }
        });
      }
      
      // Deduplicate bank rows by reference number
      const referenciaHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('referencia'));
      const fechaHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('fecha'));
      const descHeader = bankHeaders.find((h: string) => 
        h.toLowerCase().includes('descripcion') || h.toLowerCase().includes('concepto')
      );
      const debeHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('debe'));
      const haberHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('haber'));
      const saldoHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('saldo'));
      
      let bankRows = rawBankRows;
      if (referenciaHeader) {
        const seenReferences = new Map<string, any>();
        rawBankRows.forEach((row: any) => {
          const ref = row[referenciaHeader];
          if (ref != null && String(ref).trim() !== '') {
            const normalizedRef = String(ref).replace(/^["']|["']$/g, '').replace(/\s+/g, '').trim().toLowerCase();
            seenReferences.set(normalizedRef, row);
          }
        });
        bankRows = Array.from(seenReferences.values());
      }
      
      // Enrich bank rows with ORDEN, # CUOTA, NOMBRE, CONCILIADO
      const enrichedStatements = bankRows.map((row: any) => {
        const bankRef = referenciaHeader ? row[referenciaHeader] : null;
        const debeAmount = debeHeader ? row[debeHeader] : null;
        const haberAmount = haberHeader ? row[haberHeader] : null;
        
        // Find matching payment record
        const matchedPayment = findMatchingPaymentRecord(
          bankRef,
          debeAmount,
          haberAmount,
          paymentRows,
          paymentHeaders
        );
        
        // Get buyer name
        let nombre = '';
        if (matchedPayment?.orden) {
          nombre = ordenToNombreMap.get(matchedPayment.orden) || '';
        }
        
        // Format for database storage
        return {
          referencia: bankRef ? String(bankRef) : null,
          fecha: fechaHeader && row[fechaHeader] ? String(row[fechaHeader]).split('T')[0] : null,
          descripcion: descHeader ? String(row[descHeader] || '') : null,
          debe: debeAmount ? String(debeAmount) : null,
          haber: haberAmount ? String(haberAmount) : null,
          saldo: saldoHeader && row[saldoHeader] ? String(row[saldoHeader]) : null,
          orden: matchedPayment?.orden || null,
          cuota: matchedPayment?.cuota || null,
          nombre: nombre || null,
          conciliado: matchedPayment ? 'SI' : 'NO',
          sourceVersion: 1
        };
      });
      
      // Save to cache
      await fetch('/api/cache/bank-statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statements: enrichedStatements })
      });
      
      console.log(`Saved ${enrichedStatements.length} enriched bank statements to cache`);
      
      // Invalidate React Query cache to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['/api/cache/bank-statements'] });
      
    } catch (error) {
      console.error('Error recalculating bank statements:', error);
    }
  }, []);

  // Smart cache invalidation: check if source data has changed and update statuses on app load
  useEffect(() => {
    const checkCacheAndUpdateStatuses = async () => {
      try {
        // Update time-based statuses once per day on app load
        if (shouldUpdateStatuses()) {
          console.log('Daily status update triggered');
          const result = await updateTimeBasedStatuses();
          if (result.updated > 0) {
            console.log(`Updated ${result.updated} installment statuses based on current date`);
          }
        }

        // Check if source data has changed since last cache calculation
        const cacheMetadata = await getCacheMetadata();
        if (!cacheMetadata.success || !cacheMetadata.data) {
          console.log('No cache metadata found, will recalculate on demand');
          return;
        }

        // Generate hashes of current source data
        const ordersHash = generateDataHash(tableData);
        const paymentsRows = (paymentRecordsData as any)?.data?.rows || [];
        const paymentsHash = generateDataHash(paymentsRows);
        const bankRows = (bankStatementsData as any)?.data?.rows || [];
        const bankHash = generateDataHash(bankRows);
        const marketplaceRows = (marketplaceData as any)?.data?.rows || [];
        const marketplaceHash = generateDataHash(marketplaceRows);

        const combinedHash = `${ordersHash}|${paymentsHash}|${bankHash}|${marketplaceHash}`;
        const cachedHash = cacheMetadata.data.installments?.sourceDataHash || '';

        if (combinedHash !== cachedHash && cachedHash !== '' && tableData.length > 0) {
          console.log('Source data changed, invalidating old cache');
          console.log('Current hash:', combinedHash.substring(0, 50) + '...');
          console.log('Cached hash:', cachedHash.substring(0, 50) + '...');
          await invalidateCacheWithNewHash(combinedHash);
        } else if (cachedHash === '' && tableData.length > 0) {
          console.log('No cached data yet, will save automatically');
        } else {
          console.log('Cache is current');
        }
      } catch (error) {
        console.error('Error checking cache:', error);
      }
    };

    // Only run after data is loaded
    if (tableData.length > 0 || (paymentRecordsData as any)?.data?.rows?.length > 0) {
      checkCacheAndUpdateStatuses();
    }
  }, [tableData.length, paymentRecordsData, bankStatementsData, marketplaceData]);

  // Calculate cuotasAdelantadasPeriodosAnteriores from CONCILIACION DE CUOTAS data
  // This will be passed to REPORTE MENSUAL so it shows the same value
  const cuotasAdelantadasPeriodosAnteriores = useMemo(() => {
    // This calculation is simplified - it will be 0 unless there's data
    // The real calculation happens in InstallmentsDashboard which receives filtered installments
    // For now, return 0 and let MonthlyReport handle its own calculation
    return 0;
  }, []);

  // Extract unique tiendas from marketplace data for the filter dropdown
  const uniqueTiendas = useMemo(() => {
    const mpData = marketplaceData as any;
    if (!mpData?.data?.rows || !mpData?.data?.headers) return [];
    
    const headers = mpData.data.headers;
    const rows = mpData.data.rows;
    
    // Find the Tienda column (case-insensitive)
    const tiendaColumn = headers.find((h: string) => 
      h.toLowerCase().includes('tienda') || h.toLowerCase() === 'store'
    );
    
    if (!tiendaColumn) return [];
    
    const tiendas = new Set<string>();
    rows.forEach((row: any) => {
      const tienda = row[tiendaColumn];
      if (tienda && String(tienda).trim()) {
        tiendas.add(String(tienda).trim());
      }
    });
    
    return Array.from(tiendas).sort();
  }, [marketplaceData]);

  // Create orden-to-tienda mapping from marketplace data
  const ordenToTiendaMap = useMemo(() => {
    const mpData = marketplaceData as any;
    if (!mpData?.data?.rows || !mpData?.data?.headers) return new Map<string, string>();
    
    const headers = mpData.data.headers;
    const rows = mpData.data.rows;
    
    // Find the Tienda and Orden columns
    const tiendaColumn = headers.find((h: string) => 
      h.toLowerCase().includes('tienda') || h.toLowerCase() === 'store'
    );
    const ordenColumn = headers.find((h: string) => 
      h.toLowerCase().includes('orden') || h.toLowerCase() === '# orden'
    );
    
    if (!tiendaColumn || !ordenColumn) return new Map<string, string>();
    
    const mapping = new Map<string, string>();
    rows.forEach((row: any) => {
      const orden = row[ordenColumn];
      const tienda = row[tiendaColumn];
      if (orden && tienda) {
        // Normalize order number (remove leading zeros)
        const normalizedOrden = String(orden).replace(/^0+/, '') || '0';
        mapping.set(normalizedOrden, String(tienda).trim());
      }
    });
    
    return mapping;
  }, [marketplaceData]);

  // Helper function to check if an order is cancelled
  const isCancelledOrder = useCallback((row: any): boolean => {
    const statusOrden = String(row["STATUS ORDEN"] || "").toLowerCase().trim();
    return statusOrden.includes("cancel");
  }, []);

  // Create deferred versions of heavy data dependencies
  // This allows React to interrupt expensive calculations for user interactions
  const deferredTableData = useDeferredValue(tableData);
  const deferredPaymentRecordsData = useDeferredValue(paymentRecordsData);
  const deferredBankStatementsData = useDeferredValue(bankStatementsData);

  // Pre-process all installments data ONCE and cache it at Home level
  // This prevents recalculation when switching tabs
  // Uses deferred values to allow React to interrupt for user interactions
  const processedInstallmentsData = useMemo(() => {
    if (!deferredTableData || deferredTableData.length === 0) {
      return { scheduleInstallments: [], paymentInstallments: [] };
    }

    const apiData = deferredPaymentRecordsData as any;
    const paymentRows = apiData?.data?.rows || [];
    const paymentHeaders = apiData?.data?.headers || [];
    const hasPaymentData = paymentRows.length > 0;

    // Filter out cancelled orders AND orders not in marketplace data
    const validOrders = deferredTableData.filter(row => {
      if (isCancelledOrder(row)) return false;
      const ordenValue = String(row["Orden"] || '').replace(/^0+/, '') || '0';
      if (!ordenToTiendaMap.has(ordenValue)) return false;
      return true;
    });

    // Extract schedule-based installments
    let scheduleInstallments = extractInstallments(validOrders);

    // Build first reference map for schedule installments (use first payment's reference for each cuota)
    const scheduleFirstRefMemo: Map<string, { payment: any; date: Date | null }> = new Map();
    if (hasPaymentData) {
      paymentRows.forEach((payment: any) => {
        const paymentOrder = String(payment['# Orden'] || payment['#Orden'] || payment['Orden'] || '').trim();
        const paymentInstallmentStr = String(payment['# Cuota Pagada'] || payment['#CuotaPagada'] || payment['Cuota'] || '').trim();
        const fechaTasaCambio = payment['Fecha de Transaccion'] ||
                                payment['FECHA DE TRANSACCION'] ||
                                payment['Fecha de Transacción'] ||
                                payment['FECHA DE TRANSACCIÓN'];
        const parsedDate = fechaTasaCambio ? parseExcelDate(fechaTasaCambio) : null;
        
        if (paymentInstallmentStr) {
          const cuotaParts = paymentInstallmentStr.split(',').map((s: string) => s.trim());
          for (const part of cuotaParts) {
            const parsed = parseInt(part, 10);
            if (!isNaN(parsed)) {
              const key = `${paymentOrder}_${parsed}`;
              // Only store first reference (by order of appearance in payment records)
              if (!scheduleFirstRefMemo.has(key)) {
                scheduleFirstRefMemo.set(key, { payment, date: parsedDate });
              }
            }
          }
        }
      });
    }
    
    // Enrich with payment data (using only FIRST reference for each cuota)
    if (hasPaymentData) {
      scheduleInstallments = scheduleInstallments.map((installment: any) => {
        const key = `${String(installment.orden).trim()}_${installment.numeroCuota}`;
        const firstRefData = scheduleFirstRefMemo.get(key);

        if (firstRefData && firstRefData.date) {
          const matchingPayment = firstRefData.payment;
          const verificacion = matchingPayment['VERIFICACION'] || '-';
          return { 
            ...installment, 
            fechaPagoReal: firstRefData.date,
            paymentDetails: {
              referencia: matchingPayment['# Referencia'] || matchingPayment['#Referencia'] || matchingPayment['Referencia'],
              metodoPago: matchingPayment['Método de Pago'] || matchingPayment['Metodo de Pago'] || matchingPayment['MÉTODO DE PAGO'],
              montoPagadoUSD: matchingPayment['Monto Pagado en USD'] || matchingPayment['MONTO PAGADO EN USD'] || matchingPayment['Monto'],
              montoPagadoVES: matchingPayment['Monto Pagado en VES'] || matchingPayment['MONTO PAGADO EN VES'],
              tasaCambio: matchingPayment['Tasa de Cambio'] || matchingPayment['TASA DE CAMBIO']
            },
            verificacion
          };
        }
        return installment;
      });
    }

    // Create payment-based installments
    // KEY LOGIC: 
    // 1. Track cuotas and use only FIRST reference for bank reconciliation
    // 2. Aggregate all payment amounts per cuota (for when schedule data is missing)
    // 3. If ANY payment for a cuota is verified (SI), the cuota inherits verified status
    const paymentInstallments: any[] = [];
    
    // Data structure to aggregate per cuota
    const cuotaAggMemo: Map<string, {
      firstReferencia: string;
      firstVerificacion: string;
      firstFechaPago: Date | null;
      firstPaymentDetails: any;
      totalAmountUSD: number;
      hasVerifiedPayment: boolean;
    }> = new Map();
    
    if (hasPaymentData) {
      // Single pass: Collect first reference AND aggregate amounts per cuota
      paymentRows.forEach((payment: any) => {
        const paymentOrder = String(payment['# Orden'] || payment['#Orden'] || payment['Orden'] || '').trim();
        const paymentInstallment = String(payment['# Cuota Pagada'] || payment['#CuotaPagada'] || payment['Cuota'] || '').trim();
        
        const fechaTasaCambio = payment['Fecha de Transaccion'] ||
                                payment['FECHA DE TRANSACCION'] ||
                                payment['Fecha de Transacción'] ||
                                payment['FECHA DE TRANSACCIÓN'];
        
        const parsedDate = fechaTasaCambio ? parseExcelDate(fechaTasaCambio) : null;
        const referencia = payment['# Referencia'] || payment['#Referencia'] || payment['Referencia'] || '';
        const verificacion = payment['VERIFICACION'] || '-';
        const montoPagadoUSD = parseFloat(payment['Monto Pagado en USD'] || payment['MONTO PAGADO EN USD'] || payment['Monto'] || 0) || 0;
        
        if (!paymentOrder) return;
        
        const cuotaParts = paymentInstallment ? paymentInstallment.split(',').map((s: string) => s.trim()) : ['-1'];
        const numberOfCuotas = cuotaParts.filter(p => parseInt(p, 10) !== -1).length || 1;
        const amountPerCuota = montoPagadoUSD / numberOfCuotas;
        
        for (const part of cuotaParts) {
          const cuotaNum = parseInt(part, 10);
          const cuotaKey = `${paymentOrder}_${isNaN(cuotaNum) ? -1 : cuotaNum}`;
          
          const existing = cuotaAggMemo.get(cuotaKey);
          
          if (!existing) {
            // First payment for this cuota - store as first reference
            cuotaAggMemo.set(cuotaKey, {
              firstReferencia: referencia,
              firstVerificacion: verificacion,
              firstFechaPago: parsedDate,
              firstPaymentDetails: {
                referencia,
                metodoPago: payment['Método de Pago'] || payment['Metodo de Pago'] || payment['MÉTODO DE PAGO'],
                montoPagadoUSD,
                montoPagadoVES: payment['Monto Pagado en VES'] || payment['MONTO PAGADO EN VES'],
                tasaCambio: payment['Tasa de Cambio'] || payment['TASA DE CAMBIO']
              },
              totalAmountUSD: amountPerCuota,
              hasVerifiedPayment: verificacion === 'SI'
            });
          } else {
            // Additional payment for this cuota - aggregate amount and check verification
            existing.totalAmountUSD += amountPerCuota;
            if (verificacion === 'SI') {
              existing.hasVerifiedPayment = true;
            }
          }
        }
      });
      
      // Create ONE payment installment per unique cuota
      cuotaAggMemo.forEach((aggData, cuotaKey) => {
        const [paymentOrder, cuotaNumStr] = cuotaKey.split('_');
        const cuotaNum = parseInt(cuotaNumStr, 10);
        
        const matchingScheduleInstallment = scheduleInstallments.find(
          (inst: any) => String(inst.orden).trim() === paymentOrder && inst.numeroCuota === cuotaNum
        );
        
        // Use scheduled amount if available, otherwise use aggregated payment amount
        const splitAmount = matchingScheduleInstallment?.monto || aggData.totalAmountUSD;
        
        // Verification: If ANY payment is verified, use SI; otherwise use first payment's status
        const effectiveVerificacion = aggData.hasVerifiedPayment ? 'SI' : aggData.firstVerificacion;
        
        paymentInstallments.push({
          orden: paymentOrder,
          numeroCuota: cuotaNum,
          monto: splitAmount,
          fechaCuota: matchingScheduleInstallment?.fechaCuota || null,
          fechaPagoReal: aggData.firstFechaPago,
          isPaymentBased: true,
          paymentDetails: aggData.firstPaymentDetails,
          verificacion: effectiveVerificacion,
          scheduledAmount: matchingScheduleInstallment?.monto
        });
      });
    }

    return { scheduleInstallments, paymentInstallments };
  }, [deferredTableData, deferredPaymentRecordsData, ordenToTiendaMap, isCancelledOrder]);

  // Add status to payment installments and create filtered views
  // This replaces the hidden AllPagosInstallments components
  const paymentInstallmentsWithStatus = useMemo(() => {
    const { paymentInstallments } = processedInstallmentsData;
    if (!paymentInstallments || paymentInstallments.length === 0) return [];
    
    const gracePeriodThreshold = new Date();
    gracePeriodThreshold.setDate(gracePeriodThreshold.getDate() - 3);
    gracePeriodThreshold.setHours(23, 59, 59, 999);
    
    // Helper to safely parse date - avoids double-parsing Date objects
    const safeParse = (val: any): Date | null => {
      if (!val) return null;
      if (val instanceof Date) return val;
      return parseExcelDate(val);
    };
    
    // First pass: normalize estadoCuota (mirrors AllPagosInstallments logic)
    let normalized = paymentInstallments.map((installment: any) => {
      // Payment-based entries ALWAYS default to 'Done' first
      // This matches AllPagosInstallments behavior where payment entries get estadoCuota: 'Done'
      let estadoCuota = installment.estadoCuota || (installment.isPaymentBased ? 'Done' : '');
      
      const paymentDateRaw = installment.fechaPagoReal || installment.fechaPago;
      const estadoLower = estadoCuota.trim().toLowerCase();
      const isScheduledOrGraced = estadoLower === 'scheduled' || estadoLower === 'graced';
      const fechaCuota = installment.fechaCuota;
      
      const paymentDate = safeParse(paymentDateRaw);
      
      // If scheduled/graced and paid on or before due date -> Done
      if (isScheduledOrGraced && paymentDate && fechaCuota) {
        const cuotaDate = safeParse(fechaCuota);
        
        if (cuotaDate && paymentDate <= cuotaDate) {
          estadoCuota = 'Done';
        }
      }
      
      // If scheduled/graced, no payment, and past grace period -> Delayed
      if (fechaCuota && isScheduledOrGraced && !paymentDate) {
        const cuotaDate = safeParse(fechaCuota);
        
        if (cuotaDate) {
          const cuotaDateCopy = new Date(cuotaDate);
          cuotaDateCopy.setHours(23, 59, 59, 999);
          
          if (cuotaDateCopy < gracePeriodThreshold) {
            estadoCuota = 'Delayed';
          }
        }
      }
      
      return { ...installment, estadoCuota };
    });
    
    // Second pass: Add STATUS field to each installment
    return normalized.map((inst: any) => ({
      ...inst,
      status: calculateInstallmentStatus(inst)
    }));
  }, [processedInstallmentsData]);

  // Helper to safely parse date - avoids double-parsing Date objects
  const safeParseDate = useCallback((dateValue: any): Date | null => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    return parseExcelDate(dateValue);
  }, []);

  // Ref to track if cache save has been done for current hash
  const lastSavedHashRef = useRef<string>('');

  // Combine schedule and payment installments for cache, memoized to prevent repeated saves
  const allInstallmentsForCache = useMemo(() => {
    const { scheduleInstallments, paymentInstallments } = processedInstallmentsData;
    
    if (scheduleInstallments.length === 0 && paymentInstallments.length === 0) {
      return [];
    }

    const formatInstallment = (inst: any, isPaymentBased: boolean) => ({
      orden: String(inst.orden || ''),
      numeroCuota: inst.numeroCuota || 0,
      monto: inst.monto ? String(inst.monto) : null,
      fechaCuota: inst.fechaCuota instanceof Date 
        ? inst.fechaCuota.toISOString().split('T')[0] 
        : inst.fechaCuota || null,
      fechaPagoReal: inst.fechaPagoReal instanceof Date
        ? inst.fechaPagoReal.toISOString().split('T')[0]
        : inst.fechaPagoReal || null,
      status: inst.status || inst.estadoCuota || null,
      isPaymentBased,
      tienda: ordenToTiendaMap.get(String(inst.orden).replace(/^0+/, '') || '0') || null,
      paymentReferencia: inst.paymentDetails?.referencia || null,
      paymentMetodo: inst.paymentDetails?.metodoPago || null,
      paymentMontoUSD: inst.paymentDetails?.montoPagadoUSD ? String(inst.paymentDetails.montoPagadoUSD) : null,
      paymentMontoVES: inst.paymentDetails?.montoPagadoVES ? String(inst.paymentDetails.montoPagadoVES) : null,
      paymentTasaCambio: inst.paymentDetails?.tasaCambio ? String(inst.paymentDetails.tasaCambio) : null,
      verificacion: inst.verificacion || null,
      sourceVersion: 1
    });

    // Combine both schedule-based and payment-based installments
    const scheduleFormatted = scheduleInstallments.map((inst: any) => formatInstallment(inst, false));
    const paymentFormatted = paymentInstallments.map((inst: any) => formatInstallment(inst, true));

    return [...scheduleFormatted, ...paymentFormatted];
  }, [processedInstallmentsData, ordenToTiendaMap]);

  // Compute combined hash once, memoized
  const combinedDataHash = useMemo(() => {
    const ordersHash = generateDataHash(tableData);
    const paymentsRows = (paymentRecordsData as any)?.data?.rows || [];
    const paymentsHash = generateDataHash(paymentsRows);
    const bankRows = (bankStatementsData as any)?.data?.rows || [];
    const bankHash = generateDataHash(bankRows);
    const marketplaceRows = (marketplaceData as any)?.data?.rows || [];
    const marketplaceHash = generateDataHash(marketplaceRows);
    
    return `${ordersHash}|${paymentsHash}|${bankHash}|${marketplaceHash}`;
  }, [tableData, paymentRecordsData, bankStatementsData, marketplaceData]);

  // Save to cache only when hash changes and data is available
  useEffect(() => {
    const saveToCache = async () => {
      // Skip if no data or if we already saved this hash
      if (allInstallmentsForCache.length === 0 || combinedDataHash === lastSavedHashRef.current) {
        return;
      }

      try {
        await saveCacheWithHash(allInstallmentsForCache, combinedDataHash);
        lastSavedHashRef.current = combinedDataHash;
        console.log(`Saved ${allInstallmentsForCache.length} installments to cache with hash: ${combinedDataHash.substring(0, 50)}...`);
      } catch (error) {
        console.error('Error saving to cache:', error);
      }
    };

    // Only save if we have meaningful data
    if (allInstallmentsForCache.length > 0 && tableData.length > 0) {
      saveToCache();
    }
  }, [allInstallmentsForCache, combinedDataHash, tableData.length]);

  // Filtered payment installments with local + master filters (for CONCILIACION DE PAGOS tab)
  const filteredPagosWithLocalFilters = useMemo(() => {
    if (!paymentInstallmentsWithStatus || paymentInstallmentsWithStatus.length === 0) return [];
    
    // Get list of valid order numbers from tableData
    const validOrderNumbers = new Set(
      tableData.map((row: any) => String(row['Orden'] || '').trim()).filter(Boolean)
    );

    return paymentInstallmentsWithStatus.filter((installment: any) => {
      // CRITICAL: Only include payment-based entries (matching ConciliacionPagosTable/AllPagosInstallments logic)
      if (!installment.isPaymentBased) return false;

      // Only show cuotas for orders that exist in tableData
      const ordenValue = String(installment.orden || '').trim();
      if (!validOrderNumbers.has(ordenValue)) return false;

      // MASTER FILTERS - Applied FIRST
      // Master date range filter - USE PAYMENT DATE
      if (masterDateFrom || masterDateTo) {
        const effectiveDate = installment.fechaPagoReal || installment.fechaPago;
        
        if (effectiveDate) {
          const installmentDate = safeParseDate(effectiveDate);
          
          if (installmentDate) {
            const normalizedDate = new Date(installmentDate);
            normalizedDate.setHours(0, 0, 0, 0);
            
            if (masterDateFrom) {
              const fromDate = parseDDMMYYYY(masterDateFrom);
              if (fromDate) {
                fromDate.setHours(0, 0, 0, 0);
                if (normalizedDate < fromDate) return false;
              }
            }
            if (masterDateTo) {
              const toDate = parseDDMMYYYY(masterDateTo);
              if (toDate) {
                toDate.setHours(23, 59, 59, 999);
                if (normalizedDate > toDate) return false;
              }
            }
          }
        }
      }

      // Master orden filter
      if (masterOrden) {
        const ordenVal = String(installment.orden || '').toLowerCase();
        if (!ordenVal.includes(masterOrden.toLowerCase())) return false;
      }

      // Master tienda filter
      if (masterTienda && masterTienda !== 'all') {
        const ordenVal = String(installment.orden || '').replace(/^0+/, '') || '0';
        const rowTienda = ordenToTiendaMap.get(ordenVal);
        if (!rowTienda || rowTienda !== masterTienda) return false;
      }

      // TAB-SPECIFIC FILTERS - Applied AFTER master filters
      // Local date range filter
      if ((pagosDateFrom || pagosDateTo) && !masterDateFrom && !masterDateTo) {
        const effectiveDate = installment.fechaPagoReal || installment.fechaPago;
        if (!effectiveDate) return false;
        
        const installmentDate = safeParseDate(effectiveDate);
        
        if (installmentDate) {
          const normalizedDate = new Date(installmentDate);
          normalizedDate.setHours(0, 0, 0, 0);
          
          if (pagosDateFrom) {
            const fromDate = parseDDMMYYYY(pagosDateFrom);
            if (fromDate) {
              fromDate.setHours(0, 0, 0, 0);
              if (normalizedDate < fromDate) return false;
            }
          }
          if (pagosDateTo) {
            const toDate = parseDDMMYYYY(pagosDateTo);
            if (toDate) {
              toDate.setHours(23, 59, 59, 999);
              if (normalizedDate > toDate) return false;
            }
          }
        }
      }

      // Local orden filter
      if (pagosOrdenFilter && !masterOrden) {
        const ordenVal = String(installment.orden || '').toLowerCase();
        if (!ordenVal.includes(pagosOrdenFilter.toLowerCase())) return false;
      }

      // Estado Cuota filter
      if (pagosEstadoCuotaFilter && pagosEstadoCuotaFilter !== 'all') {
        const estado = (installment.estadoCuota || '').trim().toLowerCase();
        if (estado !== pagosEstadoCuotaFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [paymentInstallmentsWithStatus, tableData, masterDateFrom, masterDateTo, masterOrden, masterTienda, ordenToTiendaMap, pagosDateFrom, pagosDateTo, pagosOrdenFilter, pagosEstadoCuotaFilter, safeParseDate]);

  // Filtered payment installments with ONLY master filters (for MonthlyReport)
  const filteredPagosMasterOnly = useMemo(() => {
    if (!paymentInstallmentsWithStatus || paymentInstallmentsWithStatus.length === 0) return [];
    
    // Get list of valid order numbers from tableData
    const validOrderNumbers = new Set(
      tableData.map((row: any) => String(row['Orden'] || '').trim()).filter(Boolean)
    );

    return paymentInstallmentsWithStatus.filter((installment: any) => {
      // CRITICAL: Only include payment-based entries (matching AllPagosInstallments logic)
      if (!installment.isPaymentBased) return false;

      // Only show cuotas for orders that exist in tableData
      const ordenValue = String(installment.orden || '').trim();
      if (!validOrderNumbers.has(ordenValue)) return false;

      // MASTER FILTERS ONLY
      // Master date range filter - USE PAYMENT DATE
      if (masterDateFrom || masterDateTo) {
        const effectiveDate = installment.fechaPagoReal || installment.fechaPago;
        
        if (effectiveDate) {
          const installmentDate = safeParseDate(effectiveDate);
          
          if (installmentDate) {
            const normalizedDate = new Date(installmentDate);
            normalizedDate.setHours(0, 0, 0, 0);
            
            if (masterDateFrom) {
              const fromDate = parseDDMMYYYY(masterDateFrom);
              if (fromDate) {
                fromDate.setHours(0, 0, 0, 0);
                if (normalizedDate < fromDate) return false;
              }
            }
            if (masterDateTo) {
              const toDate = parseDDMMYYYY(masterDateTo);
              if (toDate) {
                toDate.setHours(23, 59, 59, 999);
                if (normalizedDate > toDate) return false;
              }
            }
          }
        }
      }

      // Master orden filter
      if (masterOrden) {
        const ordenVal = String(installment.orden || '').toLowerCase();
        if (!ordenVal.includes(masterOrden.toLowerCase())) return false;
      }

      // Master tienda filter
      if (masterTienda && masterTienda !== 'all') {
        const ordenVal = String(installment.orden || '').replace(/^0+/, '') || '0';
        const rowTienda = ordenToTiendaMap.get(ordenVal);
        if (!rowTienda || rowTienda !== masterTienda) return false;
      }

      return true;
    });
  }, [paymentInstallmentsWithStatus, tableData, masterDateFrom, masterDateTo, masterOrden, masterTienda, ordenToTiendaMap, safeParseDate]);

  // Update state when filtered data changes (replaces AllPagosInstallments component effect)
  useEffect(() => {
    setFilteredPagosInstallmentsData(filteredPagosWithLocalFilters);
  }, [filteredPagosWithLocalFilters]);

  useEffect(() => {
    setFilteredPagosMasterOnlyData(filteredPagosMasterOnly);
  }, [filteredPagosMasterOnly]);

  // Pre-process bank statements with CONCILIADO values
  // Uses cached data from database if available, otherwise calculates fresh
  // Also enriches with ORDEN, # CUOTA, and NOMBRE from payment records and orders
  const processedBankData = useMemo(() => {
    const bankApiData = deferredBankStatementsData as any;
    const cachedData = cachedBankStatements as any;
    
    if (!bankApiData?.data?.rows || !bankApiData?.data?.headers) {
      return { headers: [], rows: [], extendedHeaders: [], fromCache: false };
    }
    
    const bankHeaders = bankApiData.data.headers;
    
    // Define extended headers (always needed for display)
    const saldoIndex = bankHeaders.findIndex((h: string) => h.toLowerCase().includes('saldo'));
    const newColumns = ['ORDEN', '# CUOTA', 'NOMBRE', 'CONCILIADO'];
    let extendedHeaders: string[];
    if (saldoIndex === -1) {
      extendedHeaders = [...bankHeaders, ...newColumns];
    } else {
      extendedHeaders = [...bankHeaders];
      extendedHeaders.splice(saldoIndex + 1, 0, ...newColumns);
    }
    
    // Check if we have cached data
    if (cachedData?.success && cachedData?.data && cachedData.data.length > 0) {
      // Convert cached data back to display format
      const fechaHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('fecha'));
      const descHeader = bankHeaders.find((h: string) => 
        h.toLowerCase().includes('descripcion') || h.toLowerCase().includes('concepto')
      );
      const referenciaHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('referencia'));
      const debeHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('debe'));
      const haberHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('haber'));
      const saldoHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('saldo'));
      
      const cachedRows = cachedData.data.map((cached: any) => {
        const row: any = {};
        if (fechaHeader) row[fechaHeader] = cached.fecha;
        if (descHeader) row[descHeader] = cached.descripcion;
        if (referenciaHeader) row[referenciaHeader] = cached.referencia;
        if (debeHeader) row[debeHeader] = cached.debe;
        if (haberHeader) row[haberHeader] = cached.haber;
        if (saldoHeader) row[saldoHeader] = cached.saldo;
        row['ORDEN'] = cached.orden || '';
        row['# CUOTA'] = cached.cuota || '';
        row['NOMBRE'] = cached.nombre || '';
        row['CONCILIADO'] = cached.conciliado || 'NO';
        return row;
      });
      
      return { 
        headers: bankHeaders, 
        rows: cachedRows, 
        extendedHeaders,
        fromCache: true
      };
    }
    
    // No cache available - calculate fresh (this should be rare after initial upload)
    const paymentApiData = deferredPaymentRecordsData as any;
    const rawBankRows = bankApiData.data.rows;
    const paymentHeaders = paymentApiData?.data?.headers || [];
    const paymentRows = paymentApiData?.data?.rows || [];
    
    // Build Order → Nombre del comprador map from tableData (orders)
    const ordenToNombreMap = new Map<string, string>();
    if (tableData.length > 0 && headers.length > 0) {
      const ordenHeader = headers.find((h: string) => h.toLowerCase() === 'orden');
      const nombreHeader = headers.find((h: string) => 
        h.toLowerCase().includes('nombre') && h.toLowerCase().includes('comprador')
      );
      if (ordenHeader && nombreHeader) {
        tableData.forEach((row: any) => {
          const orden = String(row[ordenHeader] || '').replace(/^0+/, '');
          const nombre = row[nombreHeader] || '';
          if (orden && nombre) {
            ordenToNombreMap.set(orden, nombre);
          }
        });
      }
    }
    
    // Deduplicate bank rows by reference number (keep last occurrence)
    const referenciaHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('referencia'));
    let bankRows = rawBankRows;
    if (referenciaHeader) {
      const seenReferences = new Map<string, any>();
      rawBankRows.forEach((row: any) => {
        const ref = row[referenciaHeader];
        if (ref != null && String(ref).trim() !== '') {
          const normalizedRef = String(ref).replace(/^["']|["']$/g, '').replace(/\s+/g, '').trim().toLowerCase();
          seenReferences.set(normalizedRef, row);
        }
      });
      bankRows = Array.from(seenReferences.values());
    }
    
    // Find column headers for CONCILIADO calculation
    const debeHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('debe'));
    const haberHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('haber'));
    
    // Add enriched data to each row (ORDEN, # CUOTA, NOMBRE, CONCILIADO)
    const enrichedRows = bankRows.map((row: any) => {
      const bankRef = referenciaHeader ? row[referenciaHeader] : null;
      const debeAmount = debeHeader ? row[debeHeader] : null;
      const haberAmount = haberHeader ? row[haberHeader] : null;
      
      // Find matching payment record to get Order and Cuota
      const matchedPayment = findMatchingPaymentRecord(
        bankRef,
        debeAmount,
        haberAmount,
        paymentRows,
        paymentHeaders
      );
      
      // Get Nombre del comprador from orders using the matched Order
      let nombre = '';
      if (matchedPayment?.orden) {
        nombre = ordenToNombreMap.get(matchedPayment.orden) || '';
      }
      
      // Determine CONCILIADO value (SI if match found, NO otherwise)
      const conciliadoValue = matchedPayment ? 'SI' : 'NO';
      
      return { 
        ...row, 
        'ORDEN': matchedPayment?.orden || '',
        '# CUOTA': matchedPayment?.cuota || '',
        'NOMBRE': nombre,
        'CONCILIADO': conciliadoValue 
      };
    });
    
    return { 
      headers: bankHeaders, 
      rows: enrichedRows, 
      extendedHeaders,
      fromCache: false
    };
  }, [deferredBankStatementsData, deferredPaymentRecordsData, tableData, headers, cachedBankStatements]);

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
          const headers = ordersResult.data.headers;
          const rows = ordersResult.data.rows;
          
          // Deduplicate orders before setting state
          const deduplicatedRows = deduplicateOrders(rows, headers);
          
          setHeaders(headers);
          setTableData(deduplicatedRows);
        }
        
        // Trigger recalculation of installments with new orders data
        await recalculateAndCacheInstallments();
        
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
  }, [toast, recalculateAndCacheInstallments]);

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

  const handleExport = useCallback(async () => {
    if (tableData.length === 0) return;

    const XLSX = await import('xlsx');
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
      
      // Trigger recalculation of installments with new payment data
      await recalculateAndCacheInstallments();
      
      // Recalculate bank statements since payment records affect matching
      await recalculateAndCacheBankStatements();
      
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
  }, [uploadPaymentMutation, recalculateAndCacheBankStatements]);

  const handleClearPaymentFile = useCallback(() => {
    setSelectedPaymentFile(null);
  }, []);

  // Marketplace orders upload mutation
  const uploadMarketplaceMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload-marketplace-orders', {
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
      // Refetch marketplace orders query
      await queryClient.refetchQueries({ queryKey: ['/api/marketplace-orders'] });
      
      // Trigger recalculation of orden-tienda map with new marketplace data
      await recalculateAndCacheOrdenMap();
      
      toast({
        title: "Archivo de marketplace cargado",
        description: data.message || `${data.data.rowCount} registros importados`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al cargar el archivo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleMarketplaceFileSelect = useCallback((file: File) => {
    setSelectedMarketplaceFile(file);
    uploadMarketplaceMutation.mutate(file);
  }, [uploadMarketplaceMutation]);

  const handleClearMarketplaceFile = useCallback(() => {
    setSelectedMarketplaceFile(null);
  }, []);

  // Bank statement upload mutation
  const uploadBankMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload-bank-statement', {
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
      // Refetch bank statements query AND payment records (VERIFICACION was updated)
      await queryClient.refetchQueries({ queryKey: ['/api/bank-statements'] });
      await queryClient.refetchQueries({ queryKey: ['/api/payment-records'] });
      
      // Recalculate installments since VERIFICACION may have changed
      await recalculateAndCacheInstallments();
      
      // Recalculate and cache enriched bank statements
      await recalculateAndCacheBankStatements();
      
      toast({
        title: "Estado de cuenta cargado",
        description: data.message || `${data.data.rowCount} registros importados`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al cargar el archivo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBankFileSelect = useCallback((file: File) => {
    setSelectedBankFile(file);
    uploadBankMutation.mutate(file);
  }, [uploadBankMutation, recalculateAndCacheBankStatements]);

  const handleClearBankFile = useCallback(() => {
    setSelectedBankFile(null);
  }, []);

  // Filter logic for TODAS LAS ORDENES tab
  const filteredTableData = useMemo(() => {
    if (!tableData || tableData.length === 0) return [];

    // Step 1: Filter rows based on criteria
    const filtered = tableData.filter((row) => {
      // MASTER FILTERS - Applied FIRST
      // Master date range filter
      if (masterDateFrom || masterDateTo) {
        const fechaCompraHeader = headers.find(h => h.toLowerCase().includes('fecha de compra'));
        if (fechaCompraHeader) {
          const fechaValue = row[fechaCompraHeader];
          const rowDate = parseExcelDate(fechaValue);

          // When date filter is active, exclude rows without valid FECHA DE COMPRA
          if (!rowDate || isNaN(rowDate.getTime())) {
            return false;
          }

          if (masterDateFrom) {
            const fromDate = parseDDMMYYYY(masterDateFrom);
            if (fromDate && rowDate < fromDate) return false;
          }
          if (masterDateTo) {
            const toDate = parseDDMMYYYY(masterDateTo);
            if (toDate) {
              toDate.setHours(23, 59, 59, 999);
              if (rowDate > toDate) return false;
            }
          }
        }
      }

      // Master orden filter
      if (masterOrden) {
        const ordenHeader = headers.find(h => h.toLowerCase() === 'orden');
        if (ordenHeader) {
          const ordenValue = String(row[ordenHeader] || '').toLowerCase();
          if (!ordenValue.includes(masterOrden.toLowerCase())) return false;
        }
      }

      // Master tienda filter - match order to tienda using ordenToTiendaMap
      if (masterTienda && masterTienda !== 'all') {
        const ordenHeader = headers.find(h => h.toLowerCase() === 'orden');
        if (ordenHeader) {
          const ordenValue = String(row[ordenHeader] || '').replace(/^0+/, '') || '0';
          const rowTienda = ordenToTiendaMap.get(ordenValue);
          if (!rowTienda || rowTienda !== masterTienda) return false;
        }
      }

      // TAB-SPECIFIC FILTERS - Applied AFTER master filters
      // Date range filter
      if (dateFrom || dateTo) {
        const fechaCompraHeader = headers.find(h => h.toLowerCase().includes('fecha de compra'));
        if (fechaCompraHeader) {
          const fechaValue = row[fechaCompraHeader];
          const rowDate = parseExcelDate(fechaValue);

          // When date filter is active, exclude rows without valid FECHA DE COMPRA
          if (!rowDate || isNaN(rowDate.getTime())) {
            return false;
          }

          if (dateFrom) {
            const fromDate = parseDDMMYYYY(dateFrom);
            if (fromDate && rowDate < fromDate) return false;
          }
          if (dateTo) {
            const toDate = parseDDMMYYYY(dateTo);
            if (toDate) {
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

    // Step 2: Deduplicate by order number (keep last occurrence)
    const ordenHeader = headers.find(h => h.toLowerCase() === 'orden');
    if (!ordenHeader) return filtered;

    const ordersMap = new Map<string, any>();
    const rowsWithoutOrden: any[] = [];
    
    filtered.forEach((row) => {
      const ordenValue = String(row[ordenHeader] || '').trim();
      if (!ordenValue) {
        rowsWithoutOrden.push(row); // Keep rows without order number
      } else {
        ordersMap.set(ordenValue, row); // Overwrites previous, keeping last occurrence
      }
    });
    
    return [...Array.from(ordersMap.values()), ...rowsWithoutOrden];
  }, [tableData, headers, dateFrom, dateTo, ordenFilter, referenciaFilter, estadoCuotaFilter, masterDateFrom, masterDateTo, masterOrden, masterTienda, ordenToTiendaMap]);

  const handleExportOrders = async () => {
    if (filteredTableData.length === 0) {
      toast({
        title: "No hay datos para exportar",
        variant: "destructive",
      });
      return;
    }

    // Format data for export - convert all date fields to readable format
    const exportData = filteredTableData.map(row => {
      const formattedRow = { ...row };
      
      // Convert all date fields using parseExcelDate utility
      headers.forEach(header => {
        if (header.toLowerCase().includes('fecha') && formattedRow[header]) {
          const parsedDate = parseExcelDate(formattedRow[header]);
          if (parsedDate) {
            formattedRow[header] = parsedDate.toLocaleDateString('es-ES');
          }
        }
      });
      
      return formattedRow;
    });

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordenes");
    XLSX.writeFile(wb, `ordenes_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Archivo exportado",
      description: "Los datos se han descargado exitosamente",
    });
  };

  const clearMasterFilters = () => {
    setMasterDateFrom("");
    setMasterDateTo("");
    setMasterOrden("");
    setMasterTienda("all");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-7 w-7 text-primary" />
              <h1 className="tracking-tight text-[40px] font-extrabold">MatchIt</h1>
            </div>
            <div className="flex items-center gap-2">
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

          {/* Recalculating overlay - shown when recalculating installments after file upload */}
          {cachedData.isRecalculating && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="text-center p-6 bg-card border rounded-lg shadow-lg">
                <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
                <h3 className="text-lg font-semibold mb-2">Calculando...</h3>
                <p className="text-sm text-muted-foreground">Actualizando datos de cuotas y pagos</p>
              </div>
            </div>
          )}

          {!isProcessing && (
            <>
              {/* Hidden component to calculate filtered AllInstallments data for MonthlyReport */}
              {tableData.length > 0 && (
                <div style={{ display: 'none' }}>
                  <AllInstallments 
                    tableData={tableData}
                    showFilters={installmentsShowFilters}
                    setShowFilters={setInstallmentsShowFilters}
                    dateFrom={installmentsDateFrom}
                    setDateFrom={setInstallmentsDateFrom}
                    dateTo={installmentsDateTo}
                    setDateTo={setInstallmentsDateTo}
                    ordenFilter={installmentsOrdenFilter}
                    setOrdenFilter={setInstallmentsOrdenFilter}
                    estadoCuotaFilter={installmentsEstadoCuotaFilter}
                    setEstadoCuotaFilter={setInstallmentsEstadoCuotaFilter}
                    dateFieldFilter={installmentsDateFieldFilter}
                    setDateFieldFilter={setInstallmentsDateFieldFilter}
                    masterDateFrom={masterDateFrom}
                    masterDateTo={masterDateTo}
                    onFilteredInstallmentsChange={setFilteredInstallmentsData}
                    masterOrden={masterOrden}
                    masterTienda={masterTienda}
                    ordenToTiendaMap={ordenToTiendaMap}
                    preProcessedScheduleInstallments={processedInstallmentsData.scheduleInstallments}
                    preProcessedPaymentInstallments={processedInstallmentsData.paymentInstallments}
                  />
                </div>
              )}
              
              <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
                <MasterFilter
                  dateFrom={masterDateFrom}
                  dateTo={masterDateTo}
                  orden={masterOrden}
                  tienda={masterTienda}
                  uniqueTiendas={uniqueTiendas}
                  onDateFromChange={setMasterDateFrom}
                  onDateToChange={setMasterDateTo}
                  onOrdenChange={setMasterOrden}
                  onTiendaChange={setMasterTienda}
                  onClearFilters={clearMasterFilters}
                />
              
              <div className="sticky top-[64px] z-20 bg-background pb-4">
                <TabsList data-testid="tabs-list">
                  <TabsTrigger value="upload" data-testid="tab-upload">
                    CARGAR DATOS
                  </TabsTrigger>
                  <TabsTrigger value="marketplace" data-testid="tab-marketplace">
                    MARKETPLACE ORDERS
                  </TabsTrigger>
                  <TabsTrigger value="all" data-testid="tab-all">
                    TODAS LAS ÓRDENES
                  </TabsTrigger>
                  <TabsTrigger value="cuotas" data-testid="tab-cuotas">
                    CUOTAS
                  </TabsTrigger>
                  <TabsTrigger value="banco" data-testid="tab-banco">
                    BANCO
                  </TabsTrigger>
                  <TabsTrigger value="payments" data-testid="tab-payments">
                    PAGO DE CUOTAS
                  </TabsTrigger>
                  <TabsTrigger value="weekly" data-testid="tab-weekly">
                    CONCILIACION DE CUOTAS
                  </TabsTrigger>
                  <TabsTrigger value="pagos" data-testid="tab-pagos">
                    CONCILIACION DE PAGOS
                  </TabsTrigger>
                  <TabsTrigger value="monthly-report" data-testid="tab-monthly-report">
                    REPORTE MENSUAL
                  </TabsTrigger>
                  <TabsTrigger value="ai-assistant" data-testid="tab-ai-assistant">
                    ASISTENTE AI
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="upload" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">
                    Cargar Archivos
                  </h2>
                  <p className="text-muted-foreground">
                    Selecciona los archivos Excel que deseas importar
                  </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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

                  {/* Marketplace Orders Upload Section */}
                  <div className="space-y-4">
                    <div className="bg-card border rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileSpreadsheet className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">Marketplace Orders</h3>
                          <p className="text-sm text-muted-foreground">
                            Archivo de órdenes de marketplace
                          </p>
                        </div>
                      </div>
                      {uploadMarketplaceMutation.isPending ? (
                        <div className="flex items-center justify-center py-8 border-2 border-dashed rounded-lg">
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">Procesando archivo...</p>
                          </div>
                        </div>
                      ) : (
                        <FileUpload
                          onFileSelect={handleMarketplaceFileSelect}
                          selectedFile={selectedMarketplaceFile}
                          onClearFile={handleClearMarketplaceFile}
                          onInvalidFile={handleInvalidFile}
                          inputId="file-upload-marketplace"
                        />
                      )}
                    </div>
                  </div>

                  {/* Bank Statement Upload Section */}
                  <div className="space-y-4">
                    <div className="bg-card border rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileSpreadsheet className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">Estado de Cuenta</h3>
                          <p className="text-sm text-muted-foreground">
                            Archivo de estado de cuenta bancario
                          </p>
                        </div>
                      </div>
                      {uploadBankMutation.isPending ? (
                        <div className="flex items-center justify-center py-8 border-2 border-dashed rounded-lg">
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">Procesando archivo...</p>
                          </div>
                        </div>
                      ) : (
                        <FileUpload
                          onFileSelect={handleBankFileSelect}
                          selectedFile={selectedBankFile}
                          onClearFile={handleClearBankFile}
                          onInvalidFile={handleInvalidFile}
                          inputId="file-upload-bank"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="all" className="space-y-4">
                <Suspense fallback={<TabLoader />}>
                {tableData.length > 0 ? (
                  <>
                    <Dashboard 
                      data={filteredTableData} 
                      allData={tableData} 
                      headers={headers} 
                      dateFrom={dateFrom} 
                      dateTo={dateTo}
                      masterDateFrom={masterDateFrom}
                      masterDateTo={masterDateTo}
                      masterOrden={masterOrden}
                      masterTienda={masterTienda}
                      ordenToTiendaMap={ordenToTiendaMap}
                    />
                    
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
                            <DatePicker
                              id="date-from"
                              value={dateFrom}
                              onChange={setDateFrom}
                              data-testid="input-date-from"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="date-to">Fecha Hasta</Label>
                            <DatePicker
                              id="date-to"
                              value={dateTo}
                              onChange={setDateTo}
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
                </Suspense>
              </TabsContent>

              <TabsContent value="cuotas" className="space-y-4">
                <Suspense fallback={<TabLoader />}>
                {tableData.length > 0 ? (
                  <CuotasTable 
                    tableData={tableData}
                    showFilters={cuotasShowFilters}
                    setShowFilters={setCuotasShowFilters}
                    dateFrom={cuotasDateFrom}
                    setDateFrom={setCuotasDateFrom}
                    dateTo={cuotasDateTo}
                    setDateTo={setCuotasDateTo}
                    ordenFilter={cuotasOrdenFilter}
                    setOrdenFilter={setCuotasOrdenFilter}
                    estadoFilter={cuotasEstadoFilter}
                    setEstadoFilter={setCuotasEstadoFilter}
                    masterDateFrom={masterDateFrom}
                    masterDateTo={masterDateTo}
                    masterOrden={masterOrden}
                    masterTienda={masterTienda}
                    ordenToTiendaMap={ordenToTiendaMap}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No hay datos de órdenes</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Carga un archivo desde la pestaña "CARGAR DATOS"
                    </p>
                  </div>
                )}
                </Suspense>
              </TabsContent>

              <TabsContent value="banco" className="space-y-4">
                <Suspense fallback={<TabLoader />}>
                <BankStatementsTable 
                  masterDateFrom={masterDateFrom}
                  masterDateTo={masterDateTo}
                  masterOrden={masterOrden}
                  masterTienda={masterTienda}
                  ordenToTiendaMap={ordenToTiendaMap}
                  preProcessedBankData={processedBankData}
                />
                </Suspense>
              </TabsContent>

              <TabsContent value="payments">
                <Suspense fallback={<TabLoader />}>
                <PaymentRecords 
                  showFilters={paymentsShowFilters}
                  setShowFilters={setPaymentsShowFilters}
                  dateFrom={paymentsDateFrom}
                  setDateFrom={setPaymentsDateFrom}
                  dateTo={paymentsDateTo}
                  setDateTo={setPaymentsDateTo}
                  ordenFilter={paymentsOrdenFilter}
                  setOrdenFilter={setPaymentsOrdenFilter}
                  referenciaFilter={paymentsReferenciaFilter}
                  setReferenciaFilter={setPaymentsReferenciaFilter}
                  masterDateFrom={masterDateFrom}
                  masterDateTo={masterDateTo}
                  masterOrden={masterOrden}
                  masterTienda={masterTienda}
                  ordenToTiendaMap={ordenToTiendaMap}
                />
                </Suspense>
              </TabsContent>

              <TabsContent value="weekly">
                <Suspense fallback={<TabLoader />}>
                {tableData.length > 0 ? (
                  <AllInstallments 
                    tableData={tableData}
                    showFilters={installmentsShowFilters}
                    setShowFilters={setInstallmentsShowFilters}
                    dateFrom={installmentsDateFrom}
                    setDateFrom={setInstallmentsDateFrom}
                    dateTo={installmentsDateTo}
                    setDateTo={setInstallmentsDateTo}
                    ordenFilter={installmentsOrdenFilter}
                    setOrdenFilter={setInstallmentsOrdenFilter}
                    estadoCuotaFilter={installmentsEstadoCuotaFilter}
                    setEstadoCuotaFilter={setInstallmentsEstadoCuotaFilter}
                    dateFieldFilter={installmentsDateFieldFilter}
                    setDateFieldFilter={setInstallmentsDateFieldFilter}
                    masterDateFrom={masterDateFrom}
                    masterDateTo={masterDateTo}
                    onFilteredInstallmentsChange={setFilteredInstallmentsData}
                    masterOrden={masterOrden}
                    masterTienda={masterTienda}
                    ordenToTiendaMap={ordenToTiendaMap}
                    preProcessedScheduleInstallments={processedInstallmentsData.scheduleInstallments}
                    preProcessedPaymentInstallments={processedInstallmentsData.paymentInstallments}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No hay datos de órdenes</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Carga un archivo desde la pestaña "CARGAR DATOS"
                    </p>
                  </div>
                )}
                </Suspense>
              </TabsContent>

              <TabsContent value="pagos">
                <Suspense fallback={<TabLoader />}>
                {tableData.length > 0 ? (
                  <ConciliacionPagosTable 
                    tableData={tableData}
                    showFilters={pagosShowFilters}
                    setShowFilters={setPagosShowFilters}
                    dateFrom={pagosDateFrom}
                    setDateFrom={setPagosDateFrom}
                    dateTo={pagosDateTo}
                    setDateTo={setPagosDateTo}
                    ordenFilter={pagosOrdenFilter}
                    setOrdenFilter={setPagosOrdenFilter}
                    estadoCuotaFilter={pagosEstadoCuotaFilter}
                    setEstadoCuotaFilter={setPagosEstadoCuotaFilter}
                    masterDateFrom={masterDateFrom}
                    masterDateTo={masterDateTo}
                    masterOrden={masterOrden}
                    masterTienda={masterTienda}
                    ordenToTiendaMap={ordenToTiendaMap}
                    preProcessedPaymentInstallments={processedInstallmentsData.paymentInstallments}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No hay datos de órdenes</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Carga un archivo desde la pestaña "CARGAR DATOS"
                    </p>
                  </div>
                )}
                </Suspense>
              </TabsContent>

              <TabsContent value="marketplace">
                <Suspense fallback={<TabLoader />}>
                {marketplaceData && (marketplaceData as any).data ? (
                  <MarketplaceOrdersTable 
                    data={(marketplaceData as any).data.rows}
                    headers={(marketplaceData as any).data.headers}
                    fileName={(marketplaceData as any).data.fileName}
                    showFilters={marketplaceShowFilters}
                    setShowFilters={setMarketplaceShowFilters}
                    dateFrom={marketplaceDateFrom}
                    setDateFrom={setMarketplaceDateFrom}
                    dateTo={marketplaceDateTo}
                    setDateTo={setMarketplaceDateTo}
                    estadoFilter={marketplaceEstadoFilter}
                    setEstadoFilter={setMarketplaceEstadoFilter}
                    ordenFilter={marketplaceOrdenFilter}
                    setOrdenFilter={setMarketplaceOrdenFilter}
                    estadoEntregaFilter={marketplaceEstadoEntregaFilter}
                    setEstadoEntregaFilter={setMarketplaceEstadoEntregaFilter}
                    referenciaFilter={marketplaceReferenciaFilter}
                    setReferenciaFilter={setMarketplaceReferenciaFilter}
                    masterDateFrom={masterDateFrom}
                    masterDateTo={masterDateTo}
                    masterOrden={masterOrden}
                    masterTienda={masterTienda}
                    uniqueTiendas={uniqueTiendas}
                    bankStatementRows={(bankStatementsData as any)?.data?.rows || []}
                    bankStatementHeaders={(bankStatementsData as any)?.data?.headers || []}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No hay datos de marketplace</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Carga un archivo de marketplace desde la pestaña "CARGAR DATOS"
                    </p>
                  </div>
                )}
                </Suspense>
              </TabsContent>

              <TabsContent value="monthly-report">
                <Suspense fallback={<TabLoader />}>
                <MonthlyReport 
                  marketplaceData={marketplaceData}
                  dateFrom={marketplaceDateFrom}
                  dateTo={marketplaceDateTo}
                  estadoFilter={marketplaceEstadoFilter}
                  ordenFilter={marketplaceOrdenFilter}
                  estadoEntregaFilter={marketplaceEstadoEntregaFilter}
                  referenciaFilter={marketplaceReferenciaFilter}
                  masterDateFrom={masterDateFrom}
                  masterDateTo={masterDateTo}
                  masterOrden={masterOrden}
                  masterTienda={masterTienda}
                  ordenToTiendaMap={ordenToTiendaMap}
                  ordersData={tableData}
                  paymentRecordsData={(paymentRecordsData as any)?.data?.rows || []}
                  paymentRecordsHeaders={(paymentRecordsData as any)?.data?.headers || []}
                  bankStatementRows={(bankStatementsData as any)?.data?.rows || []}
                  bankStatementHeaders={(bankStatementsData as any)?.data?.headers || []}
                  filteredInstallmentsData={filteredInstallmentsData}
                  filteredPagosMasterOnlyData={filteredPagosMasterOnlyData}
                  cuotasAdelantadasPeriodosAnteriores={cuotasAdelantadasPeriodosAnteriores}
                />
                </Suspense>
              </TabsContent>

              <TabsContent value="ai-assistant" className="h-[calc(100vh-200px)]">
                <Suspense fallback={<TabLoader />}>
                <AIAssistant />
                </Suspense>
              </TabsContent>
            </Tabs>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
