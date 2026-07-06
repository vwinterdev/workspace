import type { TicketRow } from "../repositories/tickets.repository.js";

export function presentTicket(ticket: TicketRow) {
  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    doneWork: ticket.doneWork,
    date: ticket.date,
    interestingFacts: ticket.interestingFacts,
  };
}

export function presentTickets(rows: TicketRow[]) {
  return rows.map(presentTicket);
}
