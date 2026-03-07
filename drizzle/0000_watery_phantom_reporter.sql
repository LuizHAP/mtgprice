CREATE TABLE "cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"oracle_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"set" varchar(10),
	"rarity" varchar(50),
	"color" varchar(50),
	"image_url" text,
	"last_fetched" timestamp,
	CONSTRAINT "cards_oracle_id_unique" UNIQUE("oracle_id")
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"card_id" varchar(255) NOT NULL,
	"source" varchar(50) NOT NULL,
	"price_brl" numeric(10, 2) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"telegram_chat_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"card_id" varchar(255) NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uniqueUserCard" UNIQUE("user_id","card_id")
);
--> statement-breakpoint
ALTER TABLE "prices" ADD CONSTRAINT "prices_card_id_cards_oracle_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("oracle_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_card_id_cards_oracle_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("oracle_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_oracle_idx" ON "cards" USING btree ("oracle_id");--> statement-breakpoint
CREATE INDEX "prices_card_timestamp_idx" ON "prices" USING btree ("card_id","timestamp");