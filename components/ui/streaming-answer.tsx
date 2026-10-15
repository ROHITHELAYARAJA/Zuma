"use client";
import { useEffect,useRef } from "react";
export default function StreamingAnswer({text,streaming=false}:{text:string;streaming?:boolean}){
 const tail=useRef<HTMLSpanElement>(null);
 useEffect(()=>{if(streaming&&tail.current){const rect=tail.current.getBoundingClientRect();if(rect.top<window.innerHeight+120&&rect.bottom>0)tail.current.scrollIntoView({block:"nearest",behavior:"auto"});}},[text,streaming]);
 return <div className="zuma-answer-text" aria-busy={streaming}>{text.split("\n").map((line,i)=>line&&!line.startsWith("•")?<h3 key={i}>{line}</h3>:line?<p key={i}>{line.replace(/^•\s*/,"")}</p>:null)}<span ref={tail} className={streaming?"zuma-caret":""} aria-hidden="true"/></div>;
}
