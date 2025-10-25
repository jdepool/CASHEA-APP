# Gestor de Cuotas - Sistema de Gestión de Pagos

## Overview
This project is a professional web application designed to manage purchase orders with installment payments. It allows users to import Excel files containing order and payment data, visualize detailed information for up to 14 payment installments, track their statuses, dates, and amounts. The system also supports importing separate payment records, offers a weekly payments view with expected income, and ensures data persistence through a PostgreSQL database.

**Business Vision**: To provide a robust, user-friendly tool for businesses to efficiently track and manage their installment payment plans, improving cash flow visibility and reducing manual data handling.

## User Preferences
- I prefer clear and detailed explanations.
- Please ask for confirmation before implementing significant changes.
- I value a clean, professional, and responsive UI/UX.
- Ensure that data persistence is a top priority; no data should be lost on refresh or navigation.
- I need the application to handle flexible Excel formats for payment records, auto-detecting currency and adjusting table columns dynamically.

## System Architecture
The application follows a client-server architecture with a React frontend and an Express.js backend.

**UI/UX Decisions**:
- **Design System**: Professional and clean UI using Tailwind CSS for styling and Shadcn UI for accessible components.
- **Theming**: Dark/light mode toggle with persistence using `localStorage`.
- **Layout**: Tabbed navigation (`CARGAR DATOS`, `TODAS LAS ÓRDENES`, `CONCILIACION DE CUOTAS`, `PAGO DE CUOTAS`) for clear separation of concerns.
- **Data Presentation**:
    - `Dashboard` showing key metrics at the top of TODAS LAS ÓRDENES:
        - **Órdenes Activas**: Count of orders with outstanding payments (saldo > $0.01)
        - **Monto de Ventas**: Sum of all "Venta total" values
        - **Pagos Recibidos**: Sum of "PAGO INICIAL" + all "Pagado de cuota N" values
        - **Saldo Pendiente**: Total sales minus total payments received
    - `DataTable` for displaying main order data with over 60 columns, sticky headers, and horizontal scroll.
    - `WeeklyPaymentsTable` (reused in AllInstallments) for displaying all installments with filtering.
    - `PaymentRecordsTable` for payment transaction records, dynamically adjusting to input columns.
    - Semantic colored badges (`StatusBadge`) for payment statuses (Paid/Pending/Overdue).
- **User Feedback**: Toast notifications for user actions and error messages, animated spinners for loading states, and clear empty states.

**Technical Implementations**:
- **Frontend**:
    - **Framework**: React with TypeScript.
    - **State Management**: React Query for data fetching and caching.
    - **Routing**: Wouter.
    - **Excel Handling**: SheetJS (xlsx) for client-side import/export.
- **Backend**:
    - **Server**: Express.js.
    - **Database ORM**: Drizzle ORM for type-safe interaction with PostgreSQL.
    - **File Upload**: Multer for secure and efficient file handling.
    - **Excel Parsing**: SheetJS (xlsx) for server-side Excel processing.
- **Database**:
    - **Provider**: PostgreSQL (Neon-backed).
    - **Schema**:
        - `orders`: Stores processed order and installment data (headers and rows as JSONB).
        - `payment_records`: Stores payment transaction data (headers and rows as JSONB).
    - **Migrations**: Handled via `drizzle-kit` (`npm run db:push`).

**Feature Specifications**:
- **File Upload**: Drag & drop or file selection with client-side validation (type, size). Separate upload zones for orders and payment records.
    - **File Type Validation**: Backend validates that files contain the expected headers before processing:
        - Orders zone requires: "Orden" + ("Venta total" OR installment columns) and rejects payment-specific headers
        - Payments zone requires: payment headers ("Fecha de Transaccion"/"# Orden"/"# Cuota Pagada") and rejects order-specific headers
        - Clear error messages guide users to the correct upload zone if wrong file type is detected
- **Data Persistence**: All uploaded and processed data automatically saved to PostgreSQL. Data is reloaded automatically on app start.
- **Duplicate Handling**: 
    - **Orders**: Uploading orders with existing Order Numbers (Orden) replaces the old data with new data. Unique identifier: `Orden`
    - **Payment Records**: Uploading payment records **updates** existing records based on the combination of Order Number (# Orden), Installment Number (# Cuota Pagada), AND Reference Number (# Referencia). This allows multiple payment records for the same order and installment if they have different reference numbers. Unique identifier: `(# Orden, # Cuota Pagada, # Referencia)`
    - **Duplicate Detection**: Records with duplicate (Order#, Installment#, Reference#) within the same upload file are skipped (only the first occurrence is processed). Different reference numbers for the same Order# + Installment# are kept as separate records.
    - **User Feedback**: Toast notifications show detailed statistics for each upload (X nuevos, Y actualizados, Z omitidos, Total in database)
- **Installments View**: `CONCILIACION DE CUOTAS` tab shows all installments with filtering and dashboard:
    - **All Dates**: Displays all installments (not limited to current week)
    - **Collapsible Filters**: Date range (from-to), Orden, Estado Cuota with toggle button
    - **InstallmentsDashboard**: Shows 6 metrics in two sections that update based on active filters:
        - **Status-Based Metrics** (4 cards with count + amount):
            - **Cuotas Pagadas**: Count and total amount of installments with status "Done"
            - **Cuotas Programadas**: Count and total amount of installments with status "Scheduled" + "Graced"
            - **Cuotas Atrasadas**: Count and total amount of installments with status "Delayed"
            - **Cuotas Canceladas**: Count and total amount of installments with status "Cancelled"
        - **Total Metrics** (2 cards):
            - **Total Cuotas**: Count of all filtered installments
            - **Monto Total**: Sum of all filtered installment amounts
    - **Date Prioritization**: Payment date from payment records > payment date from order file > scheduled installment date
    - Shows "X de Y cuotas" count when filters are active
    - One-click "Limpiar filtros" button to reset all filters
- **Payment Records View**: `PAGO DE CUOTAS` tab allows uploading and viewing payment transaction files with flexible column headers and auto-detection/formatting of 'VES' and 'USD' currency columns.
    - **Payment Records Dashboard**: Shows 2 key metrics that update based on active filters:
        - **Total Cuotas Pagadas**: Count of unique installments paid, handling multi-installment payments (e.g., "4,5,6" counts as 3 cuotas) and split payments (same order + same cuota = 1 cuota)
        - **Total Pagado**: Sum of "Monto Pagado en USD" across filtered records
    - **Partial Payment Detection**: Payment records are compared against expected installment amounts from the orders data. Rows where the paid amount is less than the expected amount (by more than $0.25) are highlighted in **red bold text** for easy identification.
    - **Multi-Installment Payments**: Supports comma-separated cuota values (e.g., "4,5") where a single payment covers multiple installments. Expected amounts are summed for comparison.
    - **Currency Formatting**: All currency values are parsed using locale-aware number normalization and displayed using proper currency formatting (es-ES locale).
- **Data Export**: Export current table view to Excel.
- **Date Handling**: Automatic conversion of Excel serial dates and various date formats (DD/MM/YYYY, ISO).
- **Installment Extraction**: Converts wide-format Excel installment data into a long format for easier processing and filtering.
- **Column Mapping**: Flexible header mapping system allows display names to differ from Excel column names:
    - "PAGO INICIAL" column maps to "Pago en Caja" from uploaded Excel files
    - Positioned between "Tipo Orden" and "Estado Pago Inicial"
    - Formatted as currency (USD) with right alignment
- **Filtering**: All three main tabs (TODAS LAS ÓRDENES, CONCILIACION DE CUOTAS, PAGO DE CUOTAS) feature collapsible filter panels with toggle buttons:
    - TODAS LAS ÓRDENES: Date range, Orden, Referencia, Estado Cuota
        - **"Solo activas" Toggle**: Button that filters out fully paid orders (saldo ≤ $0.01), showing only orders with outstanding payments
        - Button text changes: "Solo activas" → "Mostrar todas" when active
        - Visual feedback: default variant when active, outline when inactive
    - CONCILIACION DE CUOTAS: Date range, Orden, Estado Cuota (dropdown)
    - PAGO DE CUOTAS: Date range, Orden, # Referencia
    - Shows "X de Y registros/cuotas" count with active filters
    - One-click "Limpiar filtros" button to reset all filters
- **Dynamic Dashboard Metrics**: Dashboard updates in real-time based on active filters
    - Metrics reflect filtered data only, not all data
    - Works with all filter types: date range, orden, referencia, estado cuota, and "solo activas" toggle
    - Provides accurate financial visibility for filtered subsets of orders

**System Design Choices**:
- **Robust Error Handling**: Comprehensive validation on both frontend (file type, size) and backend (file structure, headers, parsing errors) with clear user feedback.
- **Separation of Concerns**: Clear distinction between frontend and backend responsibilities.
- **Modularity**: Use of reusable components and utility functions (`dateUtils.ts`, `installmentUtils.ts`, `numberUtils.ts`).
- **Locale-aware Number Parsing**: Created `shared/numberUtils.ts` with intelligent number normalization that handles:
    - Multiple separator formats (US: 1,200.50, European: 1.200,50)
    - Ambiguous cases with 3 digits after separator: Only treats as thousand separator if value ≥ 100 (e.g., "100.200" → 100,200 but "57.375" → 57.375)
    - Invalid values return NaN instead of silent coercion to 0
    - Used consistently across backend (duplicate detection) and frontend (display, comparison)
- **Empty Row Filtering**: Both orders and payment records uploads now filter out empty rows (rows without "Orden" or "# Orden" respectively) to prevent Excel phantom rows from inflating record counts

## External Dependencies
- **Database**: PostgreSQL (specifically Neon for serverless capabilities).
- **Frontend Libraries**:
    - React
    - Tailwind CSS
    - Shadcn UI
    - SheetJS (xlsx)
    - Wouter
    - React Query
- **Backend Libraries**:
    - Express.js
    - Drizzle ORM
    - Multer
    - SheetJS (xlsx)