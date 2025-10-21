# Gestor de Cuotas - Sistema de Gestión de Pagos

## Descripción General
Aplicación web profesional para cargar y visualizar datos de órdenes de compra con pagos en cuotas. Permite importar archivos Excel y mostrar información detallada de hasta 14 cuotas de pago con sus estados, fechas y montos.

## Características Principales
- ✅ Carga de archivos Excel (.xlsx, .xls) mediante drag & drop o selección
- ✅ Validación de archivos en frontend (tipo y tamaño) antes de cargar
- ✅ Procesamiento robusto de archivos en el backend con manejo de errores
- ✅ Visualización en tabla con más de 60 columnas soportadas
- ✅ **Navegación por pestañas**: TODAS LAS ÓRDENES y CUOTAS SEMANAL
- ✅ **Vista semanal**: Muestra solo las cuotas programadas para la semana actual (lunes-domingo)
- ✅ **Resumen de ingresos**: Calcula ingresos esperados al viernes de la semana
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
- `WeeklyPayments`: Vista semanal con resumen de ingresos esperados
- `WeeklyPaymentsTable`: Tabla de cuotas de la semana con 5 columnas
- `PaymentRecords`: Componente para carga y visualización de registros de pagos
- `PaymentRecordsTable`: Tabla de registros de pago con 6 columnas y formato de monedas VES/USD
- `StatusBadge`: Badges de estado con colores semánticos
- `ThemeToggle`: Selector de tema con persistencia
- `ThemeProvider`: Contexto global de tema
- `EmptyState`: Estado vacío cuando no hay datos

### Utilidades
- `dateUtils.ts`: Funciones para cálculo de semanas, conversión de fechas Excel y formato
- `installmentUtils.ts`: Extracción y filtrado de cuotas desde formato ancho a largo

## API Endpoints

### POST /api/upload-excel
Procesa archivos Excel con datos de órdenes y cuotas, retorna datos estructurados con validación completa.

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

### POST /api/upload-payment-records
Procesa archivos Excel con registros de pagos realizados. **Acepta CUALQUIER encabezado** del archivo.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: FormData con campo 'file' conteniendo archivo Excel de pagos

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "headers": ["Columna1", "Columna2", "..."],
    "rows": [{ "Columna1": "valor1", "Columna2": "valor2", ... }],
    "fileName": "pagos.xlsx",
    "rowCount": 50
  }
}
```

**Características Especiales:**
- ✅ **Flexibilidad total**: Acepta cualquier nombre de columna del archivo Excel
- ✅ **Sin validación de encabezados**: No requiere columnas específicas
- ✅ **Retorna datos tal cual**: Headers y rows se retornan exactamente como están en el archivo
- ✅ **Auto-detección de moneda**: Frontend detecta columnas con "VES" o "USD" y las formatea automáticamente

**Error Responses:**
- 400: Archivo inválido, muy grande, vacío, o sin encabezados
- 500: Error inesperado al procesar

**Validaciones:**
- Tamaño máximo: 10MB
- Tipos permitidos: .xlsx, .xls
- Verifica existencia de hojas de cálculo
- Valida que existan encabezados (mínimo 1 columna)

## Sistema de Carga de Archivos

### Zonas de Carga Separadas
El sistema tiene **dos zonas de carga independientes** para prevenir confusión:

**Estado Inicial (Sin Datos Cargados):**
- Muestra 2 pestañas: **PAGO DE CUOTAS** (por defecto) y **ÓRDENES Y CUOTAS**
- Cada pestaña tiene su propia zona de carga claramente identificada
- **PAGO DE CUOTAS**: Zona de carga para archivos de registros de pagos (usa `/api/upload-payment-records`)
- **ÓRDENES Y CUOTAS**: Zona de carga para archivos de órdenes y cuotas programadas (usa `/api/upload-excel`)

**Estado con Datos de Órdenes Cargados:**
- Muestra 3 pestañas: **TODAS LAS ÓRDENES**, **CUOTAS SEMANAL**, **PAGO DE CUOTAS**
- Zona de carga principal visible solo para órdenes
- Pestaña PAGO DE CUOTAS mantiene su zona de carga independiente

### Flexibilidad en Archivos de Pagos
- **Acepta CUALQUIER encabezado** del archivo Excel de pagos
- **No requiere nombres específicos** de columnas
- **Auto-detección de monedas**: Columnas que contienen "VES" o "USD" en el encabezado se formatean automáticamente como moneda
- **Tabla dinámica**: Se ajusta automáticamente al número y nombres de columnas del archivo

## Vistas de la Aplicación

### 1. TODAS LAS ÓRDENES
Vista principal que muestra la tabla completa con todas las órdenes y sus columnas:
- **Columnas de orden**: Orden, Nombre del comprador, Venta total, Fecha de compra, Tipo orden, Estado pago inicial
- **Columnas de cuotas (1-14)**: Para cada cuota se muestran 5 columnas (Fecha cuota N, Cuota N, Pagado de cuota N, Estado cuota N, Fecha de pago cuota N)
- **Características**: Columnas fijas, scroll horizontal, formato automático
- **Fechas de pago**: Cuando el Estado cuota es "Done", se muestra la fecha de pago debajo del badge de estado

### 2. CUOTAS SEMANAL
Vista filtrada que muestra solo las cuotas programadas para la semana actual (lunes-domingo):
- **Resumen superior**: "Ingresos Esperados al [Viernes DD/MM/YYYY]: $X,XXX.XX"
- **Columnas**: Orden, Fecha Cuota, # de Cuota (1-14), Monto, Estado Cuota
- **Lógica**: Extrae las 14 cuotas de cada orden y filtra solo las que caen en la semana actual
- **Ordenamiento**: Por fecha de cuota, luego por orden

### 3. PAGO DE CUOTAS
Vista independiente para registrar y visualizar los pagos realizados:
- **Funcionalidad**: Carga de archivo Excel separado con registros de pagos
- **Columnas**: # Orden, # Cuota Pagada, Monto Pagado en VES, # Referencia, Monto Pagado en USD, Metodo de Pago
- **Formato de moneda**: VES (Bolívares) y USD (Dólares) con formato de moneda apropiado
- **Características**: Upload independiente, tabla simple de 6 columnas, exportación a Excel
- **Disponibilidad**: Accesible incluso sin datos de órdenes cargados

## Formato de Datos Esperado

### Archivo de Órdenes y Cuotas
El archivo Excel debe contener las siguientes columnas (en cualquier orden):
- **Orden**: ID o número de orden
- **Nombre del comprador**: Nombre del cliente
- **Venta total**: Monto total de la venta
- **Fecha de compra**: Fecha de la orden
- **Tipo orden**: Tipo de orden
- **Estado pago inicial**: Estado del pago inicial

Para cada cuota (1-14):
- **Fecha cuota N**: Fecha de vencimiento (puede ser número serial de Excel o texto DD/MM/YYYY)
- **Cuota N**: Monto de la cuota
- **Pagado de cuota N**: Monto pagado
- **Estado cuota N**: Estado (Pagado/Pendiente/Vencido)
- **Fecha de pago cuota N**: Fecha en que se realizó el pago (opcional, se muestra cuando Estado = Done)

### Archivo de Registros de Pagos
El archivo Excel debe contener las siguientes columnas (en cualquier orden):
- **# Orden**: Número de orden de compra
- **# Cuota Pagada**: Número de cuota que se pagó (1-14)
- **Monto Pagado en VES**: Monto pagado en Bolívares Venezolanos
- **# Referencia**: Número de referencia de la transacción
- **Monto Pagado en USD**: Monto pagado en Dólares Estadounidenses
- **Metodo de Pago**: Método de pago utilizado (Transferencia, Efectivo, etc.)

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

## Lógica de Negocio

### Conversión de Fechas Excel
- **Excel serial numbers**: Convierte correctamente números seriales de Excel a fechas
- **Época base**: 31 de diciembre de 1899 (serial 1 = 1 de enero de 1900)
- **Corrección de bug de Excel**: Compensa el error de año bisiesto 1900 (resta 1 día para serials >= 60)
- **Formatos soportados**: Serial numbers, DD/MM/YYYY, ISO dates

### Cálculo de Semana Actual
- **Inicio de semana**: Lunes a las 00:00:00
- **Fin de semana**: Domingo a las 23:59:59.999
- **Viernes**: Usado para mostrar "Ingresos Esperados al [fecha]"
- **Filtrado**: Compara timestamps para determinar si una cuota cae en la semana actual

### Extracción de Cuotas
1. **Formato ancho**: Archivo Excel tiene 14 cuotas por fila (56 columnas de cuotas)
2. **Formato largo**: Se convierte a una fila por cuota para facilitar filtrado
3. **Validación**: Solo se incluyen cuotas que tienen fecha o monto

## Convenciones de Código
- Componentes funcionales con hooks
- TypeScript estricto para type safety
- Componentes reutilizables en `/components`
- Utilidades en `/lib`
- Páginas en `/pages`
- Estilos con Tailwind CSS y sistema de tokens de diseño
- Test IDs en elementos interactivos para testing
- Manejo de errores exhaustivo en backend y frontend
- Memoización con `useMemo` para optimizar cálculos costosos

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
