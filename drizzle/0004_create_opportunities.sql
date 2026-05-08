CREATE TABLE "detection_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"card_id" varchar(255) NOT NULL,
	"source" varchar(20) NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "detection_candidates_card_source_key" UNIQUE("card_id","source")
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" serial PRIMARY KEY NOT NULL,
	"card_id" varchar(255) NOT NULL,
	"source" varchar(20) NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"current_price" numeric(10, 2) NOT NULL,
	"baseline_price" numeric(10, 2) NOT NULL,
	"drop_percent" numeric(5, 2) NOT NULL,
	"sent_to_user" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "detection_candidates" ADD CONSTRAINT "detection_candidates_card_id_cards_oracle_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("oracle_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_card_id_cards_oracle_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("oracle_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "detection_candidates_first_seen_idx" ON "detection_candidates" USING btree ("first_seen_at");--> statement-breakpoint
CREATE INDEX "opportunities_card_source_detected_idx" ON "opportunities" USING btree ("card_id","source","detected_at");