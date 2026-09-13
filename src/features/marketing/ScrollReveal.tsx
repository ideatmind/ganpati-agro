"use client";

import { useEffect,useRef,type HTMLAttributes,type ReactNode } from "react";

export function ScrollReveal({children,className="",...rest}:HTMLAttributes<HTMLDivElement>&{children:ReactNode}){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const element=ref.current;if(!element)return;if(!("IntersectionObserver" in window)||window.matchMedia("(prefers-reduced-motion: reduce)").matches){element.classList.add("visible");return}const observer=new IntersectionObserver((entries)=>{if(entries.some((entry)=>entry.isIntersecting)){element.classList.add("visible");observer.disconnect()}},{threshold:.12,rootMargin:"0px 0px -40px"});observer.observe(element);return()=>observer.disconnect()},[]);
  return <div ref={ref} className={`reveal ${className}`.trim()} {...rest}>{children}</div>;
}
