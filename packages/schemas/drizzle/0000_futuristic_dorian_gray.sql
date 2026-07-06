CREATE TABLE IF NOT EXISTS "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"done_work" text NOT NULL,
	"date" date NOT NULL,
	"interesting_facts" text
);
