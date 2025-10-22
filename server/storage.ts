import { 
  type User, 
  type InsertUser, 
  type Order, 
  type InsertOrder,
  type PaymentRecord,
  type InsertPaymentRecord,
  users,
  orders,
  paymentRecords
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface MergeResult {
  added: number;
  updated: number;
  skipped: number;
  total: number;
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
      
      // Merge new orders: replace if Orden exists, add if new
      newOrders.forEach((newRow: any) => {
        if (newRow.Orden) {
          if (existingOrdersMap.has(newRow.Orden)) {
            updated++;
            existingOrdersMap.set(newRow.Orden, newRow); // Replace existing
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
      
      // Create a set of existing (Orden, Cuota) combinations
      const existingKeys = new Set<string>();
      existingRows.forEach((row: any) => {
        const orden = row['# Orden'] || '';
        const cuota = row['# Cuota Pagada'] || '';
        if (orden && cuota) {
          existingKeys.add(`${orden}_${cuota}`);
        }
      });
      
      let added = 0;
      let skipped = 0;
      const rowsToAdd: any[] = [];
      
      // Filter new records: skip duplicates, add new ones
      newRecords.forEach((newRow: any) => {
        const orden = newRow['# Orden'] || '';
        const cuota = newRow['# Cuota Pagada'] || '';
        const key = `${orden}_${cuota}`;
        
        if (orden && cuota && existingKeys.has(key)) {
          skipped++;
        } else {
          added++;
          rowsToAdd.push(newRow);
          if (orden && cuota) {
            existingKeys.add(key); // Track to prevent duplicates within same upload
          }
        }
      });
      
      // Merge: existing rows + new non-duplicate rows
      const mergedRows = [...existingRows, ...rowsToAdd];
      
      // Delete all and insert merged data
      await tx.delete(paymentRecords);
      
      const [paymentRecord] = await tx
        .insert(paymentRecords)
        .values({
          fileName,
          headers: headers as any,
          rows: mergedRows as any,
          rowCount: String(mergedRows.length),
        })
        .returning();
      
      return {
        added,
        updated: 0,
        skipped,
        total: mergedRows.length
      };
    });
  }
}

export const storage = new DatabaseStorage();
