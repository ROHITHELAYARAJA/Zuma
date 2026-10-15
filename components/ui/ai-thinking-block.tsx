"use client";
import { useEffect,useState } from "react";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
export default function AIThinkingBlock({voice=false}:{voice?:boolean}){
 const [timer,setTimer]=useState(0);
 useEffect(()=>{const interval=setInterval(()=>setTimer(t=>t+1),1000);return()=>clearInterval(interval);},[]);
 return <Card size="sm" className="zuma-thinking" role="status" aria-live="polite"><CardHeader><CardTitle className="flex items-center gap-2"><Loader size="sm" variant="primary"/><span className="zuma-shimmer">{voice?"Preparing your voice answer":"Preparing your clinical brief"}</span><span className="zuma-timer" aria-hidden="true">{timer}s</span></CardTitle></CardHeader><CardContent><div className="zuma-status-scroll"><p>{voice?"Nova is processing your recording. The same patient and permission checks apply.":"Your request is being checked against the permitted patient records."}</p><p>The answer uses retrieved AWS evidence and is checked for supporting sources before it appears.</p><p className="zuma-status-note">Your answer appears after the evidence check.</p></div>{timer>=45&&<p>Still working. A sleeping demo service can take longer to respond. You can stop this request.</p>}</CardContent></Card>;
}
