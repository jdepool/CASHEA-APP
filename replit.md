# Gestor de Cuotas - Sistema de Gestión de Pagos

## Overview
This project is a professional web application for managing purchase orders with installment payments. It enables users to import Excel data for orders, payments, and marketplace orders, visualize detailed installment information (up to 14 payments), track statuses, dates, and amounts. The system provides a weekly payments overview, ensures data persistence via PostgreSQL, and aims to offer a robust, user-friendly tool for efficient installment plan management, improving cash flow visibility and reducing manual data handling.

## User Preferences
- I prefer clear and detailed explanations.
- Please ask for confirmation before implementing significant changes.
- I value a clean, professional, and responsive UI/UX.
- Ensure that data persistence is a top priority; no data should be lost on refresh or navigation.
- I need the application to handle flexible Excel formats for payment records, auto-detecting currency and adjusting table columns dynamically.

## System Architecture
The application employs a client-server architecture, utilizing a React frontend and an Express.js backend.

**UI/UX Decisions**:
- **Design System**: Professional and clean UI with Tailwind CSS and Shadcn UI.
- **Theming**: Dark/light mode toggle with persistence.
- **Layout**: Tabbed navigation for `CARGAR DATOS`, `MARKETPLACE ORDERS`, `TODAS LAS ÓRDENES`, `CUOTAS`, `PAGO DE CUOTAS`, `CONCILIACION DE CUOTAS`, and `REPORTE MENSUAL`.
- **Data Presentation**: Dashboards displaying key metrics (e.g., active orders, total sales, pending balance), DataTables with sticky headers and horizontal scroll for main order data, WeeklyPaymentsTable for installments, and PaymentRecordsTable with dynamic column adjustment. Semantic colored badges are used for payment statuses.
- **User Feedback**: Toast notifications, animated spinners for loading, and clear empty states.

**Technical Implementations**:
- **Frontend**: React with TypeScript, React Query for data fetching, Wouter for routing, and SheetJS for client-side Excel handling.
- **Backend**: Express.js server, Drizzle ORM for PostgreSQL interaction, Multer for file uploads, and SheetJS for server-side Excel processing.
- **Database**: PostgreSQL (Neon-backed) with `orders`, `payment_records`, and `marketplace_orders` tables storing data as JSONB, managed by `drizzle-kit` for migrations.

**Feature Specifications**:
- **File Upload**: Drag & drop or file selection with client-side and backend validation for file types and expected headers for orders, payments, and marketplace orders.
- **Data Persistence**: All processed data is automatically saved to PostgreSQL and reloaded on app start.
- **Duplicate Handling**: Orders are replaced by new uploads based on `Orden` number. Payment records update based on `(# Orden, # Cuota Pagada, # Referencia)`, allowing multiple payments for the same installment if reference numbers differ.
- **Master Filter System**: Global filtering that applies across all tabs before tab-specific filters:
    - **Location**: Displayed above all tabs in a distinct card with primary border and "Filtro Master" label
    - **Filter Fields**: 
        - **Desde/Hasta** (Date Range): Two date picker fields for filtering by date ranges
        - **Orden**: Text input for filtering by order number (case-insensitive substring match)
    - **Filter Hierarchy**: Master filters apply FIRST to all data, then tab-specific filters apply on the already-filtered data
    - **Persistence**: Master filter values persist when switching between tabs
    - **Visual Indicator**: Shows "Activo" badge when any master filter is set
    - **Clear Functionality**: "Limpiar filtros" button clears all master filter fields (Desde, Hasta, Orden)
    - **Scope**: Applies to all six main tabs (MARKETPLACE ORDERS, TODAS LAS ÓRDENES, CUOTAS, PAGO DE CUOTAS, CONCILIACION DE CUOTAS, REPORTE MENSUAL)
    - **Date Field Mapping**: Each tab uses appropriate date fields (fechaCuota for cuotas, fechaPago for payments, transaction date for payment records, etc.)
- **Installments View (`CONCILIACION DE CUOTAS`)**: Displays all installments with collapsible filters (date range, order, status, date field selector: "Fecha de Pago" vs. "Fecha Cuota") and an `InstallmentsDashboard` showing status-based and total metrics.
    - **STATUS Column**: Categorizes payment timing with five statuses:
        - **ADELANTADO** (blue badge): Payment made at least 15 days before due date AND cuota month is after payment month
        - **A TIEMPO** (green badge): Payment made within 2 days of due date (before or after) OR payment early but not meeting ADELANTADO criteria
        - **ATRASADO** (red badge): Payment made more than 2 days after the due date
        - **OTRO ALIADO** (purple badge): Payment exists but there is no due date (fecha de cuota)
        - **NO DEPOSITADO** (orange badge): Order status is DONE but there is no payment received (no fecha de pago)
    - **STATUS Sorting**: Click STATUS column header to sort by: No status → ADELANTADO → A TIEMPO → ATRASADO → OTRO ALIADO → NO DEPOSITADO
- **Payment Records View (`PAGO DE CUOTAS`)**: Allows uploading and viewing payment transactions with flexible columns, auto-detection/formatting of currencies, and a dashboard. Highlights partial payments and supports multi-installment payments.
- **Cuotas View (`CUOTAS`)**: Displays all installments vertically with collapsible filters (date range, order, status) and period-based dashboard metrics:
    - **Filter State Persistence**: All filter state managed in Home.tsx parent component, persists when switching between tabs
    - **Collapsible Filters**: Date range (Desde/Hasta), order number text filter, and status dropdown (Todas, Done, Pendiente, Vencido)
    - **Period Dashboard**: Appears when date range is specified, showing:
        - **CUOTAS DEL PERIODO**: Count of all cuotas (1-14) with due dates in the specified period (excludes Cuota 0/PAGO INICIAL)
        - **CUENTAS POR PAGAR**: Total amount of all cuotas (1-14) with due dates in the specified period (excludes Cuota 0/PAGO INICIAL)
    - **Tri-state Column Sorting**: All columns sortable with visual indicators (none → ascending → descending → none)
    - **Excel Export**: Exports filtered cuotas with all columns
    - **Note**: Only counts regular installments (Cuotas 1-14), excluding initial payment (Cuota 0)
- **Marketplace Orders View (`MARKETPLACE ORDERS`)**: Displays marketplace order data with flexible schema, complete replacement on upload, sorting, Excel export, and comprehensive filtering.
    - **Collapsible Filters**: Toggle button to show/hide filter panel with four filter fields:
        - **Estado**: Dropdown filter for payment status
        - **Orden**: Text input filter for order number
        - **Estado de Entrega**: Dropdown filter for delivery status
        - **# Referencia**: Text input filter for reference number
    - **Combined Filtering**: All filters work together for precise data filtering
    - **Filtered Count Display**: Shows "X de Y registros" when filters are active
    - **Clear Filters**: One-click button to reset all filters
    - **Flexible Column Detection**: Uses case-insensitive matching to find columns (e.g., "estado pago", "# orden")
- **Monthly Report View (`REPORTE MENSUAL`)**: Displays financial summary metrics calculated from marketplace order data:
    - **Dynamic Metrics**: All metrics update in real-time based on the same filters applied in the MARKETPLACE ORDERS tab
    - **Ventas Totales (incluye IVA)**: Sum of "Total USD" column from filtered marketplace data
    - **Monto Pagado en Caja**: Sum of "Pago Inicial USD" column from filtered marketplace data
    - **Monto Financiado**: Calculated as `Ventas Totales - Monto Pagado en Caja`
    - **Porcentaje Financiado**: Calculated as `(Monto Financiado / Ventas Totales) * 100`
    - **Filter Synchronization**: Uses the same date range, estado, orden, estado de entrega, and referencia filters as MARKETPLACE ORDERS
    - **Currency Formatting**: Values displayed with Spanish number formatting (comma as thousand separator, period as decimal)
    - **Empty State**: Shows prompt to upload marketplace data when no data is available
- **Data Export**: Export current table view to Excel.
- **Table Sorting**: All major tables support column sorting with visual indicators.
- **Date Handling**: Automatic conversion of Excel serial dates and various date formats.
- **Installment Extraction**: Converts wide-format Excel installment data to long format, supporting "Cuota 0" (initial payments) with specific amount and status columns, using "FECHA DE COMPRA" as a fallback for scheduled dates, and generating synthetic installments for payment records without matching order installments.
- **Column Mapping**: Flexible header mapping for display names, e.g., "PAGO INICIAL" maps to "Pago en Caja", and "STATUS ORDEN" maps to "Estado Orden".
- **Filtering**: All main tabs include collapsible filter panels with specific filter options (date range, order, reference, status), including a "Solo activas" toggle for orders.
- **Dynamic Dashboard Metrics**: All dashboard metrics update in real-time based on active filters.

**System Design Choices**:
- **Robust Error Handling**: Comprehensive frontend and backend validation with clear user feedback.
- **Separation of Concerns**: Clear distinction between frontend and backend.
- **Modularity**: Reusable components and utility functions (`dateUtils.ts`, `installmentUtils.ts`, `numberUtils.ts`).
- **Locale-aware Number Parsing**: `shared/numberUtils.ts` handles various numeric formats and separators, used consistently across the application.
- **Empty Row Filtering**: Filters out empty rows during uploads to prevent inaccurate record counts.

## External Dependencies
- **Database**: PostgreSQL (Neon).
- **Frontend Libraries**: React, Tailwind CSS, Shadcn UI, SheetJS (xlsx), Wouter, React Query.
- **Backend Libraries**: Express.js, Drizzle ORM, Multer, SheetJS (xlsx).