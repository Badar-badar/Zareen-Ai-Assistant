import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../server/mcpServer.js";

class MCPClientService {
    private static instance: MCPClientService | null = null;
    public client: Client;
    private tools: any[] = [];
    private initPromise: Promise<MCPClientService> | null = null;

    private constructor() {
        this.client = new Client({
            name: "node-mcp-client",
            version: "1.0.0"
        });
    }

    static getInstance(): MCPClientService {
        if (!MCPClientService.instance) {
            MCPClientService.instance = new MCPClientService();
        }
        return MCPClientService.instance;
    }

    async init(): Promise<MCPClientService> {
        this.initPromise ??= (async () => {
            const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
            await createMcpServer().connect(serverTransport);
            await this.client.connect(clientTransport);
            return this;
        })().catch((err) => {
            this.initPromise = null;
            throw err;
        });
        return this.initPromise;
    }

    async getTools() {
        await this.init();
        if (this.tools.length === 0) {
            const list = await this.client.listTools();
            this.tools = list.tools;
        }
        return this.tools;
    }

    async callTool(toolName: string, args: Record<string, any> = {}) {
        const tools = await this.getTools();
        const tool = tools.find((t) => t.name === toolName);
        if (!tool) throw new Error(`Tool '${toolName}' not found`);

        return this.client.callTool({ name: toolName, arguments: args });
    }
}

export const MCPClient = MCPClientService.getInstance();