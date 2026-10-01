const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {bundle,launchBrowser}=require('./browser-helpers.cjs');
(async()=>{
 const source=ts.createSourceFile('content.ts',fs.readFileSync('src/content.ts','utf8'),ts.ScriptTarget.Latest,true);
 const names=['publishInventoryGrade','injectBadge','removeBadge','getBadgeTemplate','getGradeLetterFromDisplay'];
 const functions=source.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.includes(node.name?.text));
 assert.equal(functions.length,names.length);
 const rendering=ts.transpileModule(functions.map(node=>node.getText(source).replace(/^export /,'')).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const scripts=await Promise.all([bundle('src/stat-grade.ts','StatGrade'),bundle('src/inventory-badges.ts','InventoryBadges'),bundle('src/search-bridge.ts','Bridge'),bundle('src/badge-presentation.ts','Presentation'),bundle('src/grade-colors.ts','Colors'),bundle('src/grading.ts','Grading'),bundle('src/footer-sizing.ts','Footer')]);
 const browser=await launchBrowser();
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<div id="route"></div><div id="compare"><div class="item-drag-container"><div class="item" id="1"></div></div></div>');
  await page.addStyleTag({content:fs.readFileSync('public/styles.css','utf8')});
  await page.addScriptTag({content:scripts.join('\n')+`
   const {rollBadgeSymbol,applyBadgePresentation,badgeCategory}=Presentation;
   const {displayGrade,inventoryGradeAppearance,applyGradeGlow,applyGradeColors}=Colors;
   const {updateFooterSize,releaseFooterSize}=Footer;
   const {renderStatGrade,removeStatGrade}=StatGrade;
   let aegisStatGradeBasis="perk";
   const getGradeValue=Grading.gradeValue,t=value=>value;
   const badgeTemplates=new Map(),renderedBadges=new WeakMap(),badgeResults=new WeakMap();
   const IS_WINNOWER_HOST=false;
   let aegisBadgeStyle='footer',aegisBadgePosition='bottom-left',aegisFadeHover=false;
   let aegisUpgradeStyle='triangle',aegisShowPerfectStar=true,aegisShowOmniStar=true,aegisGradeDisplayMode='dual';
   let aegisBadgeVisibility={weapon:'grade',armor:'grade',exotic:'off'};
   ${rendering}
   let evaluations=0;
   const badges=InventoryBadges.createInventoryBadges((tile,badge)=>{if(badge.result.grade)injectBadge(tile,badge.result,badge.category);else removeBadge(tile);});
   const provider=Bridge.initSearchEvaluator(item=>{
    evaluations++;badges.add(item,item.result);
    return{id:item.id,hash:item.hash,data:{result:{grade:item.result.grade}},context:{}};
   },()=>true,()=>({ratings:true}),()=>({}),status=>badges.status(status));
  `});
  assert.deepEqual(errors,[]);
  const result=await page.evaluate(async()=>{
   const check=(ok,label)=>{if(!ok)throw Error(label);};
   const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
   const items=[
    {id:'1',hash:10,kind:'weapon',result:{grade:'S+ | AS+',pveRollQuality:{isPerfect5of5:true},pvpRollQuality:{isOmniRoll:true}}},
    {id:'2',index:'native-armor-index',hash:20,kind:'armor',result:{grade:'A/S'}},
    {id:'3',hash:30,kind:'weapon',isExotic:true,result:{grade:'S'}},
    {id:'4',hash:40,kind:'weapon',result:{grade:null}},
   ].map(item=>({...item,ready:true}));
   let revision=0;
   const publish=()=>Bridge.publishSearchMessage(Bridge.SEARCH_REQUEST,{session:'test',accountEpoch:1,inventoryRevision:++revision,evaluationRevision:1,inventoryReady:true,items});
   const mount=()=>{
    document.getElementById('route').innerHTML='<main role="main"><div class="store-row"></div><div class="open"></div><div class="closed" hidden></div></main>';
    for(let copy=0;copy<180;copy++)for(const item of items){
     const wrapper=document.createElement('div');wrapper.className='item-drag-container';
     const tile=document.createElement('div');tile.className='item';tile.id=item.index||item.id;wrapper.append(tile);
     document.querySelector(copy%2?'.open':'.closed').append(wrapper);
    }
   };
   publish();mount();await frame();
   check(document.querySelectorAll('#route .aegis-badge').length===360,'Every cached badge is attached on the first route paint, including hidden groups');
   check(!document.querySelector('#compare .aegis-badge'),'Compare outside the inventory is untouched');
   check(document.querySelector('#native-armor-index .aegis-badge').textContent==='A/S','Native item.index can differ from instance ID');
   const preview=document.createElement('div');preview.setAttribute('role','dialog');
   preview.innerHTML='<div class="item-drag-container"><div class="item" id="1"></div></div>';
   document.querySelector('#route main').append(preview);await frame();
   check(!preview.querySelector('.aegis-badge'),'Nested dialog previews are excluded');preview.remove();
   check(document.querySelector('#route [id="1"] .aegis-badge').textContent.includes('★'),'PvE stars survive cache restoration');
   check(document.querySelector('#route [id="1"] .aegis-badge').textContent.includes('✦'),'PvP stars survive cache restoration');
   check(!document.querySelector('#route [id="3"] .aegis-badge'),'Exotic visibility is correct before native annotation');
   const count=evaluations;
   for(let visit=0;visit<3;visit++){document.getElementById('route').replaceChildren();await frame();mount();await frame();check(document.querySelectorAll('#route .aegis-badge').length===360,'Route '+visit+' is complete at first paint');}
   check(evaluations===count,'Route returns do not grade items again');
   const first=document.querySelector('#route .open [id="1"]');first.querySelector('.aegis-badge').remove();await frame();
   check(first.querySelector('.aegis-badge'),'Replacing tile children restores the cached badge before paint');
   provider.invalidate();mount();await frame();check(!document.querySelector('#route .aegis-badge'),'Pending revisions never restore stale grades');
   items[0].result={grade:'F'};publish();await frame();
   check(document.querySelector('#route [id="1"] .aegis-badge').textContent==='F','Changed grades replace the old snapshot');
   items.splice(1,1);publish();mount();await frame();
   check(document.querySelectorAll('#route .aegis-badge').length===180,'Removed items cannot leak from an old account/inventory snapshot');
   aegisBadgeStyle='pill';aegisBadgeVisibility.exotic='color';mount();await frame();
   check(document.querySelector('#route [id="1"] .aegis-badge').classList.contains('aegis-style-pill'),'Restoration uses current badge style');
   check(document.querySelector('#route [id="3"] .aegis-badge').classList.contains('aegis-color-only'),'Restoration uses current category settings');
   // The compact variant keeps one owned node inside the native bar. React can
   // replace that bar independently of the item root; restore before paint.
   aegisBadgeStyle='stat';aegisStatGradeBasis='perk';items[0].result={grade:'BS+',weaponGrade:'B'};
   publish();mount();await frame();
   const statTile=document.querySelector('#route .open [id="1"]');
   check(!statTile.querySelector('.aegis-badge,.aegis-stat-grade'),'No invented bar on unsupported markup');
   const bar=document.createElement('div');bar.className='SLO2oppG';bar.innerHTML='<span class="app-icon fa-thumbs-up"></span><span>550</span>';statTile.append(bar);await frame();
   check(bar.querySelector('.aegis-stat-grade')?.textContent==='S+','Late bar attaches one perk letter');
   const thumb=bar.firstElementChild,letter=bar.querySelector('.aegis-stat-grade');
   check(letter.childElementCount===0 && getComputedStyle(thumb).display==='none','One element replaces the wishlist icon');
   letter.remove();await frame();check(bar.querySelector('.aegis-stat-grade'),'React removing the letter restores it');
   const nextBar=bar.cloneNode(false);nextBar.innerHTML='<span class="app-icon fa-thumbs-up"></span><span>550</span>';bar.replaceWith(nextBar);await frame();
   check(nextBar.querySelector('.aegis-stat-grade')?.textContent==='S+','React replacing the bar restores it');
   aegisStatGradeBasis='weapon';injectBadge(statTile,items[0].result,'weapon');
   check(nextBar.querySelector('.aegis-stat-grade')?.textContent==='B','Weapon basis does not include the perk grade');
   aegisBadgeStyle='footer';injectBadge(statTile,items[0].result,'weapon');
   check(!statTile.querySelector('.aegis-stat-grade,[data-aegis-stat-bar]') && getComputedStyle(nextBar.firstElementChild).display!=='none','Style exit restores native rating');
   badges.dispose();provider.dispose();mount();await frame();check(!document.querySelector('#route .aegis-badge'),'Disposal stops restoration');
   return {evaluations:count,tiles:720,visits:3};
  });
  assert.deepEqual(errors,[]);console.log('PASS: first-paint cached badges on '+result.visits+' route returns for '+result.tiles+' tiles; hidden groups, stars, armor/exotic visibility, child replacement, no regrading, freshness, style changes, preview isolation and disposal.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
