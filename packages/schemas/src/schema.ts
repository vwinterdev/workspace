import { date, pgTable, serial, text } from "drizzle-orm/pg-core";

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  doneWork: text("done_work").notNull(),
  date: date("date").notNull(),
  interestingFacts: text("interesting_facts"),
});
