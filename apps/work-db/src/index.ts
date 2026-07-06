import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { sql } from "schemas";
import { ticketsRouter } from "./routes/tickets.js";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

app.get("/db-check", async (c) => {
  const result = await sql`select now() as now`;
  return c.json({ now: result[0].now });
});

app.route("/tickets", ticketsRouter);

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});
