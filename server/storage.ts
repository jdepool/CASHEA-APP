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
  users,
  orders,
  paymentRecords,
  marketplaceOrders,
  bankStatements
} from "@shared/schema";
import { normalizeNumberForKey, normalizeReferenceNumber } from "@shared/numberUtils";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

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
      // MERGE/UPSERT STRATEGY: Update existing orders by Orden number, add new ones
      // Get existing orders
      const [existingRecord] = await tx
        .select()
        .from(orders)
        .orderBy(desc(orders.uploadedAt))
        .limit(1);
      
      const existingRows = existingRecord?.rows || [];
      
      // Find Orden column (case-insensitive, handles "Orden", "# Orden", etc.)
      const findOrdenColumn = (headers: string[]) => {
        return headers.find(h => {
          const lower = h.toLowerCase().trim();
          return lower === 'orden' || lower === '# orden' || lower.includes('orden');
        }) || 'Orden';
      };
      
      const ordenColumn = findOrdenColumn(headers);
      
      // Also find the orden column in existing rows (may have different header format)
      const existingHeaders = existingRecord?.headers || headers;
      const existingOrdenColumn = findOrdenColumn(existingHeaders as string[]);
      
      // Create a map of existing orders by Orden number
      const existingOrdersMap = new Map<string, any>();
      existingRows.forEach((row: any) => {
        // Try both column names to handle header format differences
        const ordenValue = row[existingOrdenColumn] || row[ordenColumn];
        if (ordenValue != null) {
          const ordenKey = String(ordenValue).trim();
          existingOrdersMap.set(ordenKey, row);
        }
      });
      
      let added = 0;
      let updated = 0;
      
      // Process new orders: update existing, add new ones
      newOrders.forEach((newRow: any) => {
        const ordenValue = newRow[ordenColumn];
        if (ordenValue != null) {
          const ordenKey = String(ordenValue).trim();
          if (existingOrdersMap.has(ordenKey)) {
            // Update existing order
            existingOrdersMap.set(ordenKey, newRow);
            updated++;
          } else {
            // Add new order
            existingOrdersMap.set(ordenKey, newRow);
            added++;
          }
        }
      });
      
      const finalRows = Array.from(existingOrdersMap.values());
      
      // Delete all and insert merged data
      await tx.delete(orders);
      
      const [order] = await tx
        .insert(orders)
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
        skipped: 0,
        total: finalRows.length
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
    // MERGE/UPSERT STRATEGY: Update existing orders by # Orden, add new ones
    return await db.transaction(async (tx) => {
      // Get existing marketplace orders (most recent first)
      const existingRecords = await tx
        .select()
        .from(marketplaceOrders)
        .orderBy(desc(marketplaceOrders.uploadedAt));
      
      // Collect all existing rows, but build map directly to keep newest version of each order
      const existingRowsForLogging: any[] = [];
      const tempExistingMap = new Map<string, any>();
      
      existingRecords.forEach((record) => {
        if (record.rows && Array.isArray(record.rows)) {
          const rows = record.rows as any[];
          existingRowsForLogging.push(...rows);
          
          // Extract orden column from this record's headers
          const recordHeaders = (record.headers as string[]) || [];
          const recordOrdenCol = recordHeaders.find(h => {
            const lower = h.toLowerCase().trim();
            return lower === 'orden' || lower === '# orden' || lower.includes('orden') || lower.includes('order');
          });
          
          // Add rows to temp map (newest first due to orderBy, so don't overwrite)
          rows.forEach((row: any) => {
            let ordenValue = null;
            if (recordOrdenCol) {
              ordenValue = row[recordOrdenCol];
            }
            // Fallback: try common column names
            if (ordenValue == null) {
              ordenValue = row['# Orden'] || row['Orden'] || row['# orden'] || row['orden'];
            }
            
            if (ordenValue != null) {
              const ordenKey = String(ordenValue).trim();
              // Only set if not already present (keeps newest version)
              if (!tempExistingMap.has(ordenKey)) {
                tempExistingMap.set(ordenKey, row);
              }
            }
          });
        }
      });
      
      const newHeaders = insertMarketplaceOrder.headers as string[];
      const newRows = insertMarketplaceOrder.rows as any[];
      
      // Find # Orden column (case-insensitive, handles various formats)
      const findOrdenColumn = (headers: string[]) => {
        return headers.find(h => {
          const lower = h.toLowerCase().trim();
          return lower === 'orden' || lower === '# orden' || lower.includes('orden') || lower.includes('order');
        }) || '# Orden';
      };
      
      const ordenColumn = findOrdenColumn(newHeaders);
      
      // Start with the temp map that already has newest versions
      const existingOrdersMap = new Map<string, any>(tempExistingMap);
      
      let added = 0;
      let updated = 0;
      
      // Process new orders: update existing, add new ones
      newRows.forEach((newRow: any) => {
        const ordenValue = newRow[ordenColumn];
        if (ordenValue != null) {
          const ordenKey = String(ordenValue).trim();
          if (existingOrdersMap.has(ordenKey)) {
            // Update existing order
            existingOrdersMap.set(ordenKey, newRow);
            updated++;
          } else {
            // Add new order
            existingOrdersMap.set(ordenKey, newRow);
            added++;
          }
        }
      });
      
      const finalRows = Array.from(existingOrdersMap.values());
      
      console.log(`\n=== MARKETPLACE ORDERS MERGE ===`);
      console.log(`Orders in database before: ${existingRowsForLogging.length}`);
      console.log(`Unique orders in database: ${tempExistingMap.size}`);
      console.log(`Orders in uploaded file: ${newRows.length}`);
      console.log(`New orders added: ${added}`);
      console.log(`Existing orders updated: ${updated}`);
      console.log(`Total orders after merge: ${finalRows.length}`);
      console.log(`================================\n`);
      
      // Delete all and insert merged data
      await tx.delete(marketplaceOrders);
      
      const [marketplaceOrder] = await tx
        .insert(marketplaceOrders)
        .values({
          fileName: insertMarketplaceOrder.fileName,
          headers: newHeaders as any,
          rows: finalRows as any,
          rowCount: String(finalRows.length),
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
}

export const storage = new DatabaseStorage();
