# Gestor de Cuotas - Sistema de Gestión de Pagos

## Overview
This project is a professional web application for managing purchase orders with installment payments. It allows users to import Excel data for orders, payments, and marketplace orders, visualize detailed installment information, and track statuses, dates, and amounts. The system provides a weekly payments overview, ensures data persistence via PostgreSQL, and includes an AI-powered assistant with RAG capabilities for natural language queries in Spanish. The system aims to offer a robust, user-friendly tool for efficient installment plan management, improving cash flow visibility and reducing manual data handling.

## User Preferences
- I prefer clear and detailed explanations.
- Please ask for confirmation before implementing significant changes.
- I value a clean, professional, and responsive UI/UX.
- Ensure that data persistence is a top priority; no data should be lost on refresh or navigation.
- I need the application to handle flexible Excel formats for payment records, auto-detecting currency and adjusting table columns dynamically.

## System Architecture
The application employs a client-server architecture with a React frontend and an Express.js backend.

**UI/UX Decisions**:
- **Design System**: Professional and clean UI using Tailwind CSS and Shadcn UI.
- **Theming**: Dark/light mode toggle with persistence.
- **Layout**: Tabbed navigation for core functionalities.
- **Data Presentation**: Dashboards for key metrics, DataTables with sticky headers, WeeklyPaymentsTable, PaymentRecordsTable with dynamic columns, and semantic colored badges for statuses. Toast notifications, animated spinners, and clear empty states provide user feedback.

**Technical Implementations**:
- **Frontend**: React with TypeScript, React Query for data fetching, Wouter for routing, and SheetJS for client-side Excel handling.
- **Backend**: Express.js server, Drizzle ORM for PostgreSQL, Multer for file uploads, SheetJS for server-side Excel processing, and OpenAI API for AI assistant.
- **Database**: PostgreSQL (Neon-backed) with `orders`, `payment_records`, `marketplace_orders`, `bank_statements`, and `embeddings` tables. Data stored as JSONB, managed by `drizzle-kit`. Pgvector extension enabled for RAG capabilities.
- **AI/ML**: OpenAI API with text-embedding-3-small for embeddings and GPT-4-turbo-preview for chat completions. Custom RAG implementation with semantic similarity search.

**Feature Specifications**:
- **File Upload**: Drag & drop or selection with client-side and backend validation for orders, payments, and marketplace orders.
- **Data Persistence & Duplication Handling**: All data is saved to PostgreSQL; new uploads replace existing orders by `Orden` number, and payment records update based on `(# Orden, # Cuota Pagada, # Referencia)`.
- **Master Filter System**: Global filtering (date range, order number) applies across all main tabs (`MARKETPLACE ORDERS`, `TODAS LAS ÓRDENES`, `CUOTAS`, `PAGO DE CUOTAS`, `CONCILIACION DE CUOTAS`, `CONCILIACION DE PAGOS`, `REPORTE MENSUAL`) before tab-specific filters. Filters persist across tabs and have clear/active indicators. ALL dashboards across ALL tabs respect master filters for consistent data filtering.
- **TODAS LAS ÓRDENES Dashboard**: Shows comprehensive order metrics including active orders, sales amounts, payments, pending balances, cancelled orders, and period-based installment counts. Dashboard prioritizes master filters (masterDateFrom, masterDateTo, masterOrden) over tab-specific filters for all calculations, ensuring consistent filtering across the application. Period-based metrics (# Cuotas del Periodo, Cuentas por Cobrar) respect master order filter in addition to date filters.
- **Installments View (`CONCILIACION DE CUOTAS`)**: Displays installments with collapsible filters and an `InstallmentsDashboard`. Includes a `STATUS` column with five categories (ADELANTADO, A TIEMPO, ATRASADO, OTRO ALIADO, NO DEPOSITADO) and a sortable `VERIFICACION` column for bank statement matching. Dashboard shows "Depósitos Otros Aliados" metric (total MONTO for STATUS=OTRO ALIADO + VERIFICACION=SI installments) that updates based on active filters.
- **Payment-based Installments View (`CONCILIACION DE PAGOS`)**: Displays installments filtered by payment date (Fecha de Pago) rather than scheduled date. Shows only payment-based entries with collapsible filters and a `ConciliacionPagosDashboard`. Dashboard displays "Cuotas Adelantadas" metric (sum of MONTO where STATUS=ADELANTADO) that updates based on master + local filters.
- **Payment Records View (`PAGO DE CUOTAS`)**: Uploads and views payment transactions with flexible columns, auto-detection of currencies, a dashboard with seven key metrics, and an automatic `VERIFICACION` column indicating bank statement matches. Dashboard includes "Pagos No Verificados" card showing total amount and count of payments with VERIFICACION = NO (counts all records regardless of amount validity, sums only valid amounts). Verification logic uses shared utilities (`verificationUtils.ts`) including reference normalization (case-insensitive, remove spaces/leading zeros), 8-digit partial matching (handles prefixes like "18" in bank refs), and dual-currency amount tolerance (±$0.01, inclusive).
- **Bank Statements View (`BANCO`)**: Displays bank statement data with flexible schema, complete replacement on upload with automatic deduplication by reference number (keeps last occurrence), column sorting, Excel export, master filter support, and a collapsible filter panel for `Referencia`. Includes automatic `CONCILIADO` column (after Saldo) showing "SI" (green badge) when bank transaction matches any payment record, "NO" (secondary badge) otherwise. Uses reverse lookup against ALL payment records (not filtered) with 8-digit partial reference matching and ±$0.01 amount tolerance.
- **Cuotas View (`CUOTAS`)**: Displays installments vertically with collapsible filters (date range, order, status), and a period-based dashboard showing `CUOTAS DEL PERIODO` (count of filtered cuotas) and `CUENTAS POR COBRAR` (sum of filtered cuotas' amounts). Dashboard respects ALL filters (both master and tab-specific) and updates dynamically. Supports tri-state column sorting and Excel export.
- **Marketplace Orders View (`MARKETPLACE ORDERS`)**: Displays marketplace order data with flexible schema, complete replacement on upload, sorting, Excel export, and collapsible filters for `Estado`, `Orden`, `Estado de Entrega`, and `# Referencia`.
- **AI Assistant View (`ASISTENTE AI`)**: Natural language query interface powered by OpenAI GPT-4 with RAG (Retrieval-Augmented Generation) capabilities:
  * **RAG System**: Uses pgvector extension for PostgreSQL to store and search embeddings of system documentation and business rules
  * **Knowledge Base**: 12 Spanish-language documents covering database schema, business rules, status meanings, verification logic, filters, calculations, views, SQL examples, deduplication, and date handling
  * **Query Processing**: Retrieves relevant context via semantic similarity search, generates SQL queries safely (read-only SELECT statements only), executes against database, and provides Spanish-language responses
  * **Chat Interface**: Conversational UI with message history, quick action buttons (monthly report, payment trends, bank reconciliation), loading states, and SQL query display
  * **Safety Features**: Validates all SQL queries to prevent INSERT/UPDATE/DELETE operations, only allows SELECT statements, includes error handling and timeout protection
  * **Technology**: OpenAI text-embedding-3-small for embeddings, GPT-4-turbo-preview for chat completions, cosine similarity for context retrieval
- **Monthly Report View (`REPORTE MENSUAL`)**: Displays dynamic financial summary metrics and bank reconciliation calculations:
  * **Summary Metrics**: `Ventas Totales`, `Monto Pagado en Caja`, `Monto Financiado`, `Porcentaje Financiado` (calculated from marketplace order data)
  * **Bank Reconciliation (Conciliación Bancaria)**: Five deduction metrics and net calculation:
    - `Recibido en Banco`: Sum of payment amounts where VERIFICACION = SI (bank verified)
    - `Cuotas adelantadas de clientes (corresponde a otro periodo)`: Sum of schedule-based installments with ADELANTADO status (uses scheduled cuota dates), calculated using master filters only
    - `Pago inicial de clientes en App`: Sum of verified cuota 0 payments (Pago Inicial Depositado)
    - `Devoluciones por errores de pago`: Currently 0 (user-specified placeholder)
    - `Depositos de otros aliados`: Sum of payments for installments with STATUS=OTRO ALIADO (payment exists but no scheduled cuota date) AND VERIFICACION=SI (bank verified)
    - `Banco neto`: Formula = Recibido - Cuotas adelantadas - Pago inicial - Devoluciones - Depositos otros aliados
  * **Accounts Receivable (Cuentas por Cobrar)**: Shows installments due in period minus advanced payments:
    - `Cuentas por Cobrar`: Sum of installment amounts within date period
    - `Cuotas adelantadas en periodos anteriores`: Sum of payment-based installments with ADELANTADO status (uses payment transaction dates), calculated using master filters only
    - `Cuentas por Cobrar Neto`: Formula = Cuentas por Cobrar - Cuotas adelantadas en periodos anteriores
  * All metrics respect master filters and update dynamically
- **Data Export**: Exports current table views to Excel.
- **Table Sorting**: All major tables support column sorting.
- **Date Handling**: Automatic conversion of Excel serial dates and various date formats.
- **Installment Extraction**: Converts wide-format Excel data to long format, supporting "Cuota 0" and generating synthetic installments.
- **Column Mapping**: Flexible header mapping for display names.
- **Dynamic Dashboard Metrics**: All dashboard metrics update in real-time based on active filters.

**System Design Choices**:
- **Robust Error Handling**: Comprehensive validation with clear user feedback.
- **Separation of Concerns**: Clear distinction between frontend and backend.
- **Modularity**: Reusable components and utility functions.
- **Locale-aware Number Parsing**: Handles various numeric formats and separators.
- **Empty Row Filtering**: Filters empty rows during uploads.
- **Scientific Notation Prevention**: Converts reference numbers from scientific notation to full numbers, both server-side and client-side, within safe numeric limits.
- **Shared Verification Utilities**: Centralized matching logic in `client/src/lib/verificationUtils.ts` provides consistent verification for both payment→bank (VERIFICACION column) and bank→payment (CONCILIADO column) lookups. Supports 8-digit partial reference matching, ±$0.01 amount tolerance (inclusive), and proper handling of zero-valued amounts.
- **Shared Dashboard Data Architecture**: 
  * REPORTE MENSUAL and CONCILIACION DE CUOTAS share identical filtered installments data via a hidden AllInstallments component
  * REPORTE MENSUAL and CONCILIACION DE PAGOS use shared calculation utilities but different datasets: CONCILIACION DE PAGOS uses master+local filtered data (via AllPagosInstallments with local filters), while REPORTE MENSUAL uses master-filter-only data (via separate AllPagosInstallments instance with empty local filters)
  * This ensures dashboard metrics in CONCILIACION DE PAGOS update based on tab-specific filters while REPORTE MENSUAL metrics remain consistent using only master filters
  * Shared utility functions (`calculateDepositosOtrosBancos`, `calculateCuotasAdelantadas`) in `installmentUtils.ts` provide consistent calculations across all views
- **Tab-Switch Performance Optimization**:
  * Heavy installment processing (extracting, matching, enriching with payment data) is performed ONCE at the Home.tsx level via `processedInstallmentsData` useMemo
  * Pre-processed data is passed as props to AllInstallments and ConciliacionPagosTable components
  * This prevents expensive recalculations when components remount on tab switch
  * Schedule-based installments (from orders file enriched with payment data) and payment-based installments (from payment records) are both pre-computed
  * React Query hooks use staleTime: Infinity to prevent unnecessary refetches
- **Deduplication Strategy**: 
  * Backend deduplicates during upload (removes duplicate order numbers before storing)
  * Database merge operation deduplicates when combining new uploads with existing data
  * Frontend applies deduplication at three levels as a defensive measure:
    - When loading data from database (in useEffect)
    - After file upload when refetching data (in processFile)
    - In TODAS LAS ORDENES tab filtering logic (defensive final layer)
  * All tabs receive deduplicated data: TODAS LAS ORDENES, CUOTAS, CONCILIACION DE CUOTAS, CONCILIACION DE PAGOS, and REPORTE MENSUAL
  * REPORTE MENSUAL uses deduplicated `tableData` for all financial calculations ensuring accurate metrics without inflated values from duplicate orders
  * BANCO tab deduplicates bank statements by reference number on both backend upload and frontend display (keeps last occurrence)
  * Deduplication keeps first occurrence of each unique order number for orders, last occurrence for bank statements

## External Dependencies
- **Database**: PostgreSQL (Neon).
- **Frontend Libraries**: React, Tailwind CSS, Shadcn UI, SheetJS (xlsx), Wouter, React Query.
- **Backend Libraries**: Express.js, Drizzle ORM, Multer, SheetJS (xlsx), OpenAI API.
- **AI/ML**: OpenAI API (OPENAI_API_KEY required as environment variable).