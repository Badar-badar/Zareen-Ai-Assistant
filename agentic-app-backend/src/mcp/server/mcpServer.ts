import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {registerCustomerTools} from "./tools/customer.tool.js"
import {registerOrderTools} from "./tools/order.tool.js"
import {registerWeatherTools} from "./tools/weather.tool.js"
import {registerRagTools} from "./tools/rag.tool.js"

export function createMcpServer() {
    const server = new McpServer({
        name: "Zareena's ERP",
        version: "1.0.0",
        description: "Zareena's ERP MCP Server",
    });
    // Register tools
    registerCustomerTools(server);
    registerOrderTools(server);
    registerWeatherTools(server);


    registerRagTools(server);
    
    return server;
}
