import { 
  type User, 
  type InsertUser, 
  type Order, 
  type InsertOrder,
  type PaymentRecord,
  type InsertPaymentRecord,
  type MarketplaceOrder,
  type InsertMarketplaceOrder,
  type BankStatement,
  type InsertBankStatement,
  type PaymentVerification,
  type InsertPaymentVerification,
  type CalculationCache,
  type InsertCalculationCache,
  type ProcessedInstallment,
  type InsertProcessedInstallment,
  type OrdenTiendaMapping,
  type InsertOrdenTiendaMapping,
  type ProcessedBankStatement,
  type InsertProcessedBankStatement,
  users,
  orders,
  paymentRecords,
  marketplaceOrders,
  bankStatements,
  paymentVerifications,
  calculationCache,
  processedInstallments,
  ordenTiendaMapping,
  processedBankStatements
} from "@shared/schema";
import { normalizeNumberForKey, normalizeReferenceNumber } from "@shared/numberUtils";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface SkippedRecord {
  orden: string;
  cuota: string;
  reason: string;
  rowData?: any;
}

export interface MergeResult {
  added: number;
  updated: number;
  skipped: number;
  total: number;
  skippedRecords?: SkippedRecord[];
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createOrder(order: InsertOrder): Promise<Order>;
  mergeOrders(newOrders: any[], fileName: string, headers: string[]): Promise<MergeResult>;
  getLatestOrder(): Promise<Order | undefined>;
  
  createPaymentRecord(paymentRecord: InsertPaymentRecord): Promise<PaymentRecord>;
  mergePaymentRecords(newRecords: any[], fileName: string, headers: string[]): Promise<MergeResult>;
  getLatestPaymentRecord(): Promise<PaymentRecord | undefined>;
  updatePaymentRecordsVerification(updatedRows: any[], updatedHeaders: string[]): Promise<void>;
  
  createMarketplaceOrder(marketplaceOrder: InsertMarketplaceOrder): Promise<MarketplaceOrder>;
  getLatestMarketplaceOrder(): Promise<MarketplaceOrder | undefined>;
  
  createBankStatement(bankStatement: InsertBankStatement): Promise<BankStatement>;
  getLatestBankStatement(): Promise<BankStatement | undefined>;
  
  getAllPaymentVerifications(): Promise<PaymentVerification[]>;
  savePaymentVerifications(verifications: InsertPaymentVerification[]): Promise<void>;
  clearPaymentVerifications(): Promise<void>;
  
  // Cache operations
  getCacheMetadata(cacheKey: string): Promise<CalculationCache | undefined>;
  updateCacheMetadata(cacheKey: string, sourceDataHash?: string): Promise<CalculationCache>;
  invalidateCache(cacheKey: string): Promise<void>;
  
  getAllProcessedInstallments(): Promise<ProcessedInstallment[]>;
  saveProcessedInstallments(installments: InsertProcessedInstallment[]): Promise<void>;
  getInstallmentStatus(orden: string, cuota: number): Promise<ProcessedInstallment | undefined>;
  
  getOrdenTiendaMapping(): Promise<OrdenTiendaMapping[]>;
  saveOrdenTiendaMapping(mappings: InsertOrdenTiendaMapping[]): Promise<void>;
  
  getAllProcessedBankStatements(): Promise<ProcessedBankStatement[]>;
  saveProcessedBankStatements(statements: InsertProcessedBankStatement[]): Promise<void>;
  updateInstallmentStatuses(currentDate: Date): Promise<{ updated: number }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    // Use transaction to ensure atomic delete+insert
    // If insert fails, delete is rolled back automatically
    return await db.transaction(async (tx) => {
      // Delete all existing orders
      await tx.delete(orders);
      
      // Insert new order
      const [order] = await tx
        .insert(orders)
        .values({
          fileName: insertOrder.fileName,
          headers: insertOrder.headers as any,
          rows: insertOrder.rows as any,
          rowCount: insertOrder.rowCount,
        })
        .returning();
      
      return order;
    });
  }

  async getLatestOrder(): Promise<Order | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.uploadedAt))
      .limit(1);
    return order || undefined;
  }

  async createPaymentRecord(insertPaymentRecord: InsertPaymentRecord): Promise<PaymentRecord> {
    // Use transaction to ensure atomic delete+insert
    // If insert fails, delete is rolled back automatically
    return await db.transaction(async (tx) => {
      // Delete all existing payment records
      await tx.delete(paymentRecords);
      
      // Insert new payment record
      const [paymentRecord] = await tx
        .insert(paymentRecords)
        .values({
          fileName: insertPaymentRecord.fileName,
          headers: insertPaymentRecord.headers as any,
          rows: insertPaymentRecord.rows as any,
          rowCount: insertPaymentRecord.rowCount,
        })
        .returning();
      
      return paymentRecord;
    });
  }

  async getLatestPaymentRecord(): Promise<PaymentRecord | undefined> {
    const [paymentRecord] = await db
      .select()
      .from(paymentRecords)
      .orderBy(desc(paymentRecords.uploadedAt))
      .limit(1);
    return paymentRecord || undefined;
  }

  async updatePaymentRecordsVerification(updatedRows: any[], updatedHeaders: string[]): Promise<void> {
    // Get the latest payment record
    const latestRecord = await this.getLatestPaymentRecord();
    
    if (!latestRecord) {
      console.log('No payment records found to update verification');
      return;
    }

    // Update the payment record with new rows and headers
    await db.transaction(async (tx) => {
      await tx.delete(paymentRecords);
      
      await tx
        .insert(paymentRecords)
        .values({
          fileName: latestRecord.fileName,
          headers: updatedHeaders as any,
          rows: updatedRows as any,
          rowCount: String(updatedRows.length),
        });
    });

    console.log(`✓ Updated VERIFICACION for ${updatedRows.length} payment records`);
  }

  async mergeOrders(newOrders: any[], fileName: string, headers: string[]): Promise<MergeResult> {
    return await db.transaction(async (tx) => {
      // Get existing orders
      const [existingOrder] = await tx
        .select()
        .from(orders)
        .orderBy(desc(orders.uploadedAt))
        .limit(1);
      
      const existingRows = existingOrder?.rows || [];
      
      // Create a map of existing orders by Orden number
      const existingOrdersMap = new Map<string, any>();
      existingRows.forEach((row: any) => {
        if (row.Orden) {
          existingOrdersMap.set(row.Orden, row);
        }
      });
      
      let added = 0;
      let updated = 0;
      
      // Merge new orders: smart merge for existing, add if new
      newOrders.forEach((newRow: any) => {
        if (newRow.Orden) {
          if (existingOrdersMap.has(newRow.Orden)) {
            updated++;
            // Smart merge: only update fields with non-empty values
            const existingRow = existingOrdersMap.get(newRow.Orden);
            const mergedRow = { ...existingRow }; // Start with existing data
            
            // Update only non-empty fields from new row
            Object.keys(newRow).forEach(key => {
              const newValue = newRow[key];
              // Update if new value is not empty/null/undefined/whitespace
              if (newValue != null && String(newValue).trim() !== '') {
                mergedRow[key] = newValue;
              }
              // Otherwise keep the existing value (don't overwrite with empty)
            });
            
            existingOrdersMap.set(newRow.Orden, mergedRow);
          } else {
            added++;
            existingOrdersMap.set(newRow.Orden, newRow); // Add new
          }
        }
      });
      
      // Convert map back to array
      const mergedRows = Array.from(existingOrdersMap.values());
      
      // Delete all and insert merged data
      await tx.delete(orders);
      
      const [order] = await tx
        .insert(orders)
        .values({
          fileName,
          headers: headers as any,
          rows: mergedRows as any,
          rowCount: String(mergedRows.length),
        })
        .returning();
      
      return {
        added,
        updated,
        skipped: 0,
        total: mergedRows.length
      };
    });
  }

  async mergePaymentRecords(newRecords: any[], fileName: string, headers: string[]): Promise<MergeResult> {
    return await db.transaction(async (tx) => {
      // Get existing payment records
      const [existingRecord] = await tx
        .select()
        .from(paymentRecords)
        .orderBy(desc(paymentRecords.uploadedAt))
        .limit(1);
      
      const existingRows = existingRecord?.rows || [];
      
      // First, deduplicate existing records by keeping only the first occurrence of each unique key
      const deduplicatedMap = new Map<string, any>();
      existingRows.forEach((row: any) => {
        const orden = row['# Orden'];
        const cuota = row['# Cuota Pagada'];
        const referencia = row['# Referencia'];
        
        // Skip if critical fields are null/undefined
        if (orden == null || cuota == null || referencia == null) return;
        
        // Normalize reference number to handle leading zeros (e.g., "000437506838" === "437506838")
        const normalizedRef = normalizeReferenceNumber(referencia);
        const key = `${orden}_${cuota}_${normalizedRef}`;
        
        // Only keep first occurrence of each key (removes duplicates)
        if (!deduplicatedMap.has(key)) {
          deduplicatedMap.set(key, row);
        }
      });
      
      // Start with deduplicated rows
      const deduplicatedRows = Array.from(deduplicatedMap.values());
      
      // Create a map of existing (Orden, Cuota, Monto) → row for updates
      const existingKeysMap = new Map<string, any>(deduplicatedMap);
      
      let added = 0;
      let updated = 0;
      let skipped = 0;
      const skippedRecords: SkippedRecord[] = [];
      const processedKeys = new Set<string>(); // Track keys processed in this upload
      
      // Process new records: update existing, add new ones, skip invalid
      newRecords.forEach((newRow: any, rowIndex: number) => {
        const orden = newRow['# Orden'];
        const cuota = newRow['# Cuota Pagada'];
        const referencia = newRow['# Referencia'];
        
        // Skip records with missing Order#, Installment#, or Reference# (null/undefined only)
        if (orden == null || cuota == null || referencia == null) {
          skipped++;
          skippedRecords.push({
            orden: orden ?? '(vacío)',
            cuota: cuota ?? '(vacío)',
            reason: 'Falta número de orden, cuota o referencia',
            rowData: { ...newRow, _fileRow: rowIndex + 2 } // +2 because Excel row (header is row 1)
          });
          return;
        }
        
        // Normalize reference number to handle leading zeros (e.g., "000437506838" === "437506838")
        const normalizedRef = normalizeReferenceNumber(referencia);
        const key = `${orden}_${cuota}_${normalizedRef}`;
        
        if (processedKeys.has(key)) {
          // Skip duplicate within the same upload (second+ occurrence)
          skipped++;
          skippedRecords.push({
            orden,
            cuota,
            reason: 'Duplicado dentro del mismo archivo',
            rowData: { ...newRow, _fileRow: rowIndex + 2 }
          });
        } else {
          processedKeys.add(key);
          
          if (existingKeysMap.has(key)) {
            // Update existing record
            existingKeysMap.set(key, newRow);
            updated++;
          } else {
            // Add new record
            existingKeysMap.set(key, newRow);
            added++;
          }
        }
      });
      
      // Convert map to final array
      const finalRows = Array.from(existingKeysMap.values());
      
      // Log skipped records details
      if (skippedRecords.length > 0) {
        console.log('\n=== REGISTROS DEL ARCHIVO QUE NO FUERON PROCESADOS ===');
        console.log(`Total de filas omitidas en su archivo: ${skippedRecords.length}`);
        console.log('Estas son las filas de su Excel que NO están en la base de datos:\n');
        skippedRecords.forEach((record, index) => {
          console.log(`${index + 1}. FILA EXCEL #${record.rowData._fileRow} - Orden: ${record.orden}, Cuota: ${record.cuota}`);
          console.log(`   Razón: ${record.reason}`);
          console.log(`   Fecha: ${record.rowData['Fecha de Transaccion'] || 'N/A'}`);
          console.log(`   Monto: ${record.rowData['Monto asignado'] || 'N/A'}`);
        });
        console.log('\n=====================================================\n');
      }
      
      // Log comparison of file vs database
      const uniqueKeysInFile = Array.from(processedKeys);
      const existingKeysArray = Array.from(existingKeysMap.keys());
      
      console.log('\n=== ANÁLISIS DE REGISTROS ===');
      console.log(`Registros únicos en su archivo: ${uniqueKeysInFile.length}`);
      console.log(`Registros en base de datos antes de cargar: ${existingRows.length}`);
      console.log(`Registros en base de datos después de cargar: ${finalRows.length}`);
      console.log(`Registros nuevos agregados: ${added}`);
      console.log(`Registros actualizados: ${updated}`);
      
      // Find records in file but not in database (should be the 'added' ones)
      const inFileNotInDB = uniqueKeysInFile.filter(key => !existingKeysMap.has(key));
      if (inFileNotInDB.length > 0) {
        console.log(`\nRegistros en archivo pero NO en BD (nuevos): ${inFileNotInDB.length}`);
        inFileNotInDB.slice(0, 10).forEach(key => {
          console.log(`  - ${key}`);
        });
      }
      
      // Find records in database but not in file
      const inDBNotInFile = existingKeysArray.filter(key => !processedKeys.has(key));
      if (inDBNotInFile.length > 0) {
        console.log(`\n=== REGISTROS EN LA BASE DE DATOS QUE NO ESTÁN EN SU ARCHIVO ===`);
        console.log(`Total: ${inDBNotInFile.length} registros`);
        console.log(`Estos registros están en la tabla pero NO en su archivo Excel actual:\n`);
        inDBNotInFile.forEach((key, index) => {
          const [orden, cuota, monto] = key.split('_');
          console.log(`${index + 1}. Orden: ${orden}, Cuota: ${cuota}, Monto: ${monto}`);
        });
        console.log(`\nEstos ${inDBNotInFile.length} registros permanecen en la base de datos.`);
        console.log('=================================================================\n');
      } else {
        console.log(`\nTodos los registros en la base de datos están en su archivo.`);
      }
      console.log('==============================\n');
      
      // Delete all and insert merged data
      await tx.delete(paymentRecords);
      
      const [paymentRecord] = await tx
        .insert(paymentRecords)
        .values({
          fileName,
          headers: headers as any,
          rows: finalRows as any,
          rowCount: String(finalRows.length),
        })
        .returning();
      
      return {
        added,
        updated,
        skipped,
        total: finalRows.length,
        skippedRecords
      };
    });
  }

  async createMarketplaceOrder(insertMarketplaceOrder: InsertMarketplaceOrder): Promise<MarketplaceOrder> {
    // Get all existing marketplace orders to merge with new data
    const existingOrders = await db
      .select()
      .from(marketplaceOrders)
      .orderBy(desc(marketplaceOrders.uploadedAt));
    
    // Collect all existing rows and headers
    let existingRows: any[] = [];
    const existingHeadersSet = new Set<string>();
    
    for (const order of existingOrders) {
      if (order.rows && Array.isArray(order.rows)) {
        existingRows = existingRows.concat(order.rows as any[]);
      }
      if (order.headers && Array.isArray(order.headers)) {
        (order.headers as string[]).forEach(h => existingHeadersSet.add(h));
      }
    }
    
    // Merge headers: union of existing and new headers
    const mergedHeaders = Array.from(new Set([
      ...Array.from(existingHeadersSet),
      ...insertMarketplaceOrder.headers
    ]));
    
    // Find the order number column
    const orderNumberHeader = mergedHeaders.find(h => 
      h.toLowerCase().includes('orden') || 
      h.toLowerCase().includes('order')
    );
    
    // Merge rows and deduplicate by order number (keep first occurrence)
    const seenOrders = new Map<string, any>();
    
    // Add existing rows first (to keep existing data)
    existingRows.forEach((row: any) => {
      if (orderNumberHeader) {
        const orderNum = String(row[orderNumberHeader] || '').trim();
        if (orderNum && !seenOrders.has(orderNum)) {
          seenOrders.set(orderNum, row);
        }
      }
    });
    
    // Add new rows (skip if order number already exists)
    insertMarketplaceOrder.rows.forEach((row: any) => {
      if (orderNumberHeader) {
        const orderNum = String(row[orderNumberHeader] || '').trim();
        if (orderNum && !seenOrders.has(orderNum)) {
          seenOrders.set(orderNum, row);
        }
      } else {
        // If no order number header, add all new rows
        seenOrders.set(JSON.stringify(row), row);
      }
    });
    
    const mergedRows = Array.from(seenOrders.values());
    
    // Use transaction to ensure atomic delete+insert
    return await db.transaction(async (tx) => {
      // Delete all existing marketplace orders
      await tx.delete(marketplaceOrders);
      
      // Insert merged marketplace orders
      const [marketplaceOrder] = await tx
        .insert(marketplaceOrders)
        .values({
          fileName: insertMarketplaceOrder.fileName,
          headers: mergedHeaders as any,
          rows: mergedRows as any,
          rowCount: String(mergedRows.length),
        })
        .returning();
      
      return marketplaceOrder;
    });
  }

  async getLatestMarketplaceOrder(): Promise<MarketplaceOrder | undefined> {
    const [marketplaceOrder] = await db
      .select()
      .from(marketplaceOrders)
      .orderBy(desc(marketplaceOrders.uploadedAt))
      .limit(1);
    return marketplaceOrder || undefined;
  }

  async createBankStatement(insertBankStatement: InsertBankStatement): Promise<BankStatement> {
    // Get all existing bank statement rows to merge with new data
    const existingStatements = await db
      .select()
      .from(bankStatements)
      .orderBy(desc(bankStatements.uploadedAt));
    
    // Collect all existing rows and headers
    let existingRows: any[] = [];
    const existingHeadersSet = new Set<string>();
    
    for (const statement of existingStatements) {
      if (statement.rows && Array.isArray(statement.rows)) {
        existingRows = existingRows.concat(statement.rows as any[]);
      }
      if (statement.headers && Array.isArray(statement.headers)) {
        (statement.headers as string[]).forEach(h => existingHeadersSet.add(h));
      }
    }
    
    // Create a function to generate a unique key for a row to detect duplicates
    const generateRowKey = (row: any): string => {
      if (!row || typeof row !== 'object') {
        return JSON.stringify(row || {});
      }
      
      // Use multiple fields to create a unique identifier
      const keyParts: string[] = [];
      
      // Common bank statement fields (case-insensitive search)
      const dateFields = ['fecha', 'date'];
      const refFields = ['referencia', 'reference', 'ref', 'número', 'numero', 'documento'];
      const amountFields = ['monto', 'amount', 'debe', 'haber', 'débito', 'debito', 'crédito', 'credito'];
      const descFields = ['descripcion', 'descripción', 'description', 'detalle', 'concepto', 'tipo'];
      
      const getOriginalKey = (lowerKey: string): string | undefined => {
        return Object.keys(row).find(k => k.toLowerCase() === lowerKey);
      };
      
      const rowKeys = Object.keys(row).map(k => k.toLowerCase());
      
      // Find and normalize date
      const dateKey = rowKeys.find(k => dateFields.some(df => k.includes(df)));
      if (dateKey) {
        const originalKey = getOriginalKey(dateKey);
        if (originalKey && row[originalKey]) {
          keyParts.push(String(row[originalKey]).trim());
        }
      }
      
      // Find and normalize reference
      const refKey = rowKeys.find(k => refFields.some(rf => k.includes(rf)));
      if (refKey) {
        const originalKey = getOriginalKey(refKey);
        if (originalKey && row[originalKey]) {
          keyParts.push(String(row[originalKey]).trim());
        }
      }
      
      // Find and normalize amounts
      amountFields.forEach(af => {
        const amountKey = rowKeys.find(k => k.includes(af));
        if (amountKey) {
          const originalKey = getOriginalKey(amountKey);
          if (originalKey && row[originalKey] !== null && row[originalKey] !== undefined && row[originalKey] !== '') {
            // Normalize number to avoid floating point issues
            const numStr = String(row[originalKey]).replace(/[^0-9.-]/g, '');
            if (numStr) {
              keyParts.push(numStr);
            }
          }
        }
      });
      
      // Find and normalize description
      const descKey = rowKeys.find(k => descFields.some(df => k.includes(df)));
      if (descKey) {
        const originalKey = getOriginalKey(descKey);
        if (originalKey && row[originalKey]) {
          keyParts.push(String(row[originalKey]).trim());
        }
      }
      
      // If we couldn't find any identifying fields, serialize the entire row as fallback
      // This ensures all rows are kept, but might allow some duplicates through
      if (keyParts.length === 0) {
        return JSON.stringify(row);
      }
      
      return keyParts.join('|').toLowerCase().trim();
    };
    
    // Create a set of existing row keys
    const existingRowKeys = new Set(existingRows.map(generateRowKey));
    
    // Filter out duplicate rows from new upload
    // Keep row if: (1) key doesn't exist in existing data, OR (2) row has no key (empty object fallback)
    const newRows = (insertBankStatement.rows as any[]).filter(row => {
      const rowKey = generateRowKey(row);
      // Don't filter out rows without keys - keep them to preserve all data
      if (!rowKey || rowKey.trim() === '') return true;
      // Only filter out if this exact key exists in existing data
      return !existingRowKeys.has(rowKey);
    });
    
    // Merge headers
    const newHeaders = insertBankStatement.headers as string[];
    newHeaders.forEach(h => existingHeadersSet.add(h));
    const mergedHeaders = Array.from(existingHeadersSet);
    
    // Combine all rows (existing + new non-duplicates)
    const mergedRows = [...existingRows, ...newRows];
    
    // Use transaction to ensure atomic delete+insert
    return await db.transaction(async (tx) => {
      // Delete all existing bank statements
      await tx.delete(bankStatements);
      
      // Insert merged bank statement
      const [bankStatement] = await tx
        .insert(bankStatements)
        .values({
          fileName: `Merged: ${insertBankStatement.fileName}`,
          headers: mergedHeaders as any,
          rows: mergedRows as any,
          rowCount: String(mergedRows.length),
        })
        .returning();
      
      return bankStatement;
    });
  }

  async getLatestBankStatement(): Promise<BankStatement | undefined> {
    const [bankStatement] = await db
      .select()
      .from(bankStatements)
      .orderBy(desc(bankStatements.uploadedAt))
      .limit(1);
    return bankStatement || undefined;
  }

  async getAllPaymentVerifications(): Promise<PaymentVerification[]> {
    return await db.select().from(paymentVerifications);
  }

  async savePaymentVerifications(verifications: InsertPaymentVerification[]): Promise<void> {
    if (verifications.length === 0) return;
    
    await db.transaction(async (tx) => {
      await tx.delete(paymentVerifications);
      
      const batchSize = 100;
      for (let i = 0; i < verifications.length; i += batchSize) {
        const batch = verifications.slice(i, i + batchSize);
        await tx.insert(paymentVerifications).values(batch);
      }
    });
    
    console.log(`✓ Saved ${verifications.length} payment verifications`);
  }

  async clearPaymentVerifications(): Promise<void> {
    await db.delete(paymentVerifications);
    console.log('✓ Cleared all payment verifications');
  }

  // Cache operations
  async getCacheMetadata(cacheKey: string): Promise<CalculationCache | undefined> {
    const [cache] = await db
      .select()
      .from(calculationCache)
      .where(eq(calculationCache.cacheKey, cacheKey));
    return cache || undefined;
  }

  async updateCacheMetadata(cacheKey: string, sourceDataHash?: string): Promise<CalculationCache> {
    const existing = await this.getCacheMetadata(cacheKey);
    
    if (existing) {
      const [updated] = await db
        .update(calculationCache)
        .set({
          calculatedAt: new Date(),
          sourceDataHash: sourceDataHash || existing.sourceDataHash,
          dataVersion: existing.dataVersion + 1,
        })
        .where(eq(calculationCache.cacheKey, cacheKey))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(calculationCache)
        .values({
          cacheKey,
          calculatedAt: new Date(),
          sourceDataHash,
          dataVersion: 1,
        })
        .returning();
      return created;
    }
  }

  async invalidateCache(cacheKey: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Delete metadata
      await tx.delete(calculationCache).where(eq(calculationCache.cacheKey, cacheKey));
      
      // Also delete actual cached data based on cache key
      if (cacheKey === 'installments') {
        await tx.delete(processedInstallments);
      } else if (cacheKey === 'bank_statements') {
        await tx.delete(processedBankStatements);
      } else if (cacheKey === 'orden_tienda_map') {
        await tx.delete(ordenTiendaMapping);
      }
    });
    console.log(`✓ Invalidated cache and cleared data: ${cacheKey}`);
  }

  async getAllProcessedInstallments(): Promise<ProcessedInstallment[]> {
    return await db.select().from(processedInstallments).orderBy(processedInstallments.orden, processedInstallments.numeroCuota);
  }

  async saveProcessedInstallments(installments: InsertProcessedInstallment[]): Promise<void> {
    if (installments.length === 0) return;
    
    await db.transaction(async (tx) => {
      await tx.delete(processedInstallments);
      
      const batchSize = 500;
      for (let i = 0; i < installments.length; i += batchSize) {
        const batch = installments.slice(i, i + batchSize);
        await tx.insert(processedInstallments).values(batch);
      }
    });
    
    await this.updateCacheMetadata('installments');
    console.log(`✓ Saved ${installments.length} processed installments`);
  }

  async getInstallmentStatus(orden: string, cuota: number): Promise<ProcessedInstallment | undefined> {
    const [installment] = await db
      .select()
      .from(processedInstallments)
      .where(
        sql`${processedInstallments.orden} = ${orden} AND ${processedInstallments.numeroCuota} = ${cuota}`
      );
    
    return installment || undefined;
  }

  async getOrdenTiendaMapping(): Promise<OrdenTiendaMapping[]> {
    return await db.select().from(ordenTiendaMapping);
  }

  async saveOrdenTiendaMapping(mappings: InsertOrdenTiendaMapping[]): Promise<void> {
    if (mappings.length === 0) return;
    
    await db.transaction(async (tx) => {
      await tx.delete(ordenTiendaMapping);
      
      const batchSize = 500;
      for (let i = 0; i < mappings.length; i += batchSize) {
        const batch = mappings.slice(i, i + batchSize);
        await tx.insert(ordenTiendaMapping).values(batch);
      }
    });
    
    await this.updateCacheMetadata('orden_tienda_map');
    console.log(`✓ Saved ${mappings.length} orden-tienda mappings`);
  }

  async getAllProcessedBankStatements(): Promise<ProcessedBankStatement[]> {
    return await db.select().from(processedBankStatements);
  }

  async saveProcessedBankStatements(statements: InsertProcessedBankStatement[]): Promise<void> {
    if (statements.length === 0) return;
    
    await db.transaction(async (tx) => {
      await tx.delete(processedBankStatements);
      
      const batchSize = 500;
      for (let i = 0; i < statements.length; i += batchSize) {
        const batch = statements.slice(i, i + batchSize);
        await tx.insert(processedBankStatements).values(batch);
      }
    });
    
    await this.updateCacheMetadata('bank_statements');
    console.log(`✓ Saved ${statements.length} processed bank statements`);
  }

  async updateInstallmentStatuses(currentDate: Date): Promise<{ updated: number }> {
    const todayStr = currentDate.toISOString().split('T')[0];
    
    // Use domain-specific Spanish status values matching the application taxonomy:
    // - 'A TIEMPO' for paid on time (payment date <= cuota date)
    // - 'ADELANTADO' for paid early (payment date < cuota date - will be calculated by frontend)
    // - 'ATRASADO' for overdue (past due date, no payment)
    // - Status is preserved if payment exists (let frontend calculate exact status)
    const result = await db.execute(sql`
      WITH updates AS (
        UPDATE processed_installments
        SET status = CASE
          WHEN fecha_pago_real IS NOT NULL THEN 'A TIEMPO'
          WHEN fecha_cuota IS NOT NULL AND fecha_cuota::date < ${todayStr}::date THEN 'ATRASADO'
          ELSE status
        END
        WHERE 
          (status IS NULL OR status = 'PENDIENTE' OR status = '' OR status = 'Pendiente')
          AND (
            fecha_pago_real IS NOT NULL 
            OR (fecha_cuota IS NOT NULL AND fecha_cuota::date < ${todayStr}::date)
          )
        RETURNING id
      )
      SELECT COUNT(*) as count FROM updates
    `);
    
    const count = Number(result.rows?.[0]?.count || 0);
    console.log(`✓ Updated ${count} installment statuses based on date ${todayStr}`);
    
    return { updated: count };
  }
}

export const storage = new DatabaseStorage();
