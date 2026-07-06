import { Hono } from "hono";
import { NotFoundError } from "../errors.js";
import {
  presentTicket,
  presentTickets,
} from "../presenters/tickets.presenter.js";
import { ticketsService } from "../services/tickets.service.js";
import {
  createTicketSchema,
  ticketIdSchema,
} from "../validators/tickets.validator.js";

export const ticketsRouter = new Hono();

ticketsRouter.get("/", async (c) => {
  const rows = await ticketsService.list();
  return c.json(presentTickets(rows));
});

ticketsRouter.get("/:id", async (c) => {
  const parsedId = ticketIdSchema.safeParse(c.req.param("id"));
  if (!parsedId.success) {
    return c.json({ error: "invalid id" }, 400);
  }

  try {
    const ticket = await ticketsService.getById(parsedId.data);
    return c.json(presentTicket(ticket));
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    throw err;
  }
});

ticketsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const parsedBody = createTicketSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json({ error: parsedBody.error.flatten() }, 400);
  }

  const ticket = await ticketsService.create(parsedBody.data);
  return c.json(presentTicket(ticket), 201);
});

ticketsRouter.delete("/:id", async (c) => {
  const parsedId = ticketIdSchema.safeParse(c.req.param("id"));
  if (!parsedId.success) {
    return c.json({ error: "invalid id" }, 400);
  }

  try {
    const ticket = await ticketsService.remove(parsedId.data);
    return c.json(presentTicket(ticket));
  } catch (err) {
    if (err instanceof NotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    throw err;
  }
});
