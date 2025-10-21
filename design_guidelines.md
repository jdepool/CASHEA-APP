# Design Guidelines: Payment Installment Tracker

## Design Approach
**System-Based Approach** - This is a utility-focused, data-intensive financial application. Drawing inspiration from modern data tools like Linear, Notion tables, and Airtable, prioritizing clarity, professionalism, and data readability over decorative elements.

## Core Design Elements

### A. Color Palette

**Light Mode:**
- Background: 0 0% 100% (white)
- Surface: 210 20% 98% (light gray)
- Border: 214 15% 91% (subtle borders)
- Text Primary: 222 47% 11% (near black)
- Text Secondary: 215 16% 47% (muted gray)
- Primary: 217 91% 60% (professional blue)
- Success: 142 71% 45% (green for "Pagado")
- Warning: 38 92% 50% (amber for pending)
- Error: 0 72% 51% (red for overdue)

**Dark Mode:**
- Background: 222 47% 11%
- Surface: 217 19% 18%
- Border: 217 10% 25%
- Text Primary: 210 20% 98%
- Text Secondary: 215 14% 71%
- Primary: 217 91% 60%
- Success: 142 71% 45%
- Warning: 38 92% 50%
- Error: 0 72% 51%

### B. Typography
- **Primary Font:** Inter (Google Fonts) - excellent for data tables
- **Headings:** 600-700 weight, tracking-tight
- **Body Text:** 400 weight for readability
- **Table Headers:** 600 weight, text-sm, uppercase tracking-wide
- **Table Data:** 400 weight, text-sm for dense information
- **Numerical Data:** Tabular numbers (font-variant-numeric: tabular-nums) for alignment

### C. Layout System
- **Container:** max-w-7xl for main content
- **Spacing Scale:** Use 2, 4, 6, 8, 12, 16 consistently
  - Component padding: p-6 to p-8
  - Section spacing: gap-4 to gap-6
  - Table cell padding: px-4 py-3
- **Grid:** Not applicable - primarily table-based layout

### D. Component Library

**Upload Zone:**
- Large dropzone with dashed border (border-2 border-dashed)
- Upload icon (cloud upload from Heroicons)
- Hover state with subtle background change
- File type indicator (.xlsx, .xls)
- Drag-over visual feedback

**Data Table:**
- Sticky header row with subtle shadow
- Alternating row colors (zebra striping) for readability
- Fixed first column (Orden number) for reference while scrolling
- Horizontal scroll with visible scrollbar for 60+ columns
- Cell borders: subtle (border-gray-200 dark:border-gray-700)
- Compact row height for data density (h-10 to h-12)

**Status Badges:**
- Pill-shaped badges for payment status
- Color-coded: Green (Pagado), Amber (Pendiente), Red (Vencido)
- Small size, medium font weight

**Navigation Bar:**
- Clean header with app title "Gestor de Cuotas"
- Dark mode toggle
- Upload button in top-right

**Empty States:**
- Centered icon and text when no file uploaded
- Clear call-to-action button

### E. Interactions
- Minimal animations - focus on instant responsiveness
- Button hover: subtle background darkening
- Table row hover: light background highlight
- File upload: progress indicator if needed
- No scroll-based animations

## Specific Implementation Notes

**Table Considerations:**
- Freeze "Orden" and "Nombre del comprador" columns for context
- Group cuota columns visually (subtle background variation every 2-3 installments)
- Right-align numerical columns (Venta total, Cuota amounts, Pagado amounts)
- Date formatting: DD/MM/YYYY
- Currency formatting: Include $ symbol, thousands separator

**Responsive Strategy:**
- Desktop (lg+): Full table with horizontal scroll
- Tablet (md): Maintain table structure, smaller font sizes
- Mobile: Card-based view stacking key information vertically

**Professional Polish:**
- Export functionality button (CSV/Excel)
- Search/filter capability for buyer names
- Sort columns by clicking headers
- Summary statistics row at bottom (totals, averages)

## Images
Not applicable - this is a data utility application without hero images or decorative graphics. Focus is entirely on functional UI elements and clear data presentation.