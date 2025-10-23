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
- **Layout**: Tabbed navigation (`TODAS LAS ÓRDENES`, `CUOTAS SEMANAL`, `PAGO DE CUOTAS`) for clear separation of concerns.
- **Data Presentation**:
    - `DataTable` for displaying main order data with over 60 columns, sticky headers, and horizontal scroll.
    - `WeeklyPaymentsTable` for a summarized view of weekly installments.
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
- **Weekly View**: `CUOTAS SEMANAL` tab filters installments for the current week (Monday-Sunday) and calculates "expected income" to Friday.
    - **Hybrid Filtering Logic**: Paid installments appear in the week they were *effectively paid*; unpaid installments appear in their *scheduled week*.
    - **Date Prioritization**: Payment date from payment records > payment date from order file > scheduled installment date.
- **Payment Records View**: `PAGO DE CUOTAS` tab allows uploading and viewing payment transaction files with flexible column headers and auto-detection/formatting of 'VES' and 'USD' currency columns.
    - **Partial Payment Detection**: Payment records are compared against expected installment amounts from the orders data. Rows where the paid amount is less than the expected amount (by more than $0.25) are highlighted in **red bold text** for easy identification.
    - **Multi-Installment Payments**: Supports comma-separated cuota values (e.g., "4,5") where a single payment covers multiple installments. Expected amounts are summed for comparison.
    - **Currency Formatting**: All currency values are parsed using locale-aware number normalization and displayed using proper currency formatting (es-ES locale).
- **Data Export**: Export current table view to Excel.
- **Date Handling**: Automatic conversion of Excel serial dates and various date formats (DD/MM/YYYY, ISO).
- **Installment Extraction**: Converts wide-format Excel installment data into a long format for easier processing and filtering.

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