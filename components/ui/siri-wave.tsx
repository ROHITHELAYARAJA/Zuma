"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
export type SiriWaveVariant="wave"|"fluid-dots";
const VERTEX_SHADER="attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}";
const SHADER=`precision highp float;
uniform vec2 iResolution;uniform float iTime;uniform float iLevel;uniform float iVariant;
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
void main(){
 vec2 p=(2.*gl_FragCoord.xy-iResolution)/min(iResolution.x,iResolution.y);
 float t=iTime;float d=10.;float energy=clamp(iLevel,0.,1.);
 if(iVariant>.5){
  for(int i=0;i<6;i++){
   float f=float(i);float a=f*6.2831853/6.+t*.45;
   float gather=.5+.5*sin(t*.72);float r=mix(.26,.07,pow(gather,5.));
   vec2 center=vec2(cos(a),sin(a))*r;
   float radius=.052+.012*sin(t*1.6+f)+energy*.024;
   d=smin(d,length(p-center)-radius,.055);
  }
 }else{
  float envelope=exp(-p.x*p.x*3.);
  for(int i=0;i<4;i++){
   float f=float(i);float y=sin(p.x*7.+t*2.4+f*.8)*(.07+energy*.22)*envelope;
   d=min(d,abs(p.y-y)-.008);
  }
 }
 float core=1.-smoothstep(-.006,.015,d);float glow=exp(-max(d,0.)*22.)*.38;
 vec3 orange=vec3(1.,.357,.243);vec3 yellow=vec3(1.,.84,.30);
 vec3 ink=mix(orange,yellow,.5+.5*sin(p.x*4.+p.y*3.+t*.4));
 gl_FragColor=vec4(ink,clamp(core+glow,0.,1.));
}`;
export interface SiriWaveProps extends Omit<React.HTMLAttributes<HTMLCanvasElement>,"children">{variant?:SiriWaveVariant;size?:number;renderScale?:number;level?:number;active?:boolean}
export function SiriWave({variant="fluid-dots",size=180,renderScale=.85,level=0,active=true,className,style,...props}:SiriWaveProps){
 const canvasRef=React.useRef<HTMLCanvasElement>(null);const levelRef=React.useRef(level);const [fallback,setFallback]=React.useState(false);
 React.useEffect(()=>{levelRef.current=level;},[level]);
 React.useEffect(()=>{
  const canvas=canvasRef.current;if(!canvas)return;
  const gl=canvas.getContext("webgl",{alpha:true,antialias:false,premultipliedAlpha:false});if(!gl){setFallback(true);return;}
  const shaders:WebGLShader[]=[];let program:WebGLProgram|null=null;let buffer:WebGLBuffer|null=null;let raf=0;let visible=true;let lost=false;
  const motion=window.matchMedia("(prefers-reduced-motion: reduce)");
  const compile=(type:number,source:string)=>{const shader=gl.createShader(type);if(!shader)throw new Error("SHADER_UNAVAILABLE");shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error("SHADER_UNAVAILABLE");return shader;};
  try{
   program=gl.createProgram();if(!program)throw new Error("PROGRAM_UNAVAILABLE");gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX_SHADER));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,SHADER));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error("PROGRAM_UNAVAILABLE");gl.useProgram(program);
   buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);const position=gl.getAttribLocation(program,"aPos");gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
   const resolution=gl.getUniformLocation(program,"iResolution"),time=gl.getUniformLocation(program,"iTime"),audio=gl.getUniformLocation(program,"iLevel"),mode=gl.getUniformLocation(program,"iVariant");
   const dim=Math.max(48,Math.min(720,Math.round(size*renderScale*Math.min(window.devicePixelRatio||1,2))));canvas.width=dim;canvas.height=dim;gl.viewport(0,0,dim,dim);const start=performance.now();
   const draw=()=>{if(lost)return;if(visible&&!document.hidden){gl.uniform2f(resolution,dim,dim);gl.uniform1f(time,motion.matches||!active?0:(performance.now()-start)/1000);gl.uniform1f(audio,levelRef.current);gl.uniform1f(mode,variant==="fluid-dots"?1:0);gl.drawArrays(gl.TRIANGLES,0,3);}if(active&&!motion.matches)raf=requestAnimationFrame(draw);};
   const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;});observer.observe(canvas);
   const onLost=(event:Event)=>{event.preventDefault();lost=true;cancelAnimationFrame(raf);setFallback(true);};canvas.addEventListener("webglcontextlost",onLost);draw();
   return()=>{observer.disconnect();canvas.removeEventListener("webglcontextlost",onLost);cancelAnimationFrame(raf);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);shaders.forEach(shader=>gl.deleteShader(shader));};
  }catch{setFallback(true);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);shaders.forEach(shader=>gl.deleteShader(shader));}
 },[variant,size,renderScale,active]);
 if(fallback)return <span aria-hidden="true" className="zuma-orb-fallback" style={{width:size,height:size}}/>;
 return <canvas ref={canvasRef} aria-hidden="true" className={cn("block max-w-full rounded-card",className)} style={{width:size,height:size,...style}} {...props}/>;
}
export default SiriWave;
