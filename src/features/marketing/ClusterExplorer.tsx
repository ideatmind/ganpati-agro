"use client";

import { CROP_CATEGORIES, CROP_LABELS } from "@/shared/crop-catalog";
import { useRef,useState,type KeyboardEvent } from "react";

const groups = CROP_CATEGORIES;

export function ClusterExplorer(){const[active,setActive]=useState(0);const refs=useRef<(HTMLButtonElement|null)[]>([]);function keyDown(event:KeyboardEvent<HTMLButtonElement>,index:number){if(!["ArrowLeft","ArrowRight"].includes(event.key))return;event.preventDefault();const next=(index+(event.key==="ArrowRight"?1:-1)+groups.length)%groups.length;setActive(next);refs.current[next]?.focus()}return <><div className="cluster-tabs" role="tablist" aria-label="Crop groups">{groups.map((group,index)=><button key={group.id} ref={(el)=>{refs.current[index]=el}} id={`tab-${group.id}`} role="tab" aria-controls={active===index?`panel-${group.id}`:undefined} tabIndex={active===index?0:-1} aria-selected={active===index} className={active===index?"active":""} onClick={()=>setActive(index)} onKeyDown={(event)=>keyDown(event,index)}>{group.label}</button>)}</div><div className="cluster-panel" role="tabpanel" id={`panel-${groups[active].id}`} aria-labelledby={`tab-${groups[active].id}`} tabIndex={0} key={groups[active].id}>{groups[active].crops.map((item)=><span className="crop-chip" key={item}>{CROP_LABELS[item]}</span>)}</div></>}
