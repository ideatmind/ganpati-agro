"use client";

import Link from "next/link";
import { useEffect,useState } from "react";

const links=[["#about","आमच्याबद्दल"],["#purpose","उद्देश"],["#clusters","समूह"],["#coverage","कार्यक्षेत्र"],["#membership","सभासदत्व"],["/register","नोंदणी"],["#contact","संपर्क"]];

export function MarketingNav(){const[scrolled,setScrolled]=useState(false);const[open,setOpen]=useState(false);useEffect(()=>{const onScroll=()=>setScrolled(window.scrollY>40);onScroll();window.addEventListener("scroll",onScroll,{passive:true});return()=>window.removeEventListener("scroll",onScroll)},[]);useEffect(()=>{document.body.style.overflow=open?"hidden":"";return()=>{document.body.style.overflow=""}},[open]);return <header className={`marketing-nav${scrolled?" scrolled":""}`}><div className="marketing-nav-inner"><nav className={open?"open":""} aria-label="Primary navigation">{links.map(([href,label])=><Link href={href} key={href} onClick={()=>setOpen(false)}>{label}</Link>)}<Link href="/login" onClick={()=>setOpen(false)}>लॉग इन</Link></nav><button className={`hamburger${open?" active":""}`} aria-expanded={open} aria-label={open?"Close menu":"Open menu"} onClick={()=>setOpen((value)=>!value)}><span/><span/><span/></button></div></header>}
