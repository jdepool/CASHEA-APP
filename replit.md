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
- **Layout**: Tabbed navigation for `CARGAR DATOS`, `TODAS LAS ÓRDENES`, `CONCILIACION DE CUOTAS`, `PAGO DE CUOTAS`, and `MARKETPLACE ORDERS`.
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
- **Installments View (`CONCILIACION DE CUOTAS`)**: Displays all installments with collapsible filters (date range, order, status, date field selector: "Fecha de Pago" vs. "Fecha Cuota") and an `InstallmentsDashboard` showing status-based and total metrics.
- **Payment Records View (`PAGO DE CUOTAS`)**: Allows uploading and viewing payment transactions with flexible columns, auto-detection/formatting of currencies, and a dashboard. Highlights partial payments and supports multi-installment payments.
- **Marketplace Orders View (`MARKETPLACE ORDERS`)**: Displays marketplace order data with flexible schema, complete replacement on upload, sorting, and Excel export.
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