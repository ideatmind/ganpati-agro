"use client";

import { useEffect,useRef } from "react";

export function AnimatedCounter({target}:{target:number}){const ref=useRef<HTMLSpanElement>(null);useEffect(()=>{const element=ref.current;if(!element)return;const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;if(reduce){element.textContent=target.toLocaleString("mr-IN");return}let frame=0;const observer=new IntersectionObserver((entries)=>{if(!entries.some((entry)=>entry.isIntersecting))return;observer.disconnect();const started=performance.now();const step=(now:number)=>{const progress=Math.min((now-started)/1400,1);element.textContent=Math.round((1-(1-progress)**3)*target).toLocaleString("mr-IN");if(progress<1)frame=requestAnimationFrame(step)};frame=requestAnimationFrame(step)},{threshold:.5});observer.observe(element);return()=>{observer.disconnect();cancelAnimationFrame(frame)}},[target]);return <span ref={ref}>0</span>}
