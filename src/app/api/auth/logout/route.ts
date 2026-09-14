import {clearSession} from "@/server/session";
import {api} from "@/server/http";
export async function POST(request:Request){return api(request,async()=>{await clearSession();return Response.json({data:{ok:true}})});}
