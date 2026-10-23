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
   * Internal executor for a single JSON-RPC 2.0 request.
   */
  private async executeSingleRpc(body: any): Promise<any> {
    if (!body || typeof body !== "object") {
      return {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid Request: Expected object" },
      };
    }

    const { id, method, params } = body;

    try {
      if (method === "initialize") {
        return {
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
        };
      }

      if (method === "notifications/initialized") {
        return null;
      }

      if (method === "ping") {
        return { jsonrpc: "2.0", id: id ?? 1, result: {} };
      }

      const server = this.mcpServer;
      const registeredTools = (server as any)._registeredTools || {};

      if (method === "tools/list") {
        const toolsList = Object.entries(registeredTools)
          .filter(([, tool]: [string, any]) => tool.enabled !== false)
          .map(([name, tool]: [string, any]) => {
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

        return {
          jsonrpc: "2.0",
          id: id ?? 1,
          result: {
            tools: toolsList,
          },
        };
      }

      if (method === "tools/call") {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        const tool = registeredTools[toolName];
        if (!tool) {
          return {
            jsonrpc: "2.0",
            id: id ?? 1,
            error: {
              code: -32601,
              message: `Tool '${toolName}' not found`,
            },
          };
        }

        const parsedArgs = tool.inputSchema?.parse ? tool.inputSchema.parse(toolArgs) : toolArgs;
        const toolResult = await tool.handler(parsedArgs);
        return {
          jsonrpc: "2.0",
          id: id ?? 1,
          result: toolResult,
        };
      }

      return {
        jsonrpc: "2.0",
        id: id ?? 1,
        error: {
          code: -32601,
          message: `Method '${method}' not supported`,
        },
      };
    } catch (err: any) {
      console.error("[MCP Router Error]", err);
      return {
        jsonrpc: "2.0",
        id: id ?? 1,
        error: {
          code: -32603,
          message: err?.message || "Internal error executing tool",
        },
      };
    }
  }

  /**
   * Direct stateless HTTP POST handler for JSON-RPC 2.0 requests.
   * Supports both single and batch requests.
   */
  async handleDirectJsonRpc(req: Request, res: Response): Promise<void> {
    const body = req.body;
    if (!body || (typeof body !== "object" && !Array.isArray(body))) {
      res.status(400).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: Invalid JSON object" },
      });
      return;
    }

    if (Array.isArray(body)) {
      if (body.length === 0) {
        res.status(400).json({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Invalid Request: Batch request cannot be empty" },
        });
        return;
      }
      const results = (await Promise.all(body.map((item) => this.executeSingleRpc(item)))).filter(Boolean);
      res.json(results);
      return;
    }

    const response = await this.executeSingleRpc(body);
    if (!response) {
      res.status(204).end();
      return;
    }

    const statusCode = response.error ? (response.error.code === -32601 ? 404 : 500) : 200;
    if (statusCode !== 200 && typeof res.status === "function") {
      const chained = res.status(statusCode);
      if (chained && typeof (chained as any).json === "function") {
        (chained as any).json(response);
        return;
      }
    }
    res.json(response);
  }
}

export const mcpRouter = new McpProtocolRouter();
