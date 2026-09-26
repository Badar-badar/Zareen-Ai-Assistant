import { Request, Response } from "express";
import { createMcpServer } from "../mcp/server/mcpServer.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types";
import { randomUUID } from "node:crypto";


const mcpServer = createMcpServer();

// session management

const USE_SESSIONS = true;

const sessionTransport :Record<string, StreamableHTTPServerTransport> = {};

export class mcpServerController{

    private static getSessionTransport(sessionId?:string){
        if(!USE_SESSIONS) return null;

        return sessionId ? sessionTransport[sessionId] : null;
     }

    private static createTransport(){
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: USE_SESSIONS ? () => randomUUID() : undefined,
            enableJsonResponse: true,
            onsessioninitialized: (sessionId: string) =>{
                if(USE_SESSIONS){
                    sessionTransport[sessionId] = transport;
                    console.log(`[MCP] Session created for user`)
                }
            }
        });
        if(USE_SESSIONS){
            transport.onclose = ()=>{
                if(transport.sessionId) delete sessionTransport[transport.sessionId]
            }
        }

        return transport;
    }

    static async handlePost(req: Request, res:Response){
        const sessionId = (req.headers['mcp-session-id'] as string) || undefined;
        let transport = mcpServerController.getSessionTransport(sessionId);
        if(USE_SESSIONS){
               if(!transport && isInitializeRequest(req.body)){
                   transport = mcpServerController.createTransport();

                   await mcpServer.connect(transport);
               } 
              if(!transport){
                 return res.status(400).json({
                     jsonrpc:'2.0',
                     error:{
                        code:404,
                        message:'Bad Request: No valid session ID provided'
                     },
                     id:null

                 });
              }
        }
        if(!USE_SESSIONS){
            transport = mcpServerController.createTransport();
           await mcpServer.connect(transport);
        }  
        await transport!.handleRequest(req, res, req.body);
    }    



    static async handleGet(req:Request, res:Response){
         if(!USE_SESSIONS){
            return res.status(400).send("This is not a valid session");
        }
        const sessionId = (req.headers['mcp-session-id'] as string) || undefined;
        let transport = mcpServerController.getSessionTransport(sessionId);
              
        if(!transport){
            return res.status(400).send("No valid session ID provided");
        }
        await transport.handleRequest(req, res, null);
    }


    static async handleDelete(req:Request, res:Response){
        const sessionId = (req.headers['mcp-session-id'] as string) || undefined;
        if(!USE_SESSIONS){
            return res.status(400).send("This is not a valid session");
        }
        const transport = mcpServerController.getSessionTransport(sessionId);
        if(!transport){
            return res.status(400).send("No valid session ID provided");
        }
        await transport.handleRequest(req, res, null);
    }


    
}   


 