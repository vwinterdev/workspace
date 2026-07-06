import { eq } from "drizzle-orm";
import { db, tickets } from "schemas";

export type TicketRow = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;

export const ticketsRepository = {
  async findAll(): Promise<TicketRow[]> {
    return db.select().from(tickets);
  },

  async findById(id: number): Promise<TicketRow | undefined> {
    const [row] = await db.select().from(tickets).where(eq(tickets.id, id));
    return row;
  },

  async create(data: NewTicket): Promise<TicketRow> {
    const [row] = await db.insert(tickets).values(data).returning();
    return row;
  },

  async remove(id: number): Promise<TicketRow | undefined> {
    const [row] = await db
      .delete(tickets)
      .where(eq(tickets.id, id))
      .returning();
    return row;
  },
};
