'use client';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){
 return <main style={{minHeight:'100vh',display:'grid',placeContent:'center',padding:32,gap:20,maxWidth:720,margin:'auto'}}><h1 style={{fontSize:44,lineHeight:1.1}}>Let’s reconnect the workspace.</h1><p>The page could not finish loading. Your synthetic records are stored separately by the local API.</p><button onClick={reset} style={{padding:'16px 24px',border:'2px solid #111',background:'#ffd84d',borderRadius:12,cursor:'pointer'}}>Try again</button><a href="/workspace">Open the clinical workspace</a></main>;
}
