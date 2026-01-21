CREATE TABLE "bank_statements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"headers" jsonb NOT NULL,
	"rows" jsonb NOT NULL,
	"row_count" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calculation_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"cache_key" text NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"source_data_hash" text,
	"data_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "calculation_cache_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"embedding" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"headers" jsonb NOT NULL,
	"rows" jsonb NOT NULL,
	"row_count" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orden_tienda_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"orden" text NOT NULL,
	"tienda" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orden_tienda_mapping_orden_unique" UNIQUE("orden")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"headers" jsonb NOT NULL,
	"rows" jsonb NOT NULL,
	"row_count" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"headers" jsonb NOT NULL,
	"rows" jsonb NOT NULL,
	"row_count" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_verifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_key" text NOT NULL,
	"orden" text NOT NULL,
	"cuota" text NOT NULL,
	"referencia" text NOT NULL,
	"verification_status" text NOT NULL,
	"matched_bank_ref" text,
	"payment_amount_ves" text,
	"payment_amount_usd" text,
	"verified_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_verifications_payment_key_unique" UNIQUE("payment_key")
);
--> statement-breakpoint
CREATE TABLE "processed_bank_statements" (
	"id" serial PRIMARY KEY NOT NULL,
	"referencia" text,
	"fecha" date,
	"descripcion" text,
	"debe" numeric(12, 2),
	"haber" numeric(12, 2),
	"saldo" numeric(12, 2),
	"orden" text,
	"cuota" text,
	"nombre" text,
	"conciliado" text,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"source_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_installments" (
	"id" serial PRIMARY KEY NOT NULL,
	"orden" text NOT NULL,
	"numero_cuota" integer NOT NULL,
	"monto" numeric(12, 2),
	"fecha_cuota" date,
	"fecha_pago_real" date,
	"status" text,
	"is_payment_based" boolean DEFAULT false NOT NULL,
	"tienda" text,
	"payment_referencia" text,
	"payment_metodo" text,
	"payment_monto_usd" numeric(12, 2),
	"payment_monto_ves" numeric(12, 2),
	"payment_tasa_cambio" numeric(12, 4),
	"verificacion" text,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"source_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
