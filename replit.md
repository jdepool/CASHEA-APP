# Gestor de Cuotas - Sistema de Gestión de Pagos

## Descripción General
Aplicación web profesional para cargar y visualizar datos de órdenes de compra con pagos en cuotas. Permite importar archivos Excel y mostrar información detallada de hasta 14 cuotas de pago con sus estados, fechas y montos.

## Características Principales
- ✅ Carga de archivos Excel (.xlsx, .xls) mediante drag & drop o selección
- ✅ Validación de archivos en frontend (tipo y tamaño) antes de cargar
- ✅ Procesamiento robusto de archivos en el backend con manejo de errores
- ✅ Visualización en tabla con más de 60 columnas soportadas
- ✅ Columnas fijas (Orden y Nombre del comprador) para fácil navegación
- ✅ Formato automático de fechas (DD/MM/YYYY), monedas (USD) y estados
- ✅ Badges de estado con colores semánticos (Pagado/Pendiente/Vencido)
- ✅ Exportación de datos a Excel con un clic
- ✅ Modo oscuro/claro con persistencia en localStorage
- ✅ Diseño responsive con scroll horizontal
- ✅ Notificaciones toast para feedback del usuario
- ✅ Estados de carga y vacío bien definidos

## Estructura del Proyecto

### Frontend
- **React** con TypeScript
- **Tailwind CSS** para estilos profesionales
- **Shadcn UI** para componentes accesibles
- **SheetJS (xlsx)** para importación/exportación de Excel
- **Wouter** para routing
- **React Query** para gestión de estado

### Backend
- **Express.js** servidor HTTP
- **Multer** para carga segura de archivos
- **SheetJS (xlsx)** para parseo de Excel en servidor
- Validación robusta con manejo de errores específicos

### Componentes Principales
- `FileUpload`: Componente de carga con validación y drag & drop
- `DataTable`: Tabla optimizada con sticky columns y formato automático
- `StatusBadge`: Badges de estado con colores semánticos
- `ThemeToggle`: Selector de tema con persistencia
- `ThemeProvider`: Contexto global de tema
- `EmptyState`: Estado vacío cuando no hay datos

## API Endpoints

### POST /api/upload-excel
Procesa archivos Excel y retorna datos estructurados con validación completa.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: FormData con campo 'file' conteniendo archivo Excel

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "headers": ["Orden", "Nombre del comprador", ...],
    "rows": [{ "Orden": "001", ... }],
    "fileName": "ordenes.xlsx",
    "rowCount": 150
  }
}
```

**Error Responses:**
- 400: Archivo inválido, muy grande, vacío, o sin encabezados
- 500: Error inesperado al procesar

**Validaciones:**
- Tamaño máximo: 10MB
- Tipos permitidos: .xlsx, .xls
- Verifica existencia de hojas de cálculo
- Valida encabezados presentes

## Formato de Datos Esperado
El archivo Excel debe contener las siguientes columnas (en cualquier orden):
- **Orden**: ID o número de orden
- **Nombre del comprador**: Nombre del cliente
- **Venta total**: Monto total de la venta
- **Fecha de compra**: Fecha de la orden
- **Tipo orden**: Tipo de orden
- **Estado pago inicial**: Estado del pago inicial

Para cada cuota (1-14):
- **Fecha cuota N**: Fecha de vencimiento
- **Cuota N**: Monto de la cuota
- **Pagado de cuota N**: Monto pagado
- **Estado cuota N**: Estado (Pagado/Pendiente/Vencido)

## Validación y Manejo de Errores

### Frontend
- Validación de extensión de archivo (.xlsx, .xls)
- Validación de tamaño (máximo 10MB)
- Toast notifications para errores claros
- Reset de input después de selección para permitir re-selección

### Backend
- Manejo específico de errores de Multer (tamaño, tipo)
- Validación de estructura del workbook
- Validación de hojas de cálculo
- Validación de encabezados
- Respuestas HTTP apropiadas (4xx para errores del cliente, 5xx para errores del servidor)

## Experiencia de Usuario

### Estados
1. **Estado vacío**: Muestra mensaje y zona de carga
2. **Cargando**: Spinner animado durante procesamiento
3. **Datos cargados**: Tabla completa con todas las funcionalidades
4. **Error**: Notificación toast descriptiva

### Interacciones
- Drag & drop de archivos
- Click para seleccionar archivo
- Clear file con botón X
- Toggle de tema persistente
- Export a Excel
- Scroll horizontal en tabla con sticky columns
- Hover effects en filas de tabla

## Convenciones de Código
- Componentes funcionales con hooks
- TypeScript estricto para type safety
- Componentes reutilizables en `/components`
- Páginas en `/pages`
- Estilos con Tailwind CSS y sistema de tokens de diseño
- Test IDs en elementos interactivos para testing
- Manejo de errores exhaustivo en backend y frontend

## Desarrollo
```bash
npm run dev
```

Inicia servidor Express (backend) y Vite (frontend) en el mismo puerto (5000).

## Estado del Proyecto
✅ **Producción ready** - Aplicación completa y funcional con:
- Validación robusta de archivos
- Manejo de errores completo
- UX optimizada con feedback claro
- Diseño profesional y responsive
- Código limpio y mantenible
