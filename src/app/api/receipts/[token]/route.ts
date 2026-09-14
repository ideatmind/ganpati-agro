import {z} from "zod";
import {callRpc} from "@/server/database";
import {api} from "@/server/http";
import type {ReceiptData} from "@/types";
export async function GET(request:Request,{params}:{params:Promise<{token:string}>}){return api(request,async()=>{
  const parsed=z.uuid().safeParse((await params).token);
  if(!parsed.success)return Response.json({error:'Receipt not found'},{status:404});
  const data=await callRpc<ReceiptData|null>('get_receipt',{p_public_token:parsed.data});
  return data?Response.json({data}):Response.json({error:'Receipt not found'},{status:404});
});}
