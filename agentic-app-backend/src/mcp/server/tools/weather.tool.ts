import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchWeather } from "../../../services/weather.service.js";

export function registerWeatherTools(mcpServer: McpServer) {
    mcpServer.registerTool(
        "fetchWeather",
        {
            title: "Get Weather",
            description: "Get the weather of a city from external API",
            inputSchema: z.object({
                city: z.string().describe("City name")
            }),
            outputSchema: z.object({
                weather: z.any(),
            })
        },
        async ({ city }) => {
            const weather = await fetchWeather(city);
            return {
                content: [{    type: "text",  text: JSON.stringify(weather, null, 2) }],
                structuredContent:{weather},
            };
        }
    );
}