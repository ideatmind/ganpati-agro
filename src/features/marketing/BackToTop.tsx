"use client";

import { useEffect,useState } from "react";

export function BackToTop(){const[visible,setVisible]=useState(false);useEffect(()=>{const listener=()=>setVisible(window.scrollY>500);listener();window.addEventListener("scroll",listener,{passive:true});return()=>window.removeEventListener("scroll",listener)},[]);return <><a className="mobile-call" href="tel:+917030039005" aria-label="Call Ganpati Agro">☎</a><button className={`back-to-top${visible?" visible":""}`} aria-label="Back to top" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}>↑</button></>}
