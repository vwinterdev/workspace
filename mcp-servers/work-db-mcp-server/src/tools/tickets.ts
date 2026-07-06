import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleWorkDbError, workDbRequest } from "../client.js";
import { CHARACTER_LIMIT } from "../constants.js";

const TicketSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  doneWork: z.string(),
  date: z.string(),
  interestingFacts: z.string().nullable(),
});

type Ticket = z.infer<typeof TicketSchema>;

enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

function formatTicketMarkdown(ticket: Ticket): string {
  const lines = [
    `## ${ticket.title} (#${ticket.id})`,
    `- **Date**: ${ticket.date}`,
    `- **Description**: ${ticket.description}`,
    `- **Done work**: ${ticket.doneWork}`,
  ];
  if (ticket.interestingFacts) {
    lines.push(`- **Interesting facts**: ${ticket.interestingFacts}`);
  }
  return lines.join("\n");
}

const ListTicketsInputSchema = z
  .object({
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe(
        "Output format: 'markdown' for human-readable or 'json' for machine-readable",
      ),
  })
  .strict();

type ListTicketsInput = z.infer<typeof ListTicketsInputSchema>;

const TicketIdInputSchema = z
  .object({
    id: z.number().int().positive().describe("Ticket id"),
  })
  .strict();

type TicketIdInput = z.infer<typeof TicketIdInputSchema>;

const CreateTicketInputSchema = z
  .object({
    title: z.string().min(1).describe("Short ticket title"),
    description: z.string().min(1).describe("Short description of the ticket"),
    doneWork: z.string().min(1).describe("What was actually done"),
    date: z.string().min(1).describe("Date in YYYY-MM-DD format"),
    interestingFacts: z
      .string()
      .nullish()
      .describe("Optional interesting facts about the ticket"),
  })
  .strict();

type CreateTicketInput = z.infer<typeof CreateTicketInputSchema>;

export function registerTicketTools(server: McpServer): void {
  server.registerTool(
    "work_db_list_tickets",
    {
      title: "List work-db tickets",
      description: `List all completed tasks/tickets stored in work-db.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format: { "count": number, "tickets": Ticket[] }
  Ticket shape: { id, title, description, doneWork, date, interestingFacts }

Examples:
  - Use when: "What tickets are logged in work-db?" -> params with response_format="markdown"
  - Don't use when: You already know the ticket id (use work_db_get_ticket instead)

Error Handling:
  - Returns "Error: could not reach work-db..." if the API is unreachable`,
      inputSchema: ListTicketsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListTicketsInput) => {
      try {
        const tickets = await workDbRequest<Ticket[]>("/tickets");

        if (!tickets.length) {
          return { content: [{ type: "text", text: "No tickets found." }] };
        }

        const output = { count: tickets.length, tickets };

        let text: string;
        if (params.response_format === ResponseFormat.MARKDOWN) {
          text = [
            `# work-db tickets (${tickets.length})`,
            "",
            ...tickets.map(formatTicketMarkdown),
          ].join("\n\n");
        } else {
          text = JSON.stringify(output, null, 2);
        }

        if (text.length > CHARACTER_LIMIT) {
          text = `${text.slice(0, CHARACTER_LIMIT)}\n\n...truncated, response exceeded ${CHARACTER_LIMIT} characters.`;
        }

        return {
          content: [{ type: "text", text }],
          structuredContent: output,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleWorkDbError(error) }] };
      }
    },
  );

  server.registerTool(
    "work_db_get_ticket",
    {
      title: "Get a work-db ticket",
      description: `Get a single ticket from work-db by id.

Args:
  - id (number): Ticket id

Returns:
  Ticket shape: { id, title, description, doneWork, date, interestingFacts }

Examples:
  - Use when: "Show me ticket 5" -> params with id=5

Error Handling:
  - Returns "Error: ticket not found..." if the id does not exist (404)`,
      inputSchema: TicketIdInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: TicketIdInput) => {
      try {
        const ticket = await workDbRequest<Ticket>(`/tickets/${params.id}`);
        return {
          content: [{ type: "text", text: JSON.stringify(ticket, null, 2) }],
          structuredContent: ticket,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleWorkDbError(error) }] };
      }
    },
  );

  server.registerTool(
    "work_db_create_ticket",
    {
      title: "Create a work-db ticket",
      description: `Create a new completed task/ticket in work-db.

Args:
  - title (string): Short ticket title
  - description (string): Short description of the ticket
  - doneWork (string): What was actually done
  - date (string): Date in YYYY-MM-DD format
  - interestingFacts (string, optional): Interesting facts about the ticket

Returns:
  The created ticket: { id, title, description, doneWork, date, interestingFacts }

Examples:
  - Use when: "Log that I finished the turborepo migration today" -> params with
    title, description, doneWork, date filled in

Error Handling:
  - Returns "Error: invalid input..." if required fields are missing (400)`,
      inputSchema: CreateTicketInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: CreateTicketInput) => {
      try {
        const ticket = await workDbRequest<Ticket>("/tickets", {
          method: "POST",
          body: JSON.stringify({
            title: params.title,
            description: params.description,
            doneWork: params.doneWork,
            date: params.date,
            interestingFacts: params.interestingFacts ?? null,
          }),
        });
        return {
          content: [
            {
              type: "text",
              text: `Created ticket #${ticket.id}: ${ticket.title}`,
            },
          ],
          structuredContent: ticket,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleWorkDbError(error) }] };
      }
    },
  );

  server.registerTool(
    "work_db_delete_ticket",
    {
      title: "Delete a work-db ticket",
      description: `Delete a ticket from work-db by id. This permanently removes the ticket.

Args:
  - id (number): Ticket id

Returns:
  The deleted ticket: { id, title, description, doneWork, date, interestingFacts }

Examples:
  - Use when: "Remove ticket 5, it was a duplicate" -> params with id=5

Error Handling:
  - Returns "Error: ticket not found..." if the id does not exist (404)`,
      inputSchema: TicketIdInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: TicketIdInput) => {
      try {
        const ticket = await workDbRequest<Ticket>(`/tickets/${params.id}`, {
          method: "DELETE",
        });
        return {
          content: [
            {
              type: "text",
              text: `Deleted ticket #${ticket.id}: ${ticket.title}`,
            },
          ],
          structuredContent: ticket,
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleWorkDbError(error) }] };
      }
    },
  );
}
