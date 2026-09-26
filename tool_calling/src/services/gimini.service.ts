// Import official Google Gen AI SDK types and modules
import { GoogleGenAI, FunctionCallingConfigMode, FunctionDeclaration, Type, ContentListUnion, ToolListUnion, GenerateContentResponse } from "@google/genai";
// Import local service handlers for tool execution
import { weatherService } from "./weather.service.ts";
import { getAllCustomers, getCustomerById } from "./customer.service.ts";

/**
 * Service class for interacting with the Google Gemini API, including simple chat completion and function calling (tool use).
 */
export class giminiService {
   apiKey: string;
   model: string;
   embeddingModel: string;
   gemini: GoogleGenAI;
   
   /**
    * Initializes the Gemini service with API credentials and model configuration.
    */
   constructor(model: string = "gemini-3.6-flash", embeddingModel: string = "gemini-embedding-001") {
      this.apiKey = process.env.GEMINI_API_KEY as string;
      this.model = model;
      this.embeddingModel = embeddingModel;
      // Instantiate the GoogleGenAI client instance
      this.gemini = new GoogleGenAI({ apiKey: this.apiKey });
   }

   /**
    * Generates a simple text response from the Gemini model without function calling.
    */
   async generateResponse(message: string): Promise<string> {
      try {
         const response = await this.gemini.models.generateContent({
            model: this.model,
            contents: message,
         });
         
         return response.text ?? "";
      } catch (error: any) {
         console.error("Error in generateResponse:", error);
         throw error;
      } 
   }

   /**
    * Low-level helper to execute a generateContent API call with optional tools attached.
    */
   async CallLLM(contents: ContentListUnion, tools?: ToolListUnion): Promise<GenerateContentResponse> {
      try {
         const response = await this.gemini.models.generateContent({
            model: this.model,
            contents: contents,
            config: tools ? { tools } : undefined,
         });
         
         return response;
      } catch (error: any) {
         console.error("Error in CallLLM:", error);
         throw error;
      } 
   }

   /**
    * Handles user queries with Tool Calling capabilities.
    * Automatically detects function call requests from Gemini, executes local logic, and submits results back to Gemini.
    */
   async generateResponseWithTools(prompt: string): Promise<string> {
      try {
         // Define function schema for weather fetching tool
         const getWeatherDeclaration: FunctionDeclaration = {
            name: "get_weather",
            description: "get the weather of a city",
            parameters: {
               type: Type.OBJECT,
               properties: {
                  location: {
                     type: Type.STRING,
                     description: "the location name is required it may be country and and location",
                  },
               },
               required: ["location"],
            },
         };

         // Define function schema for customer lookup tool
         const getCustomerDeclaration: FunctionDeclaration = {
            name: "get_all_customers",
            description: "Get all customer details or search for a specific customer if customerId is provided",
            parameters: {
               type: Type.OBJECT,
               properties: {
                  customerId: {
                     type: Type.STRING,
                     description: "the customer id (optional, omit to get all customers)",
                  },
               },
            },
         };

         // Combine function declarations into the tools list parameter
         const tools = [{
            functionDeclarations: [getWeatherDeclaration, getCustomerDeclaration]
         }];

         // Initial call to Gemini passing the user message and available tools
         const response = await this.CallLLM(prompt, tools);
          
         // Check if Gemini requested to execute a tool/function call
         if (response?.functionCalls && response.functionCalls.length > 0) {
             const funCall = response.functionCalls[0];
             const { name, args } = funCall; 
             let result: any;

             // Dispatch to appropriate tool implementation based on function name
             switch (name) {
                case "get_weather":
                      result = await weatherService.fetchWeather((args?.location || args?.city) as string);
                      break;
                case "get_all_customers":
                      result = args?.customerId 
                        ? await getCustomerById(args.customerId as string)
                        : await getAllCustomers();
                      break;
                default:
                      throw new Error("Invalid function call");
             }

             // Send tool execution output back to Gemini in a follow-up request
             const responseFollowUp = await this.CallLLM([
                {
                    role: "user",
                    parts: [
                      {
                         text: `${prompt}`
                      }
                    ]
                },
                {
                    role: "model",
                    parts: response.candidates?.[0]?.content?.parts || [
                      {
                         functionCall: {
                            name,
                            args
                         }
                      }
                    ]
                },
                {
                    role: "user",
                    parts: [
                       {
                          functionResponse: {
                             name,
                             response: { result }
                          }
                       }
                    ]
                }
              ], tools);

             // Return the final LLM-generated answer based on the tool results
             return responseFollowUp.text ?? "No response generated";
         }

         // Return direct response if no function calls were invoked
         return response.text ?? "No response generated";
      } catch (error: any) {
         console.error("Error in generateResponseWithTools:", error);
         throw error;
      }
   }
}
