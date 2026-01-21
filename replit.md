# Gestor de Cuotas - Sistema de Gestión de Pagos

## Overview
This project is a professional web application designed for comprehensive management of purchase orders with installment payments. It streamlines the process by allowing users to import financial data from Excel, including orders, payments, and marketplace transactions. The system provides detailed visualizations of installment information, tracks payment statuses, dates, and amounts, and offers a weekly overview of payments. Its core purpose is to enhance cash flow visibility, reduce manual data entry, and offer an efficient, robust tool for managing installment plans. A key feature is an AI-powered assistant with RAG capabilities, enabling natural language queries in Spanish for deeper insights into the data.

## User Preferences
- I prefer clear and detailed explanations.
- Please ask for confirmation before implementing significant changes.
- I value a clean, professional, and responsive UI/UX.
- Ensure that data persistence is a top priority; no data should be lost on refresh or navigation.
- I need the application to handle flexible Excel formats for payment records, auto-detecting currency and adjusting table columns dynamically.

## System Architecture
The application is built on a client-server architecture, utilizing React for the frontend and Express.js for the backend.

**UI/UX Decisions**:
The user interface is designed for a professional and clean aesthetic, employing Tailwind CSS and Shadcn UI. It includes features like a dark/light mode toggle with persistence, tabbed navigation for core functionalities, and clear data presentation through dashboards, DataTables with sticky headers, and semantic colored badges for status indicators. User feedback is provided via toast notifications, animated spinners, and explicit empty states.

**Technical Implementations**:
The frontend is developed with React and TypeScript, leveraging React Query for efficient data fetching, Wouter for routing, and SheetJS for client-side Excel processing. The backend, powered by Express.js, uses Drizzle ORM for PostgreSQL integration, Multer for file uploads, and SheetJS for server-side Excel handling. The OpenAI API is integrated for the AI assistant. Data is persistently stored in a PostgreSQL database (Neon-backed) using various tables for orders, payment records, marketplace orders, bank statements, embeddings, and cache data. The pgvector extension is enabled for RAG capabilities.

**Feature Specifications**:
Key functionalities include file upload with validation for various data types, robust data persistence with intelligent duplication handling, and a master filter system that applies globally across all main tabs for consistent data filtering. Dashboards provide comprehensive metrics for orders, installments, and payments. Specialized views like `CONCILIACION DE CUOTAS` (Installments View) and `CONCILIACION DE PAGOS` (Payment-based Installments View) offer detailed financial reconciliation. The `PAGO DE CUOTAS` (Payment Records View) handles flexible payment transaction uploads with auto-detection and verification against bank statements. The `BANCO` (Bank Statements View) allows bank statement uploads, deduplication, and automatic reconciliation with payment records. The `ASISTENTE AI` (AI Assistant View) provides a natural language query interface with RAG capabilities, using OpenAI's GPT models and a PostgreSQL knowledge base for semantic similarity searches and safe SQL query generation. A `REPORTE MENSUAL` (Monthly Report View) delivers dynamic financial summaries and bank reconciliation calculations. All major tables support sorting and data export to Excel. The system features advanced date handling, installment extraction logic, flexible column mapping, and dynamic dashboard metric updates based on active filters.

**System Design Choices**:
The architecture emphasizes robust error handling, clear separation of concerns, and modularity through reusable components. It includes locale-aware number parsing, empty row filtering, and scientific notation prevention for numerical data. Shared verification utilities ensure consistent matching logic across payment and bank reconciliation processes. A shared dashboard data architecture and performance optimizations (e.g., pre-processing heavy data, using React Query with `staleTime: Infinity`) prevent redundant calculations and ensure smooth tab switching. A comprehensive deduplication strategy is implemented at multiple levels (backend, database merge, frontend) for orders, payments, and bank statements. A caching infrastructure with dedicated database tables and API endpoints is in place for efficient data sharing and cache invalidation, making pre-calculated data accessible to other applications.

**Partial Payment Handling**:
When a cuota is paid in parts across multiple payments (e.g., Payment 1 covers Cuota 1 + part of Cuota 2, then Payment 2 covers rest of Cuota 2 + Cuota 3), the system uses a "first reference only" strategy:
1. The first payment reference encountered for each cuota is stored and used for bank reconciliation
2. Bank verification status is inherited from that first payment's reference
3. Duplicate payment installments are avoided by creating only one entry per unique cuota
4. Status values used: DONE (paid on time), DELAYED (paid late), VENCIDO (overdue), PENDIENTE (pending)

## External Dependencies
- **Database**: PostgreSQL (Neon).
- **Frontend Libraries**: React, Tailwind CSS, Shadcn UI, SheetJS (xlsx), Wouter, React Query.
- **Backend Libraries**: Express.js, Drizzle ORM, Multer, SheetJS (xlsx), OpenAI API.
- **AI/ML**: OpenAI API (requires `OPENAI_API_KEY` environment variable).