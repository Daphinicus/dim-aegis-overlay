const {bundle,runFixture}=require('./browser-helpers.cjs');
(async()=>{
 const code=await bundle('src/search-bridge.ts','Bridge');
 await runFixture('<div id="inventory"></div><pre id="result">Running</pre><script>'+code+`
 const check=(value,message)=>{if(!value)throw Error(message);};
 async function run(){
  const main=document.getElementById('inventory');
  const query=()=>{main.removeAttribute('data-aegis-grade-preload');main.dispatchEvent(new Event('dimsum-grade-preload-request',{bubbles:true}));return JSON.parse(main.getAttribute('data-aegis-grade-preload'));};
  check(query()===null,'Absent extension has no response');
  let ready=false,calls=0;
  const evaluator=Bridge.initSearchEvaluator(item=>{calls++;return{id:item.id,hash:item.hash,data:{result:{grade:null}},context:{}};},()=>ready,()=>({ratings:true}),()=>({calls}));
  check(query().status==='pending','Startup waits for settings and locale');
  const request={session:'test',accountEpoch:1,inventoryRevision:1,evaluationRevision:1,inventoryReady:true,items:Array.from({length:120},(_,i)=>({id:String(i),hash:i,ready:true}))};
  ready=true;Bridge.publishSearchMessage(Bridge.SEARCH_REQUEST,request);
  check(query().status==='pending','Batched grading is pending');
  await new Promise(resolve=>{const listener=()=>{if(Bridge.readSearchMessage(Bridge.SEARCH_RESPONSE).status==='ready'){document.removeEventListener(Bridge.SEARCH_RESPONSE,listener);resolve();}};document.addEventListener(Bridge.SEARCH_RESPONSE,listener);});
  check(query().status==='ready'&&query().items===120,'Every item settles, including unrated items');
  check(query().cache.calls===120,'Readiness diagnostics carry cache statistics');
  evaluator.invalidate();check(query().status==='pending','Old ready state is invalidated immediately');
  Bridge.publishSearchMessage(Bridge.SEARCH_REQUEST,{...request,items:[{...request.items[0],ready:false}]});
  check(query().status==='unavailable','Unsupported/incomplete input fails open');
  evaluator.dispose();check(query()===null,'Disposed or disabled provider leaves no live listener');
  document.getElementById('result').textContent='PASS: optional active-provider handshake, startup, batched full-inventory grades, unrated items, invalidation, unavailable data, and disposal.';
 }
 run().catch(error=>{document.getElementById('result').textContent='FAIL: '+error.stack;});
 </script>`);
})().catch(error=>{console.error(error);process.exitCode=1;});
