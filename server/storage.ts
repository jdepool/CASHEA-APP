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

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createOrder(order: InsertOrder): Promise<Order>;
  getLatestOrder(): Promise<Order | undefined>;
  
  createPaymentRecord(paymentRecord: InsertPaymentRecord): Promise<PaymentRecord>;
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
}

export const storage = new DatabaseStorage();
