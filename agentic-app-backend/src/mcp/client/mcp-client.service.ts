import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

class MCPClientService {
    private static instance: MCPClientService | null = null;
    public client: Client;
    private tools: any[] = [];
    private initialized: boolean = false;

    private constructor() {
        this.client = new Client({
            name: 'node-mcp-client',
            version: '1.0.0'
        });
    }

    static getInstance(): MCPClientService {
        if (!MCPClientService.instance) {
            MCPClientService.instance = new MCPClientService();
        }
        return MCPClientService.instance;
    }

    async init() {
        if (this.initialized) return this;

        const port = process.env.PORT || process.env.MCP_PORT || 4200;
        const host = (process.env.SERVER || 'http://localhost').replace(/:[0-9]+$/, '').replace(/\/$/, '');
        const url = `${host}:${port}/mcp`;
        const transport = new StreamableHTTPClientTransport(new URL(url));

        await this.client.connect(transport);
        this.initialized = true;
        return this;
    }

    // call mcp server tools 
    async getTools() {
        await this.init();
        if (this.tools.length === 0) {
            const list = await this.client.listTools();
            this.tools = list.tools;
        }
        return this.tools;
    }

    async callTool(toolName: string, args: Record<string, any> = {}) {
        if (!this.initialized) {
        await this.init();
    }
        // await this.getTools();

        // Find the tool by name to get the full tool object with spec
        const tool = this.tools.find(t => t.name === toolName);
        if (!tool) throw new Error(`Tool '${toolName}' not found`);

        // Call the tool
        const response = await this.client.callTool({
            name: toolName,
            arguments: args,
        });

        return response;
    }
}

export const MCPClient = MCPClientService.getInstance();