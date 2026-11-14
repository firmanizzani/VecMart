CREATE TABLE "assistant_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"resets_at" timestamp with time zone NOT NULL
);
