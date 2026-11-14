CREATE TABLE "assistant_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"product_id" text NOT NULL,
	"action" text NOT NULL,
	"command" text NOT NULL,
	"product_name" text NOT NULL,
	"unit" text NOT NULL,
	"before_value" numeric(12, 2) NOT NULL,
	"after_value" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"undone_at" timestamp,
	"undo_before" numeric(12, 2),
	"undo_after" numeric(12, 2)
);
--> statement-breakpoint
ALTER TABLE "assistant_actions" ADD CONSTRAINT "assistant_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_actions" ADD CONSTRAINT "assistant_actions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;