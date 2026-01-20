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
import { verifyInPaymentRecords } from "@/lib/verificationUtils";
import { generateDataHash, shouldUpdateStatuses, updateTimeBasedStatuses, getCacheMetadata, invalidateCacheWithNewHash, saveCacheWithHash } from "@/lib/cacheUtils";

// Loading fallback for lazy-loaded tab components
const TabLoader = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="ml-2 text-muted-foreground">Cargando...</span>
  </div>
);

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPaymentFile, setSelectedPaymentFile] = useState<File | null>(null);
  const [selectedMarketplaceFile, setSelectedMarketplaceFile] = useState<File | null>(null);
  const [selectedBankFile, setSelectedBankFile] = useState<File | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
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

    // Enrich with payment data
    // NOTE: Multi-cuota payments (e.g., "1,2") should match ALL cuotas in the list
    // We don't use matchedPaymentIndices because the same payment can apply to multiple cuotas
    if (hasPaymentData) {
      scheduleInstallments = scheduleInstallments.map((installment) => {
        // Find ANY payment that matches this order AND includes this cuota number
        const matchingPayment = paymentRows.find((payment: any) => {
          const paymentOrder = String(payment['# Orden'] || payment['#Orden'] || payment['Orden'] || '').trim();
          const paymentInstallmentStr = String(payment['# Cuota Pagada'] || payment['#CuotaPagada'] || payment['Cuota'] || '').trim();
          
          const orderMatches = paymentOrder === String(installment.orden).trim();
          
          if (paymentInstallmentStr && orderMatches) {
            const cuotaParts = paymentInstallmentStr.split(',').map((s: string) => s.trim());
            for (const part of cuotaParts) {
              const parsed = parseInt(part, 10);
              if (!isNaN(parsed) && parsed === installment.numeroCuota) {
                return true;
              }
            }
          }
          return false;
        });

        if (matchingPayment) {
          
          const fechaTasaCambio = matchingPayment['Fecha de Transaccion'] ||
                                  matchingPayment['FECHA DE TRANSACCION'] ||
                                  matchingPayment['Fecha de Transacción'] ||
                                  matchingPayment['FECHA DE TRANSACCIÓN'];
          
          const parsedDate = fechaTasaCambio ? parseExcelDate(fechaTasaCambio) : null;
          
          if (parsedDate) {
            const verificacion = matchingPayment['VERIFICACION'] || '-';
            return { 
              ...installment, 
              fechaPagoReal: parsedDate,
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
        }
        return installment;
      });
    }

    // Create payment-based installments
    const paymentInstallments: any[] = [];
    
    if (hasPaymentData) {
      paymentRows.forEach((payment: any) => {
        const paymentOrder = String(payment['# Orden'] || payment['#Orden'] || payment['Orden'] || '').trim();
        const paymentInstallment = String(payment['# Cuota Pagada'] || payment['#CuotaPagada'] || payment['Cuota'] || '').trim();
        const montoPagado = payment['Monto Pagado en USD'] || payment['MONTO PAGADO EN USD'] || payment['Monto'] || 0;
        
        const fechaTasaCambio = payment['Fecha de Transaccion'] ||
                                payment['FECHA DE TRANSACCION'] ||
                                payment['Fecha de Transacción'] ||
                                payment['FECHA DE TRANSACCIÓN'];
        
        const parsedDate = fechaTasaCambio ? parseExcelDate(fechaTasaCambio) : null;
        
        if (paymentOrder) {
          const cuotaNumbers: number[] = [];
          
          if (paymentInstallment) {
            const cuotaParts = paymentInstallment.split(',').map((s: string) => s.trim());
            for (const part of cuotaParts) {
              const parsed = parseInt(part, 10);
              if (!isNaN(parsed)) {
                cuotaNumbers.push(parsed);
              }
            }
          }
          
          if (cuotaNumbers.length === 0) {
            cuotaNumbers.push(-1);
          }
          
          const referencia = payment['# Referencia'] || payment['#Referencia'] || payment['Referencia'] || '';
          const verificacion = payment['VERIFICACION'] || '-';
          const numberOfCuotas = cuotaNumbers.filter(n => n !== -1).length || 1;
          
          cuotaNumbers.forEach((cuotaNum) => {
            // For multi-cuota payments, use the scheduled amount for each cuota if available
            const matchingScheduleInstallment = scheduleInstallments.find(
              inst => String(inst.orden).trim() === paymentOrder && inst.numeroCuota === cuotaNum
            );
            
            // Use scheduled amount if available, otherwise divide payment equally
            const splitAmount = matchingScheduleInstallment?.monto || (montoPagado / numberOfCuotas);
            
            paymentInstallments.push({
              orden: paymentOrder,
              numeroCuota: cuotaNum,
              monto: splitAmount,
              fechaCuota: matchingScheduleInstallment?.fechaCuota || null,
              fechaPagoReal: parsedDate,
              isPaymentBased: true,
              paymentDetails: {
                referencia,
                metodoPago: payment['Método de Pago'] || payment['Metodo de Pago'] || payment['MÉTODO DE PAGO'],
                montoPagadoUSD: montoPagado,
                montoPagadoVES: payment['Monto Pagado en VES'] || payment['MONTO PAGADO EN VES'],
                tasaCambio: payment['Tasa de Cambio'] || payment['TASA DE CAMBIO']
              },
              verificacion,
              scheduledAmount: matchingScheduleInstallment?.monto
            });
          });
        }
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

  // Pre-process bank statements with CONCILIADO values ONCE to avoid recalculation on tab switch
  // Uses deferred values to allow React to interrupt for user interactions
  const processedBankData = useMemo(() => {
    const bankApiData = deferredBankStatementsData as any;
    const paymentApiData = deferredPaymentRecordsData as any;
    
    if (!bankApiData?.data?.rows || !bankApiData?.data?.headers) {
      return { headers: [], rows: [], extendedHeaders: [] };
    }
    
    const bankHeaders = bankApiData.data.headers;
    const rawBankRows = bankApiData.data.rows;
    const paymentHeaders = paymentApiData?.data?.headers || [];
    const paymentRows = paymentApiData?.data?.rows || [];
    
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
    
    // Create extended headers with CONCILIADO after Saldo
    const saldoIndex = bankHeaders.findIndex((h: string) => h.toLowerCase().includes('saldo'));
    let extendedHeaders: string[];
    if (saldoIndex === -1) {
      extendedHeaders = [...bankHeaders, 'CONCILIADO'];
    } else {
      extendedHeaders = [...bankHeaders];
      extendedHeaders.splice(saldoIndex + 1, 0, 'CONCILIADO');
    }
    
    // Find column headers for CONCILIADO calculation
    const debeHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('debe'));
    const haberHeader = bankHeaders.find((h: string) => h.toLowerCase().includes('haber'));
    
    // Add CONCILIADO values to each row
    const rowsWithConciliado = bankRows.map((row: any) => {
      const bankRef = referenciaHeader ? row[referenciaHeader] : null;
      const debeAmount = debeHeader ? row[debeHeader] : null;
      const haberAmount = haberHeader ? row[haberHeader] : null;
      
      const conciliadoValue = verifyInPaymentRecords(
        bankRef,
        debeAmount,
        haberAmount,
        paymentRows,
        paymentHeaders
      );
      
      return { ...row, CONCILIADO: conciliadoValue };
    });
    
    return { 
      headers: bankHeaders, 
      rows: rowsWithConciliado, 
      extendedHeaders 
    };
  }, [deferredBankStatementsData, deferredPaymentRecordsData]);

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
  }, [uploadBankMutation]);

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
