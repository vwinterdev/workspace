import { NotFoundError } from "../errors.js";
import type {
  NewTicket,
} from "../repositories/tickets.repository.js";
import { ticketsRepository } from "../repositories/tickets.repository.js";
import type { CreateTicketInput } from "../validators/tickets.validator.js";

export const ticketsService = {
  async list() {
    return ticketsRepository.findAll();
  },

  async getById(id: number) {
    const ticket = await ticketsRepository.findById(id);
    if (!ticket) {
      throw new NotFoundError(`ticket ${id} not found`);
    }
    return ticket;
  },

  async create(input: CreateTicketInput) {
    const data: NewTicket = {
      title: input.title,
      description: input.description,
      doneWork: input.doneWork,
      date: input.date,
      interestingFacts: input.interestingFacts ?? null,
    };
    return ticketsRepository.create(data);
  },

  async remove(id: number) {
    const ticket = await ticketsRepository.remove(id);
    if (!ticket) {
      throw new NotFoundError(`ticket ${id} not found`);
    }
    return ticket;
  },
};
