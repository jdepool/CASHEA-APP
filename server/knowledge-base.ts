export const knowledgeBase = [
  {
    section: "esquema_base_datos",
    category: "tablas",
    content: `
# Esquema de Base de Datos - Gestor de Cuotas

## Tabla: orders (Órdenes)
Almacena información de órdenes de compra con planes de pago en cuotas.

Columnas principales:
- Orden: Número único de la orden
- Cliente: Nombre del cliente
- Vendedor: Vendedor asignado
- Fecha compra / Fecha de compra: Fecha en que se realizó la compra
- Total: Monto total de la orden
- Cuota 0: Pago inicial (enganche)
- Cuota 1, Cuota 2, ..., Cuota N: Montos de cada cuota programada
- Fecha Cuota 1, Fecha Cuota 2, ..., Fecha Cuota N: Fechas programadas para cada pago de cuota
- Estado Cuota 1, Estado Cuota 2, ..., Estado Cuota N: Estado de cada cuota (Pagado, Pendiente, etc.)
- Pago en Caja / PAGO INICIAL: Monto del pago inicial realizado

La tabla almacena los datos en formato JSONB con headers y rows.
`,
  },
  {
    section: "esquema_base_datos",
    category: "tablas",
    content: `
## Tabla: payment_records (Registros de Pago / Pago de Cuotas)
Almacena las transacciones de pago realizadas por los clientes.

Columnas principales:
- Orden / # Orden: Número de la orden asociada
- Cuota Pagada / # Cuota Pagada: Número de cuota que se pagó (0 = pago inicial, 1,2,3... = cuotas)
- Referencia / # Referencia: Número de referencia de la transacción bancaria
- Fecha de Pago: Fecha en que se realizó el pago
- Monto (USD): Monto pagado en dólares
- Monto (BS): Monto pagado en bolívares (opcional)
- VERIFICACION: Columna automática que indica si el pago fue verificado contra el estado de cuenta bancario (SI/NO)

Cada registro representa una transacción individual de pago de cuota.
`,
  },
  {
    section: "esquema_base_datos",
    category: "tablas",
    content: `
## Tabla: bank_statements (Estado de Cuenta Bancario / BANCO)
Almacena las transacciones del estado de cuenta bancario.

Columnas principales:
- Fecha: Fecha de la transacción bancaria
- Referencia: Número de referencia de la transacción
- Monto / Débito / Crédito: Monto de la transacción
- Descripción / Concepto: Descripción de la transacción
- Saldo: Saldo después de la transacción
- CONCILIADO: Columna automática que indica si la transacción bancaria coincide con algún pago registrado (SI/NO)

Esta tabla se reemplaza completamente en cada carga y se deduplicada automáticamente por número de referencia.
`,
  },
  {
    section: "esquema_base_datos",
    category: "tablas",
    content: `
## Tabla: marketplace_orders (Órdenes de Marketplace)
Almacena información de órdenes del marketplace.

Columnas principales:
- Orden: Número de orden del marketplace
- Estado: Estado de la orden (Cancelado, Completado, etc.)
- Estado de Entrega: Estado del envío
- Referencia / # Referencia: Número de referencia
- Total Venta: Monto total de la venta
- PAGO INICIAL / Pago en Caja: Monto del pago inicial
- Monto Financiado: Monto que se financió en cuotas

Esta tabla se usa para generar métricas del reporte mensual.
`,
  },
  {
    section: "reglas_negocio",
    category: "estados_cuotas",
    content: `
# Estados de Cuotas - Clasificación y Significado

## ADELANTADO
Una cuota está ADELANTADA cuando:
- El cliente pagó una cuota antes de su fecha programada
- Se compara la fecha de pago contra la fecha programada de esa cuota
- Ejemplo: Cuota 3 programada para 15/Nov pero pagada el 5/Nov

Impacto financiero:
- Son pagos recibidos que corresponden a otro período contable
- Se deben restar del "Banco neto" en el reporte mensual
- Se consideran "Cuotas adelantadas de clientes (corresponde a otro periodo)"

## A TIEMPO
Una cuota está A TIEMPO cuando:
- El pago se realizó en la fecha programada o dentro del período de gracia
- La fecha de pago coincide con la fecha programada de la cuota

## ATRASADO
Una cuota está ATRASADA cuando:
- El pago se realizó después de la fecha programada
- O la fecha programada ya pasó y aún no se ha registrado el pago
- Indica morosidad del cliente

## OTRO ALIADO
Una cuota tiene estado OTRO ALIADO cuando se cumple CUALQUIERA de estas condiciones:

**Condición 1 - Pago sin cuota programada:**
- Existe un registro de pago (en payment_records) pero NO existe una fecha programada correspondiente en la orden
- Esto ocurre cuando un pago se registra pero no hay una cuota programada que coincida
- Indica pagos de otros vendedores o aliados comerciales

**Condición 2 - Pago no verificado en banco:**
- Existe un registro de pago Y existe una fecha programada en la orden
- Pero el pago tiene VERIFICACION = NO (no se encontró en el estado de cuenta bancario)
- Indica que el pago reportado no se pudo confirmar en el banco

Impacto financiero:
- Se consideran "Depósitos de otros aliados"
- Se deben restar del "Banco neto" en conciliación bancaria
- Incluye tanto pagos sin cuota programada como pagos no verificados bancariamente

## NO DEPOSITADO
Una cuota está NO DEPOSITADA cuando:
- Existe una fecha programada (cuota esperada) pero no hay registro de pago
- La cuota aún no ha sido pagada por el cliente
- Representa cuentas por cobrar pendientes
`,
  },
  {
    section: "reglas_negocio",
    category: "verificacion",
    content: `
# Sistema de Verificación - Matching de Pagos con Banco

## VERIFICACION (en Pago de Cuotas)
Indica si un registro de pago coincide con una transacción en el estado de cuenta bancario.

Valores posibles:
- SI: El pago fue encontrado en el estado de cuenta bancario
- NO: El pago NO fue encontrado en el banco

Criterios de matching:
1. Número de referencia: Se compara normalizando (sin espacios, mayúsculas/minúsculas, sin ceros iniciales)
2. Matching parcial de 8 dígitos: Se buscan coincidencias de los últimos 8 dígitos
3. Tolerancia de monto: ±$0.01 USD (inclusive)
4. Montos cero: Se consideran válidos para verificación

Importancia:
- Los pagos con VERIFICACION=NO pueden indicar:
  * Error en el número de referencia
  * Pago no procesado por el banco
  * Diferencias en montos
  * Estado de cuenta bancario incompleto

## CONCILIADO (en Estado de Cuenta Bancario)
Indica si una transacción bancaria coincide con algún registro de pago.

Valores posibles:
- SI: La transacción bancaria coincide con un pago registrado
- NO: La transacción NO coincide con ningún pago

Criterios: Los mismos que VERIFICACION (búsqueda reversa)

Importancia:
- Transacciones bancarias con CONCILIADO=NO pueden indicar:
  * Depósitos no registrados en el sistema
  * Pagos de otros aliados
  * Errores de registro
`,
  },
  {
    section: "reglas_negocio",
    category: "filtros",
    content: `
# Sistema de Filtros - Master Filters y Filtros Locales

## Master Filters (Filtros Maestros)
Se aplican a TODAS las pestañas del sistema:

1. **masterDateFrom / masterDateTo**: Rango de fechas maestro
   - Filtra por fechas de cuota programada en vistas de cuotas
   - Filtra por fecha de pago en vistas de pagos
   - Se aplica ANTES de los filtros locales

2. **masterOrden**: Filtro por número de orden
   - Filtra todas las vistas para mostrar solo una orden específica
   - Se aplica a orders, payment_records, installments

## Filtros Locales (por Pestaña)
Cada pestaña puede tener sus propios filtros adicionales:

- **CUOTAS**: dateFrom, dateTo, ordenFilter, statusFilter
- **PAGO DE CUOTAS**: dateFrom, dateTo, ordenFilter, referenciaFilter
- **CONCILIACION DE CUOTAS**: dateFrom, dateTo, ordenFilter, statusFilter
- **CONCILIACION DE PAGOS**: dateFrom, dateTo, ordenFilter, statusFilter
- **BANCO**: referenciaFilter
- **MARKETPLACE ORDERS**: estadoFilter, ordenFilter, estadoEntregaFilter, referenciaFilter

Orden de aplicación:
1. Primero se aplican los Master Filters
2. Luego se aplican los Filtros Locales de cada pestaña
3. Los dashboards respetan TODOS los filtros activos
`,
  },
  {
    section: "reglas_negocio",
    category: "calculos",
    content: `
# Cálculos del Reporte Mensual

## Métricas de Ventas (desde marketplace_orders)
1. **Ventas Totales**: Suma de Total Venta de todas las órdenes no canceladas
2. **Monto Pagado en Caja**: Suma de PAGO INICIAL de órdenes no canceladas
3. **Monto Financiado**: Suma de Monto Financiado de órdenes no canceladas
4. **Porcentaje Financiado**: (Monto Financiado / Ventas Totales) × 100

## Conciliación Bancaria
1. **Recibido en Banco**: Suma de montos de payment_records donde VERIFICACION = SI
   - Solo pagos verificados contra el banco

2. **Cuotas adelantadas de clientes**: Suma de cuotas programadas (schedule-based) con STATUS = ADELANTADO
   - Usa fechas de cuota programada, NO fechas de pago
   - Solo respeta master filters (no filtros locales)

3. **Pago inicial de clientes en App**: Suma de pagos verificados de Cuota 0
   - payment_records donde Cuota Pagada = 0 Y VERIFICACION = SI

4. **Devoluciones por errores de pago**: Actualmente $0 (placeholder)

5. **Depósitos de otros aliados**: Suma de pagos con STATUS = OTRO ALIADO Y VERIFICACION = SI
   - Pagos que existen pero sin cuota programada correspondiente

6. **Banco neto**: 
   = Recibido en Banco 
   - Cuotas adelantadas 
   - Pago inicial 
   - Devoluciones 
   - Depósitos otros aliados

## Cuentas por Cobrar
1. **Cuentas por Cobrar**: Suma de montos de cuotas programadas en el período
   - Respeta master filters

2. **Cuotas adelantadas en periodos anteriores**: Suma de cuotas payment-based con STATUS = ADELANTADO
   - Usa fechas de pago, NO fechas programadas
   - Solo respeta master filters

3. **Cuentas por Cobrar Neto**:
   = Cuentas por Cobrar - Cuotas adelantadas en periodos anteriores
`,
  },
  {
    section: "reglas_negocio",
    category: "vistas",
    content: `
# Vistas Principales del Sistema

## CARGAR DATOS
Permite subir archivos Excel para:
- Órdenes (orders)
- Registros de Pago (payment_records)
- Órdenes de Marketplace (marketplace_orders)
- Estado de Cuenta Bancario (bank_statements)

Comportamiento de carga:
- Orders: Reemplaza órdenes existentes por número de Orden
- Payment Records: Actualiza por (Orden, Cuota Pagada, Referencia)
- Marketplace Orders: Reemplaza completamente
- Bank Statements: Reemplaza completamente con deduplicación automática

## TODAS LAS ÓRDENES
Dashboard con métricas de órdenes:
- # Órdenes Activas
- Ventas Totales
- Total Pagado
- Saldo Pendiente
- # Órdenes Canceladas
- # Cuotas del Periodo
- Cuentas por Cobrar

Tabla con todas las órdenes y sus detalles.

## CUOTAS
Vista vertical de cuotas programadas con:
- Dashboard: Cuotas del Periodo, Cuentas por Cobrar
- Tabla con todas las cuotas en formato largo
- Filtros: rango de fechas, orden, estado

## PAGO DE CUOTAS
Vista de transacciones de pago con:
- Dashboard con 7 métricas incluyendo Pagos No Verificados
- Tabla con registros de pago
- Columna VERIFICACION automática
- Filtros: rango de fechas, orden, referencia

## BANCO
Vista del estado de cuenta bancario con:
- Tabla con transacciones bancarias
- Columna CONCILIADO automática
- Deduplicación automática por referencia
- Filtros: referencia
- Exportación a Excel

## CONCILIACION DE CUOTAS
Vista de cuotas con verificación bancaria:
- Usa fechas de cuota programada
- Dashboard con Depósitos Otros Aliados
- Columnas: STATUS, VERIFICACION
- Filtros completos

## CONCILIACION DE PAGOS
Vista basada en fechas de pago:
- Usa fechas de transacción de pago
- Dashboard con Cuotas Adelantadas
- Columnas: STATUS, VERIFICACION
- Filtros completos

## MARKETPLACE ORDERS
Vista de órdenes del marketplace:
- Tabla con órdenes
- Filtros: Estado, Orden, Estado de Entrega, Referencia
- Exportación a Excel

## REPORTE MENSUAL
Reporte financiero completo con:
- Métricas de ventas
- Conciliación bancaria
- Cuentas por cobrar
- Solo respeta master filters
`,
  },
  {
    section: "consultas_sql",
    category: "ejemplos",
    content: `
# Ejemplos de Consultas SQL Comunes

## Consultar todas las órdenes
SELECT rows FROM orders;

## Consultar pagos de una orden específica
SELECT rows FROM payment_records WHERE rows @> '[{"Orden": "12345"}]'::jsonb;

## Consultar estado de cuenta bancario
SELECT rows FROM bank_statements;

## Consultar órdenes del marketplace
SELECT rows FROM marketplace_orders;

## Contar total de órdenes
SELECT COUNT(*) FROM orders;

## Contar total de registros de pago
SELECT COUNT(*) FROM payment_records;

IMPORTANTE: Las columnas rows son de tipo JSONB y contienen arrays de objetos.
Para filtrar por valores dentro de rows, usar operadores JSONB como @>, ?, ?&, etc.
`,
  },
  {
    section: "reglas_negocio",
    category: "deduplicacion",
    content: `
# Estrategia de Deduplicación

## Órdenes (orders)
- Deduplicación por número de Orden
- Backend deduplica durante upload
- Database merge deduplica al combinar con datos existentes
- Frontend aplica deduplicación en tres niveles (useEffect, processFile, tab filtering)
- Se mantiene la primera ocurrencia de cada orden única

## Estado de Cuenta Bancario (bank_statements)
- Deduplicación por número de Referencia
- Backend deduplica durante upload
- Frontend deduplica al mostrar datos
- Se mantiene la última ocurrencia de cada referencia única

## Registros de Pago (payment_records)
- NO se deduplica
- Se pueden tener múltiples pagos con misma referencia
- Cada registro es una transacción independiente
- Update por combinación de (Orden, Cuota Pagada, Referencia)

## Órdenes Marketplace (marketplace_orders)
- Reemplazo completo en cada carga
- NO se deduplica durante carga
- Cada upload reemplaza todos los datos anteriores

Impacto:
- TODAS las pestañas reciben datos deduplicados
- REPORTE MENSUAL usa datos deduplicados para cálculos precisos
- Evita métricas infladas por órdenes duplicadas
`,
  },
  {
    section: "reglas_negocio",
    category: "formatos_fecha",
    content: `
# Manejo de Fechas

## Formatos Aceptados
El sistema acepta múltiples formatos de fecha en archivos Excel:
- Números seriales de Excel (ej: 45231)
- DD/MM/YYYY (ej: 15/10/2024)
- MM/DD/YYYY (ej: 10/15/2024)
- YYYY-MM-DD (ej: 2024-10-15)
- Fechas en texto (se intentan parsear automáticamente)

## Conversión Automática
- parseExcelDate() convierte seriales de Excel a fechas
- Maneja diferentes formatos de separadores (/, -, .)
- Respeta zona horaria UTC para evitar cambios de día

## Ordenamiento
- Todas las tablas con fechas soportan ordenamiento cronológico
- Comparación basada en timestamps (no strings)
- Fechas inválidas se mueven al final al ordenar

## Validación
- Fechas inválidas se muestran como "Fecha inválida"
- No se rechazan archivos por fechas inválidas
- Se preservan valores originales cuando no se pueden parsear
`,
  },
];
