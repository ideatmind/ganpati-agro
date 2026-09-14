// Test-only loader: resolve the application's aliases and the Next build-time marker.
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve as resolvePath } from 'node:path';
export async function resolve(specifier,context,nextResolve){
  if(specifier==='server-only')return {url:'data:text/javascript,export {};',shortCircuit:true};
  if(specifier.startsWith('@/')){
    const base=resolvePath('src',specifier.slice(2));
    for(const extension of ['.ts','.tsx'])if(existsSync(base+extension))return {url:pathToFileURL(base+extension).href,shortCircuit:true};
  }
  return nextResolve(specifier,context);
}
