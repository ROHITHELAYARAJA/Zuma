import { randomUUID } from "node:crypto";
import { mkdirSync,writeFileSync } from "node:fs";
const base = new URL(process.env.ABDM_WRAPPER_URL ?? "http://127.0.0.1:8082");
if (process.env.ABDM_MOCK_ENABLED !== "true") throw new Error("Set ABDM_MOCK_ENABLED=true explicitly. This runner targets the repository mock, not live ABDM.");
if (!['127.0.0.1','localhost'].includes(base.hostname) && process.env.ABDM_REMOTE_MOCK_ENABLED !== 'true') throw new Error('Remote mock target requires ABDM_REMOTE_MOCK_ENABLED=true.');
async function call(path: string,body?:unknown) {
  const response=await fetch(new URL(path,base),{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
  const result=await response.json();
  if(!response.ok)throw new Error(`Wrapper ${path} returned ${response.status}: ${JSON.stringify(result).slice(0,600)}`);
  return result;
}
const findConsent=(value:unknown):string|undefined=>{
  if(!value||typeof value!=='object')return;
  if('consentArtefacts' in value){const refs=(value as {consentArtefacts?:{id?:string}[]}).consentArtefacts; if(refs?.[0]?.id)return refs[0].id;}
  for(const [key,item] of Object.entries(value)){
    if(key==='consentId'&&typeof item==='string')return item;
    const found=findConsent(item);if(found)return found;
  }
};
const requestId=randomUUID();
const now=new Date();const erase=new Date(now.getTime()+3600000).toISOString();
const request={requestId,timestamp:now.toISOString(),consent:{purpose:{code:'CAREMGT',text:'Repository mock demonstration'},patient:{id:'wrapper-fixture@sbx'},hip:{id:'hospital-a'},hiu:{id:'hospital-b'},careContexts:[{patientReference:'patient123',careContextReference:'repo-discharge-context'}],requester:{name:'Repository demonstration requester',identifier:{system:'https://example.invalid/test-register',type:'REGNO',value:'DEMO-ONLY'}},hiTypes:['DischargeSummary'],permission:{accessMode:'VIEW',dateRange:{from:'2000-01-01T00:00:00.000Z',to:now.toISOString()},dataEraseAt:erase,frequency:{unit:'HOUR',value:1,repeats:0}}}};
await call('/v1/consent-init',request);
let consentId:string|undefined;
for(let attempt=0;attempt<15;attempt++){
  await new Promise(resolve=>setTimeout(resolve,1500));
  const status=await call(`/v1/consent-status/${requestId}`);consentId=findConsent(status);if(consentId)break;
}
if(!consentId)throw new Error('Mock consent callback did not produce an artefact. Inspect docker compose logs; no successful transfer is claimed.');
const transferId=randomUUID();
await call('/v1/health-information/fetch-records',{requestId:transferId,consentId});
let result;
for(let attempt=0;attempt<15;attempt++){
  await new Promise(resolve=>setTimeout(resolve,1500));
  result=await call(`/v1/health-information/status/${transferId}`);
  if(result.decryptedHealthInformationEntries?.length)break;
}
if(!result?.decryptedHealthInformationEntries?.length)throw new Error('No decrypted transfer payload received. Inspect wrapper logs.');
mkdirSync('data/abdm/transfers',{recursive:true});
writeFileSync(`data/abdm/transfers/${transferId}.json`,JSON.stringify({mockOnly:true,hospitalFrom:'A',hospitalTo:'B',requestId,consentId,transferId,receivedAt:new Date().toISOString(),result},null,2));
console.log(JSON.stringify({mockOnly:true,requestId,consentId,transferId,entries:result.decryptedHealthInformationEntries.length,saved:true}));
