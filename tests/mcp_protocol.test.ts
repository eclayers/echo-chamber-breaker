import { describe, it, expect, beforeAll } from "vitest";
import { mcpRouter } from "../src/mcp/server.js";

describe("MCP Streamable HTTP Protocol & Tools Suite", () => {
  it("responds correctly to JSON-RPC 'initialize'", async () => {
    let responseData: any = null;
    const req: any = {
      body: {
        jsonrpc: "2.0",
        id: "test-init-1",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      },
    };
    const res: any = {
      json: (data: any) => {
        responseData = data;
      },
      status: () => res,
    };

    await mcpRouter.handleDirectJsonRpc(req, res);
    expect(responseData).not.toBeNull();
    expect(responseData.jsonrpc).toBe("2.0");
    expect(responseData.id).toBe("test-init-1");
    expect(responseData.result.serverInfo.name).toBe("echo-chamber-breaker");
  });

  it("lists all 9 registered MCP tools via 'tools/list'", async () => {
    let responseData: any = null;
    const req: any = {
      body: {
        jsonrpc: "2.0",
        id: "test-list-1",
        method: "tools/list",
        params: {},
      },
    };
    const res: any = {
      json: (data: any) => {
        responseData = data;
      },
      status: () => res,
    };

    await mcpRouter.handleDirectJsonRpc(req, res);
    expect(responseData).toBeDefined();
    expect(responseData.result).toBeDefined();
    const tools = responseData.result.tools;
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(9);

    const toolNames = tools.map((t: any) => t.name);
    const expectedTools = [
      "analyze_stance",
      "steelman",
      "record_engagement",
      "start_debate",
      "continue_debate",
      "conclude_debate",
      "honesty_report",
      "challenge_me",
      "calibrate_baseline",
    ];

    for (const expected of expectedTools) {
      expect(toolNames).toContain(expected);
    }
  });

  it("executes 'analyze_stance' and detects blind spots", async () => {
    let responseData: any = null;
    const req: any = {
      body: {
        jsonrpc: "2.0",
        id: "call-1",
        method: "tools/call",
        params: {
          name: "analyze_stance",
          arguments: {
            statement: "Remote work is destroying company culture and productivity.",
            userId: "test-user-protocol",
          },
        },
      },
    };
    const res: any = {
      json: (data: any) => {
        responseData = data;
      },
      status: () => res,
    };

    await mcpRouter.handleDirectJsonRpc(req, res);
    expect(responseData).toBeDefined();
    expect(responseData.result).toBeDefined();
    const textContent = responseData.result.content[0].text;
    const parsed = JSON.parse(textContent);

    expect(parsed.say).toBeDefined();
    expect(parsed.structuredContent.detectedTopic).toContain("Work");
    expect(parsed.structuredContent.blindSpots.length).toBeGreaterThan(0);
    expect(parsed.structuredContent.confidence).toBeGreaterThan(0.5);
  });

  it("executes 'steelman' and guarantees voice-ready 'say' < 40 words", async () => {
    let responseData: any = null;
    const req: any = {
      body: {
        jsonrpc: "2.0",
        id: "call-steelman",
        method: "tools/call",
        params: {
          name: "steelman",
          arguments: {
            statement: "Offices are completely obsolete and companies should never force hybrid schedules.",
            userId: "test-user-protocol",
          },
        },
      },
    };
    const res: any = {
      json: (data: any) => {
        responseData = data;
      },
      status: () => res,
    };

    await mcpRouter.handleDirectJsonRpc(req, res);
    expect(responseData.result).toBeDefined();
    const textContent = responseData.result.content[0].text;
    const parsed = JSON.parse(textContent);

    expect(parsed.say).toBeDefined();
    const words = parsed.say.trim().split(/\s+/).length;
    expect(words).toBeLessThanOrEqual(40);
    expect(parsed.structuredContent.opposingThesis).toBeDefined();
    expect(parsed.structuredContent.coreArguments.length).toBeGreaterThan(0);
    expect(parsed.structuredContent.epistemicQuestion).toContain("?");
  });

  it("handles unknown tool errors gracefully with JSON-RPC error code -32601", async () => {
    let responseData: any = null;
    let statusCode = 200;
    const req: any = {
      body: {
        jsonrpc: "2.0",
        id: "call-unknown",
        method: "tools/call",
        params: {
          name: "non_existent_tool",
          arguments: {},
        },
      },
    };
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        responseData = data;
      },
    };

    await mcpRouter.handleDirectJsonRpc(req, res);
    expect(statusCode).toBe(404);
    expect(responseData.error.code).toBe(-32601);
  });
});
