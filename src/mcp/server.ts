import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { Request, Response } from "express";
import { registerTools } from "./tools.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "echo-chamber-breaker",
    version: "1.0.0",
  });

  registerTools(server);
  (server as any).setToolRequestHandlers();
  return server;
}

export class McpProtocolRouter {
  private sseTransports: Map<string, SSEServerTransport> = new Map();
  private mcpServer: McpServer;

  constructor() {
    this.mcpServer = createMcpServer();
  }

  getMcpServer(): McpServer {
    return this.mcpServer;
  }

  /**
   * Handles GET requests to initialize an SSE stream.
   * Specification compliant with Streamable HTTP.
   */
  async handleSse(req: Request, res: Response, messageEndpoint: string = "/mcp/messages"): Promise<void> {
    const transport = new SSEServerTransport(messageEndpoint, res);
    const sessionId = transport.sessionId;
    this.sseTransports.set(sessionId, transport);

    transport.onclose = () => {
      this.sseTransports.delete(sessionId);
    };

    const clientServer = createMcpServer();
    await clientServer.connect(transport);
  }

  /**
   * Handles POST messages sent to the SSE session endpoint.
   */
  async handleSseMessage(req: Request, res: Response): Promise<void> {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId parameter in query" });
      return;
    }

    const transport = this.sseTransports.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: `Session ${sessionId} not found or expired` });
      return;
    }

    await transport.handlePostMessage(req, res);
  }

  /**
   * Direct stateless HTTP POST handler for JSON-RPC 2.0 requests.
   * Allows standard curl, web clients, and test harnesses to call MCP tools synchronously.
   */
  async handleDirectJsonRpc(req: Request, res: Response): Promise<void> {
    const body = req.body;
    if (!body || typeof body !== "object") {
      res.status(400).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: Invalid JSON object" },
      });
      return;
    }

    const { id, method, params } = body;

    try {
      if (method === "initialize") {
        res.json({
          jsonrpc: "2.0",
          id: id ?? 1,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: { listChanged: false },
            },
            serverInfo: {
              name: "echo-chamber-breaker",
              version: "1.0.0",
            },
          },
        });
        return;
      }

      if (method === "notifications/initialized") {
        res.status(204).end();
        return;
      }

      if (method === "ping") {
        res.json({ jsonrpc: "2.0", id: id ?? 1, result: {} });
        return;
      }

      const server = this.mcpServer;
      const registeredTools = (server as any)._registeredTools || {};

      if (method === "tools/list") {
        const toolsList = Object.entries(registeredTools)
          .filter(([, tool]: [string, any]) => tool.enabled !== false)
          .map(([name, tool]: [string, any]) => {
            // Extract shape if zod schema
            const properties: Record<string, any> = {};
            const required: string[] = [];

            if (tool.inputSchema?._def?.shape) {
              const shape = tool.inputSchema._def.shape();
              for (const [key, prop] of Object.entries(shape as Record<string, any>)) {
                const isOptional = prop.isOptional?.() || prop._def?.typeName === "ZodDefault";
                if (!isOptional) required.push(key);
                properties[key] = {
                  type: prop._def?.typeName === "ZodNumber" ? "number" : "string",
                  description: prop.description || key,
                };
              }
            }

            return {
              name,
              description: tool.description,
              inputSchema: {
                type: "object",
                properties,
                required,
              },
            };
          });

        res.json({
          jsonrpc: "2.0",
          id: id ?? 1,
          result: {
            tools: toolsList,
          },
        });
        return;
      }

      if (method === "tools/call") {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        const tool = registeredTools[toolName];
        if (!tool) {
          res.status(404).json({
            jsonrpc: "2.0",
            id: id ?? 1,
            error: {
              code: -32601,
              message: `Tool '${toolName}' not found`,
            },
          });
          return;
        }

        const parsedArgs = tool.inputSchema?.parse ? tool.inputSchema.parse(toolArgs) : toolArgs;
        const toolResult = await tool.handler(parsedArgs);
        res.json({
          jsonrpc: "2.0",
          id: id ?? 1,
          result: toolResult,
        });
        return;
      }

      res.status(404).json({
        jsonrpc: "2.0",
        id: id ?? 1,
        error: {
          code: -32601,
          message: `Method '${method}' not supported`,
        },
      });
    } catch (err: any) {
      console.error("[MCP Router Error]", err);
      res.status(500).json({
        jsonrpc: "2.0",
        id: id ?? 1,
        error: {
          code: -32603,
          message: err?.message || "Internal error executing tool",
        },
      });
    }
  }
}

export const mcpRouter = new McpProtocolRouter();
