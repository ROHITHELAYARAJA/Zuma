import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createAbdmRouter } from "../server/abdm";
import { ClinicalError } from "../server/clinical/engine";
import dataset from "../data/abdm/dataset.json";
import type { StateSession } from "../server/state-store";
import type { AuthIdentity } from "../server/auth";
const identity:AuthIdentity={userId:null,actor:{id:"test-doctor",name:"Test doctor",role:"doctor",hospitalId:"B",hospital:"Hospital B"}};
let session:StateSession & {identity:AuthIdentity};
let app:Hono;
beforeEach(()=>{
 vi.stubEnv("AUTH_PROVIDER","demo");vi.stubEnv("RAG_SERVICE_API_KEY","a".repeat(64));vi.stubEnv("RAG_SERVICE_URL","http://localhost:8795");
 session={id:"a".repeat(64),userId:null,identity,version:1,expiresAt:Date.now()+60000,data:{states:{},createdAt:new Date().toISOString()}};
 app=new Hono();app.onError((error,c)=>error instanceof ClinicalError?c.json({message:error.message},error.status as 400):c.json({message:"Unexpected failure"},500));
 app.route("/api/abdm",createAbdmRouter({getSession:async()=>session,persist:async()=>{}}));
 vi.stubGlobal("fetch",vi.fn(async(_url,init)=>{const scope=JSON.parse(String(init?.body));return Response.json({answer:"Overview\n• Recorded source finding. [1]\n\nReview needed\n• Inspect the source. [1]",citations:[{id:"abdm-a:claim-1",quote:"Recorded source finding.",sourceUrl:dataset.reports[0].source}],sourceVersion:scope.sourceVersion,mode:"bedrock-kb",warning:"Sample evidence"});}));
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it("denies streaming before report-specific permission",async()=>{const response=await app.request("/api/abdm/reports/abdm-a/chat/stream",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:"Show findings"})});expect(response.status).toBe(403);expect(fetch).not.toHaveBeenCalled();});
it("streams the checked answer and final citations after permission",async()=>{
 await app.request("/api/abdm/reports/abdm-a/consent/grant",{method:"POST"});
 const response=await app.request("/api/abdm/reports/abdm-a/chat/stream",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:"Show findings"})});
 expect(response.headers.get("content-type")).toContain("text/event-stream");
 const text=await response.text();const events=text.split("\n\n").filter(Boolean).map(frame=>({event:frame.split("\n").find(l=>l.startsWith("event:"))?.slice(6).trim(),data:JSON.parse(frame.split("\n").find(l=>l.startsWith("data:"))!.slice(5))}));
 expect(events[0].event).toBe("answer.start");expect(events.filter(e=>e.event==="answer.delta").map(e=>e.data.text).join("")).toContain("Recorded source finding.");expect(events.at(-1)?.event).toBe("answer.complete");expect(events.at(-1)?.data.citations).toHaveLength(1);
});
it("stops before another paragraph if permission is revoked mid-stream",async()=>{
 await app.request("/api/abdm/reports/abdm-a/consent/grant",{method:"POST"});
 const response=await app.request("/api/abdm/reports/abdm-a/chat/stream",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:"Show findings"})});
 const reader=response.body!.getReader();let received="";const decoder=new TextDecoder();
 while(!received.includes("answer.delta")){const part=await reader.read();received+=decoder.decode(part.value);}
 const data=session.data as typeof session.data & {abdm:Record<string,{consent:{active:boolean}}>};data.abdm["abdm-a"].consent.active=false;
 while(true){const part=await reader.read();if(part.done)break;received+=decoder.decode(part.value);}
 expect(received).toContain("answer.error");expect(received).not.toContain("answer.complete");
});

it("persists source identity decisions and blocks retrieval after rejection",async()=>{
 await app.request("/api/abdm/reports/abdm-a/consent/grant",{method:"POST"});
 const before=await (await app.request("/api/abdm/reports/abdm-a/workspace")).json();
 const reviewed=await app.request("/api/abdm/reports/abdm-a/identity/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision:"rejected",sourceVersion:before.sourceVersion})});
 expect(reviewed.status).toBe(200);
 const record=await reviewed.json();expect(record.identityReview.patientId).toBe(dataset.reports[0].patientId);expect(record.identityReview.sourceHash).toBe(dataset.reports[0].sha256);expect(record.allowed).toBe(false);
 const answer=await app.request("/api/abdm/reports/abdm-a/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:"Show findings"})});
 expect(answer.status).toBe(403);expect(fetch).not.toHaveBeenCalled();
 const other=await (await app.request("/api/abdm/reports/abdm-b/workspace")).json();expect(other.identityReview.decision).toBe("pending");expect(other.birthDate).toBe("1991");
});
it("hides source provider details without permission and never grants registry verification",async()=>{
 const before=await (await app.request("/api/abdm/reports/abdm-a/workspace")).json();expect(before.providers).toEqual([]);
 const after=await (await app.request("/api/abdm/reports/abdm-a/consent/grant",{method:"POST"})).json();
 expect(after.providers.map((p:{kind:string})=>p.kind).sort()).toEqual(["HCO","HCP"]);expect(after.providers.every((p:{registryStatus:string})=>p.registryStatus.includes("pending"))).toBe(true);
});
it("fails closed when the cloud evidence service URL is missing",async()=>{
 vi.stubEnv("RAG_SERVICE_URL","");await app.request("/api/abdm/reports/abdm-a/consent/grant",{method:"POST"});
 const answer=await app.request("/api/abdm/reports/abdm-a/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:"Show findings"})});expect(answer.status).toBe(503);expect(fetch).not.toHaveBeenCalled();
});
