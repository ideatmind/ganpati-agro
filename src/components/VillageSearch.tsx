'use client';
import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {VILLAGE_PACKS} from '@/features/geography/directory';
import {parseVillagePack,searchVillages,villageValue,type Village} from '@/features/geography/search';
import './village-search.css';
const packs:Record<string,{path:string;count:number}>=VILLAGE_PACKS;
const batchSize=30;
// Download only the selected taluka's small pack; render more options as the user scrolls.
const cache=new Map<string,Village[]>();
export function VillageSearch({id='village',taluka,value,onChange,disabled=false,required=true}:{id?:string;taluka:string;value:string;onChange:(value:string)=>void;disabled?:boolean;required?:boolean}){
 const path=packs[taluka]?.path;const [loaded,setLoaded]=useState<{path?:string;rows:Village[];error?:string}>({rows:[]});
 const [open,setOpen]=useState(Boolean(taluka)&&!value);const [active,setActive]=useState(-1);const [retry,setRetry]=useState(0);const [query,setQuery]=useState('');const [visibleCount,setVisibleCount]=useState(batchSize);const list=useRef<HTMLUListElement>(null);
 useEffect(()=>{
  if(!path||disabled)return;const controller=new AbortController();
  async function load(){try{let rows=cache.get(path!);if(!rows){const response=await fetch(path!,{cache:'force-cache',signal:controller.signal});if(!response.ok)throw Error();rows=parseVillagePack(await response.json());if(controller.signal.aborted)return;cache.set(path!,rows);}if(!controller.signal.aborted)setLoaded({path,rows});}catch{if(!controller.signal.aborted)setLoaded({path,rows:[],error:'Village list could not load. Retry or enter the village name.'});}}
  void load();return()=>controller.abort();
 },[path,disabled,retry]);
 const ready=loaded.path===path;const rows=ready?loaded.rows:[];const results=searchVillages(rows,query,visibleCount);const expanded=open&&!disabled&&Boolean(path)&&results.items.length>0;
 const listId=id+'-options';const helpId=id+'-help';const more=results.items.length<results.total;
 const activeId=expanded&&active>=0&&results.items[active]?`${listId}-${results.items[active][0]}`:undefined;
 useEffect(()=>{if(activeId)document.getElementById(activeId)?.scrollIntoView({block:'nearest'});},[activeId]);
 function browse(){setQuery('');setVisibleCount(batchSize);setActive(-1);setOpen(true);if(list.current)list.current.scrollTop=0;}
 function loadMore(){setVisibleCount(count=>Math.min(count+batchSize,results.total));}
 function choose(row:Village){onChange(villageValue(row,rows));setOpen(false);setActive(-1);setQuery('');}
 function keyDown(event:KeyboardEvent<HTMLInputElement>){
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);const next=event.key==='ArrowDown'?Math.min(active+1,results.total-1):Math.max(active-1,0);if(next>=visibleCount)setVisibleCount(count=>count+batchSize);setActive(next);}
  else if(event.key==='Enter'&&expanded&&active>=0&&results.items[active]){event.preventDefault();choose(results.items[active]);}
  else if(event.key==='Escape'){setOpen(false);setActive(-1);}
 }
 return <div className="village-search" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}><label htmlFor={id}>गाव <em>Village</em> {required&&<b>*</b>}</label><div className="village-input-row"><input id={id} name="village" role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={listId} aria-activedescendant={activeId} aria-describedby={helpId} autoComplete="off" required={required} maxLength={200} value={value} disabled={disabled||!taluka} placeholder={taluka?'गाव निवडा किंवा शोधा / Choose or search':'प्रथम तालुका निवडा / Select taluka first'} onFocus={browse} onChange={event=>{onChange(event.target.value);setQuery(event.target.value);setVisibleCount(batchSize);setOpen(true);setActive(-1);if(list.current)list.current.scrollTop=0;}} onKeyDown={keyDown}/><button type="button" className="village-browse" aria-label={expanded?'Close village list':'Browse all villages in selected taluka'} aria-expanded={expanded} aria-controls={listId} disabled={disabled||!taluka} onClick={()=>expanded?setOpen(false):browse()}>⌄</button></div>
 {expanded&&<div className="village-dropdown"><ul ref={list} id={listId} role="listbox" aria-label="Village suggestions" className="village-options" onScroll={event=>{const target=event.currentTarget;if(more&&target.scrollHeight-target.scrollTop-target.clientHeight<64)loadMore();}}>{results.items.map((row,index)=><li key={row[0]} id={`${listId}-${row[0]}`} role="option" aria-selected={active===index} aria-posinset={index+1} aria-setsize={results.total} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(row)}><span>{row[2]} / {row[1]}</span><small>गाव क्रमांक / Village code: {row[0]}</small></li>)}</ul><div className="village-list-footer"><span>{results.items.length} / {results.total} villages</span>{more&&<button type="button" onClick={loadMore}>आणखी गावे / Load more</button>}</div></div>}
 <small id={helpId} className="village-help" role="status">{!taluka?'जिल्हा आणि तालुका निवडा. / Choose district and taluka.':!ready&&!disabled?'गावांची यादी येत आहे… / Loading villages…':loaded.error?loaded.error:open&&ready?`${results.total} ${query?'matches':'villages'} · Scroll to browse; search is optional. गाव नसल्यास नाव लिहा. / If missing, enter its name.`:'यादीतून गाव निवडा; शोध ऐच्छिक आहे. / Browse villages or search by name/code.'}</small>
 {ready&&loaded.error&&<button className="village-retry" type="button" onClick={()=>{setLoaded({rows:[]});setRetry(n=>n+1);}}>Retry village list</button>}</div>;
}
