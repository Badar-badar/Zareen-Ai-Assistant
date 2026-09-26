import OpenAI from "openai";

import { Client } from "@modelcontextprotocol/sdk/client";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

const jsonPrimitive = z.union([z.string(),z.number(),z.boolean(),z.null()]);
const ToolArgumentSchema = z.record(z.string(), jsonPrimitive);
const ToolIntentSchema = z.object({
    action:z.enum(["tool","final"]),
    tool:z.string().nullable(),
    arguments:ToolArgumentSchema.nullable(),
    output:z.string().nullable()
}).refine((data)=>{
   if(data.action==="final"){
     return data.tool === null && data.arguments === null && data.output !== null;
   }else if(data.action === "tool"){
    return data.tool !== null && data.arguments !== null && data.output === null;
   }
}, {
  message: "Invalid ToolIntentSchema	",
  path: ["action"],
});


// Define tools based on their description
class OpenaiService{
      private static instance: OpenaiService;
      private readonly modelName: string;
      private readonly openAI: OpenAI;
      private readonly MAX_STEPS = 6;
    
      constructor(modelName: string = process.env.OPENAI_MODEL || "gpt-4.1-mini"){
        const apiKey = process.env.OPENAI_API_KEY;
        if(!apiKey){
            throw new Error("Missing OPENAI_API_KEY environment variable")
        }
        if(!modelName){
            throw new Error("Missing OPENAI_MODEL environment variable")
        }
        this.modelName = modelName;
        this.openAI = new OpenAI({apiKey});
      }

      static getInstance(modelName?:string): OpenaiService{
        if(!OpenaiService.instance){
            OpenaiService.instance = new OpenaiService();
        }
        return OpenaiService.instance;
      }

      async generateResponse(prompt: string): Promise<string> {
         try {
           const response = await this.openAI.chat.completions.create({
             model: this.modelName,
             messages: [{ role: "user", content: prompt }]
           });
           return response.choices[0]?.message?.content || "";
         } catch(error) {
           console.error("Error in generateResponse:", error);
           throw error;
         }
      }

      async generateEmbeddings(data: string | string[]): Promise<number[][]> {
        try {
          const response = await this.openAI.embeddings.create({
            model: "text-embedding-3-small",
            input: data,
            encoding_format: "float"
          });
          const embeddings = response.data.map((e) => e.embedding);
          return embeddings;
        } catch (error) {
          console.error("Error generating embeddings", error);
          throw new Error("Error generating embeddings");
        }
      }

      async generateResponseWithTools(prompt:string, mcpClient: Client): Promise<string>{
        
             const mcpTools = await mcpClient.listTools();
             const toolContext  = mcpTools.tools.map(t => ({
                name:t.name,
                description:t.description,
                inputSchema:t.inputSchema,
                outputSchema:t.outputSchema
             }));
              
             const systemInstruction = `You are an AI assistant with access to internal tools via MCP.
                                        Use ragSearch FIRST for refunds, policies, documentation, or help queries.
                                        Use other tools only when clearly relevant.
                                        If no tool is required, answer directly.
                                        Do NOT mention tool usage unless asked.
                                        Keep responses concise and helpful.`;

             const responseContract = `You must always respond in valid json.
                                      if no tool is requred: {
                                        "action": "final",
                                        "tool":null,
                                        "arguments":null,
                                        "output": "<response></response>"
                                      } 
                                      if tool is required:{
                                        "action": "tool",
                                        "tool": "<tool_name>",
                                        "arguments": "<json_arguments>",
                                        "output": null
                                      }
                                      Never respond with plain text. 
                                      ` ;

              let messages: any[] = [
                { role: "developer", content: systemInstruction },
                { role: "developer", content: responseContract },
                { role: "developer", content: JSON.stringify(toolContext, null, 2) },
                { role: "user", content: prompt }
              ];
             
              for (let step = 0; step < this.MAX_STEPS; step++) {
                let intent: any;
                try {
                  const response = await (this.openAI as any).responses.parse({
                    model: this.modelName,
                    input: messages,
                    text: {
                      format: zodTextFormat(ToolIntentSchema, "intent"),
                    }
                  });

                  if (!response.output_parsed) {
                    throw new Error("Failed to parse response from model");
                  }
                  intent = response.output_parsed;
                } catch (error: any) {
                  throw new Error(`Sorry, I could not process that properly. Please try again. ${error?.message || error}`);
                }

                if (intent.action === "tool") {
                  const result = await mcpClient.callTool({
                    name: intent.tool!,
                    arguments: intent.arguments!,
                  });

                  messages.push({
                    role: "assistant",
                    content: JSON.stringify({
                      intent
                    })
                  });
                  messages.push({
                    role: "developer",
                    content: `
                        MCP tool "${intent.tool}" executed.
                        Structured Output:
                        ${JSON.stringify((result as any).structuredContent, null, 2)} 
                    `,
                  });
                  continue;
                }

                if (intent.action === "final") {
                  return intent.output!;
                }
              }

              throw new Error("Maximum number of steps reached without final response.");
       }
}

export const OPENAI = OpenaiService.getInstance();


