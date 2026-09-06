CREATE TABLE "banking_protocols" (
	"id" varchar PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"requires_security" boolean DEFAULT true,
	CONSTRAINT "banking_protocols_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "caja_movements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"amount_usd" double precision NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"reference" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_balance_ledger" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"asset" text NOT NULL,
	"delta" double precision NOT NULL,
	"balance_after" double precision NOT NULL,
	"reason" text NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"scope" text NOT NULL,
	"value" text NOT NULL,
	"status" text DEFAULT 'Activa' NOT NULL,
	"usage" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crypto_withdrawal_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"asset" text DEFAULT 'usdt' NOT NULL,
	"amount_usdt" numeric(18, 6) NOT NULL,
	"to_address" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"dispersion_id" integer,
	"network" text DEFAULT 'mainnet' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"content" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hot_wallet_dispersions" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" text NOT NULL,
	"to_address" text NOT NULL,
	"amount_usdt" numeric(18, 6) NOT NULL,
	"txid" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"idempotency_key" text,
	"signer_request_id" text,
	"expected_atomic_amount" text,
	"expected_contract" text,
	"network" text DEFAULT 'mainnet' NOT NULL,
	"failure_code" text,
	"confirmed_at" timestamp,
	"withdrawal_request_id" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "infra_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host" text NOT NULL,
	"source" text NOT NULL,
	"line" text NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"from_user" text,
	"status" text DEFAULT 'info' NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "okx_webhook_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"okx_id" text,
	"payload" jsonb NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "payment_charges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" text NOT NULL,
	"processor" text NOT NULL,
	"amount" double precision NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"card_last4" text,
	"card_brand" text,
	"receipt_url" text,
	"error_message" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_charges_charge_id_unique" UNIQUE("charge_id")
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" text NOT NULL,
	"card_type" text NOT NULL,
	"card_number" text NOT NULL,
	"cvv" text,
	"pin" text,
	"holder_name" text NOT NULL,
	"expiry_date" text NOT NULL,
	"verified" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "pos_terminals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"terminal_id" text NOT NULL,
	"model" text NOT NULL,
	"serial" text NOT NULL,
	"status" text DEFAULT 'Reconfigured' NOT NULL,
	"transactions" integer DEFAULT 0 NOT NULL,
	"amount" double precision DEFAULT 0 NOT NULL,
	"efficiency" integer DEFAULT 100 NOT NULL,
	"location" text NOT NULL,
	"uptime" text DEFAULT '100%' NOT NULL,
	"last_tx" text DEFAULT 'Sin transacciones' NOT NULL,
	"firmware" text DEFAULT 'v5.0.0-NEW' NOT NULL,
	"ip" text NOT NULL,
	"signal_strength" integer DEFAULT 100 NOT NULL,
	"emv" boolean DEFAULT true NOT NULL,
	"nfc" boolean DEFAULT true NOT NULL,
	"pinpad" boolean DEFAULT true NOT NULL,
	"config_note" text,
	"system_message" text,
	"owner" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pos_terminals_terminal_id_unique" UNIQUE("terminal_id")
);
--> statement-breakpoint
CREATE TABLE "routing_decisions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" text NOT NULL,
	"rule_id" text,
	"rule_name" text,
	"acquirer" text NOT NULL,
	"condition_matched" text,
	"response_time_ms" integer,
	"approved" boolean DEFAULT false NOT NULL,
	"amount" text,
	"currency" text,
	"protocol" text,
	"card_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"condition_field" text NOT NULL,
	"condition_operator" text NOT NULL,
	"condition_value" text NOT NULL,
	"acquirer" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"algorithm" text DEFAULT 'AES-256' NOT NULL,
	"hash" text NOT NULL,
	"emv_compliant" boolean DEFAULT true,
	"pci_compliant" boolean DEFAULT true,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "security_tokens_token_id_unique" UNIQUE("token_id")
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" text NOT NULL,
	"subject" text NOT NULL,
	"category" text DEFAULT 'billing' NOT NULL,
	"description" text NOT NULL,
	"attachment_name" text,
	"attachment_mime_type" text,
	"attachment_content" text,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"submitted_by" text NOT NULL,
	"admin_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "support_tickets_ticket_id_unique" UNIQUE("ticket_id")
);
--> statement-breakpoint
CREATE TABLE "system_settings_store" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terminal_commands" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"terminal_id" text NOT NULL,
	"command" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "transaction_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" text NOT NULL,
	"action" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" text NOT NULL,
	"protocol" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"from_account" text,
	"to_account" text,
	"description" text,
	"auth_code" text,
	"token_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "tron_deposit_credits" (
	"txid" text PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"amount_usdt" numeric(18, 6) NOT NULL,
	"from_address" text,
	"network" text DEFAULT 'mainnet' NOT NULL,
	"credited_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tron_deposit_declarations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"declared_txid" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_crypto_balances" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"asset" text NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_crypto_balances_user_id_asset_unique" UNIQUE("user_id","asset")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text DEFAULT 'USER' NOT NULL,
	"position" text,
	"avatar" text,
	"subscription_start" timestamp,
	"suspended" boolean DEFAULT false NOT NULL,
	"payment_engine_access" boolean DEFAULT false NOT NULL,
	"pos_full_access" boolean DEFAULT false NOT NULL,
	"caja_saldo_usd" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "replit_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "replit_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_hot_wallet_dispersions_network_idempotency" ON "hot_wallet_dispersions" USING btree ("network","idempotency_key") WHERE "hot_wallet_dispersions"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");