import { z } from "zod";
import { clientIp } from "@/server/rate-limit";
import { loginSession } from "@/server/session";
import { api,readJson } from "@/server/http";
import { AppError } from "@/shared/errors";
import {mobileSchema} from '@/shared/credential-schema';
const schema=z.object({mobile:mobileSchema,password:z.string().min(8).max(72)});
export async function POST(request:Request) {
  return api(request,async()=>{
    const body=schema.parse(await readJson(request));
    const identity=await loginSession(body.mobile,body.password,clientIp(request.headers));
    if(!identity)throw new AppError(401,'INVALID_CREDENTIALS','Invalid mobile number or password.');
    return Response.json({data:identity});
  });
}
