"use client";
import { useEffect, useRef, useState } from "react";

export function HeroVideo() {
  const ref=useRef<HTMLVideoElement>(null);const [playing,setPlaying]=useState(false);
  useEffect(()=>{
    const preference=window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop=window.matchMedia('(min-width: 768px)');
    const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection;
    const video=ref.current;let visible=false;
    const sync=()=>{if(!video)return;if(!visible||preference.matches||!desktop.matches||connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType||''))video.pause();else {if(!video.getAttribute('src'))video.src='/videos/hero-light.mp4';void video.play().catch(()=>{});}};
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});if(video)observer.observe(video);
    preference.addEventListener("change",sync);desktop.addEventListener('change',sync);
    return()=>{observer.disconnect();preference.removeEventListener("change",sync);desktop.removeEventListener('change',sync);};
  },[]);
  function toggle(){const video=ref.current;if(!video)return;if(playing)video.pause();else {if(!video.getAttribute('src'))video.src='/videos/hero-light.mp4';void video.play().catch(()=>{});}}
  return <><video ref={ref} muted loop playsInline preload="none" poster="/images/about-farm.jpg" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} aria-hidden="true"/><button type="button" className="hero-video-control" onClick={toggle}>{playing?"Pause background video":"Play background video"}</button></>;
}
