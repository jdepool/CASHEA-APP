import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, serial, integer, decimal, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: text("file_name").notNull(),
  headers: jsonb("headers").notNull().$type<string[]>(),
  rows: jsonb("rows").notNull().$type<ExcelRow[]>(),
  rowCount: text("row_count").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  uploadedAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const paymentRecords = pgTable("payment_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: text("file_name").notNull(),
  headers: jsonb("headers").notNull().$type<string[]>(),
  rows: jsonb("rows").notNull().$type<ExcelRow[]>(),
  rowCount: text("row_count").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertPaymentRecordSchema = createInsertSchema(paymentRecords).omit({
  id: true,
  uploadedAt: true,
});

export type InsertPaymentRecord = z.infer<typeof insertPaymentRecordSchema>;
export type PaymentRecord = typeof paymentRecords.$inferSelect;

export const marketplaceOrders = pgTable("marketplace_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: text("file_name").notNull(),
  headers: jsonb("headers").notNull().$type<string[]>(),
  rows: jsonb("rows").notNull().$type<ExcelRow[]>(),
  rowCount: text("row_count").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertMarketplaceOrderSchema = createInsertSchema(marketplaceOrders).omit({
  id: true,
  uploadedAt: true,
});

export type InsertMarketplaceOrder = z.infer<typeof insertMarketplaceOrderSchema>;
export type MarketplaceOrder = typeof marketplaceOrders.$inferSelect;

export const bankStatements = pgTable("bank_statements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: text("file_name").notNull(),
  headers: jsonb("headers").notNull().$type<string[]>(),
  rows: jsonb("rows").notNull().$type<ExcelRow[]>(),
  rowCount: text("row_count").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertBankStatementSchema = createInsertSchema(bankStatements).omit({
  id: true,
  uploadedAt: true,
});

export type InsertBankStatement = z.infer<typeof insertBankStatementSchema>;
export type BankStatement = typeof bankStatements.$inferSelect;

export interface ExcelRow {
  [key: string]: any;
}

export interface ParsedExcelData {
  headers: string[];
  rows: ExcelRow[];
  fileName: string;
  rowCount: number;
}

export const embeddings = pgTable("embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  embedding: text("embedding").notNull(),
  metadata: jsonb("metadata").$type<{
    section: string;
    category: string;
    [key: string]: any;
  }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmbeddingSchema = createInsertSchema(embeddings).omit({
  id: true,
  createdAt: true,
});

export type InsertEmbedding = z.infer<typeof insertEmbeddingSchema>;
export type Embedding = typeof embeddings.$inferSelect;

export const paymentVerifications = pgTable("payment_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentKey: text("payment_key").notNull().unique(),
  orden: text("orden").notNull(),
  cuota: text("cuota").notNull(),
  referencia: text("referencia").notNull(),
  verificationStatus: text("verification_status").notNull(),
  matchedBankRef: text("matched_bank_ref"),
  paymentAmountVES: text("payment_amount_ves"),
  paymentAmountUSD: text("payment_amount_usd"),
  verifiedAt: timestamp("verified_at").notNull().defaultNow(),
});

export const insertPaymentVerificationSchema = createInsertSchema(paymentVerifications).omit({
  id: true,
  verifiedAt: true,
});

export type InsertPaymentVerification = z.infer<typeof insertPaymentVerificationSchema>;
export type PaymentVerification = typeof paymentVerifications.$inferSelect;

// Cache tables for pre-calculated data sharing with other apps

export const calculationCache = pgTable("calculation_cache", {
  id: serial("id").primaryKey(),
  cacheKey: text("cache_key").notNull().unique(),
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
  sourceDataHash: text("source_data_hash"),
  dataVersion: integer("data_version").notNull().default(1),
});

export const insertCalculationCacheSchema = createInsertSchema(calculationCache).omit({
  id: true,
});

export type InsertCalculationCache = z.infer<typeof insertCalculationCacheSchema>;
export type CalculationCache = typeof calculationCache.$inferSelect;

export const processedInstallments = pgTable("processed_installments", {
  id: serial("id").primaryKey(),
  orden: text("orden").notNull(),
  numeroCuota: integer("numero_cuota").notNull(),
  monto: decimal("monto", { precision: 12, scale: 2 }),
  fechaCuota: date("fecha_cuota"),
  fechaPagoReal: date("fecha_pago_real"),
  status: text("status"),
  isPaymentBased: boolean("is_payment_based").notNull().default(false),
  tienda: text("tienda"),
  paymentReferencia: text("payment_referencia"),
  paymentMetodo: text("payment_metodo"),
  paymentMontoUSD: decimal("payment_monto_usd", { precision: 12, scale: 2 }),
  paymentMontoVES: decimal("payment_monto_ves", { precision: 12, scale: 2 }),
  paymentTasaCambio: decimal("payment_tasa_cambio", { precision: 12, scale: 4 }),
  verificacion: text("verificacion"),
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
  sourceVersion: integer("source_version").notNull().default(1),
});

export const insertProcessedInstallmentSchema = createInsertSchema(processedInstallments).omit({
  id: true,
  calculatedAt: true,
});

export type InsertProcessedInstallment = z.infer<typeof insertProcessedInstallmentSchema>;
export type ProcessedInstallment = typeof processedInstallments.$inferSelect;

export const ordenTiendaMapping = pgTable("orden_tienda_mapping", {
  id: serial("id").primaryKey(),
  orden: text("orden").notNull().unique(),
  tienda: text("tienda").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrdenTiendaMappingSchema = createInsertSchema(ordenTiendaMapping).omit({
  id: true,
  updatedAt: true,
});

export type InsertOrdenTiendaMapping = z.infer<typeof insertOrdenTiendaMappingSchema>;
export type OrdenTiendaMapping = typeof ordenTiendaMapping.$inferSelect;

export const processedBankStatements = pgTable("processed_bank_statements", {
  id: serial("id").primaryKey(),
  referencia: text("referencia"),
  fecha: date("fecha"),
  descripcion: text("descripcion"),
  debe: decimal("debe", { precision: 12, scale: 2 }),
  haber: decimal("haber", { precision: 12, scale: 2 }),
  saldo: decimal("saldo", { precision: 12, scale: 2 }),
  orden: text("orden"),
  cuota: text("cuota"),
  nombre: text("nombre"),
  conciliado: text("conciliado"),
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
  sourceVersion: integer("source_version").notNull().default(1),
});

export const insertProcessedBankStatementSchema = createInsertSchema(processedBankStatements).omit({
  id: true,
  calculatedAt: true,
});

export type InsertProcessedBankStatement = z.infer<typeof insertProcessedBankStatementSchema>;
export type ProcessedBankStatement = typeof processedBankStatements.$inferSelect;
