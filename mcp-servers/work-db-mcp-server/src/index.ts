#!/usr/bin/env node
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTicketTools } from "./tools/tickets.js";

const server = new McpServer({
  name: "work-db-mcp-server",
  version: "1.0.0",
});

registerTicketTools(server);

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("work-db-mcp-server running via stdio");
}

async function runHttp(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.error(`work-db-mcp-server running via HTTP on :${port}`);
  });
}

const transportMode = process.env.TRANSPORT ?? "stdio";
const run = transportMode === "http" ? runHttp : runStdio;

run().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
