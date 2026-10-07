const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {launchBrowser}=require('./browser-helpers.cjs');
(async()=>{
  const {build}=await import('vite');const source=name=>JSON.stringify(path.resolve('src',name).replaceAll('\\','/'));
  const result=await build({configFile:false,publicDir:false,logLevel:'error',resolve:{extensions:['.ts','.mjs','.js','.json']},plugins:[{name:'review-ui',resolveId:id=>id.endsWith('review-ui-fixture')?'review-ui-fixture':null,load:id=>id==='review-ui-fixture'?`
    import ${source('popup.ts')};
    import {showTooltip,hideTooltip,initTooltip} from ${source('tooltip.ts')};
    import {setLanguage,t} from ${source('i18n.ts')};
    import {attachInlineSearchEditor} from ${source('inline-search-editor.ts')};
    window.review={setLanguage,t,hideTooltip,initTooltip,
      attach(input){return attachInlineSearchEditor(input,()=>true,'readable');},
      show(target){ showTooltip(target,{grade:'A',notes:'',matchedPerks:[],missingPerks:[]},'Fixture weapon',{},[],false,null,undefined,false,null,{},null,null,'both','sheet',null,null,
        {autoMaxHeight:false,tooltipWidthMode:'fixed',tooltipWidth:320,scoreDisplay:{settings:{aegisRatingDisplay:'scores',aegisScoreProfile:'omni',aegisScorePrecision:2,aegisScoreComparisonActivity:'pve'},evaluations:{pve:{best:{value:75},omni:{value:65},ceiling:85,quality:.75,coverage:.65},pvp:{best:{value:50},omni:{value:40},ceiling:80,quality:.5,coverage:.4}},details:{fixture:true}}});}
    };
  `:null}],build:{write:false,lib:{entry:'review-ui-fixture',name:'ReviewUI',formats:['iife']}}});
  const code=(Array.isArray(result)?result[0]:result).output[0].code;
  const browser=await launchBrowser();const evidence=path.resolve('scratch/review-ui',process.env.BROWSER_ENGINE||'chromium');fs.mkdirSync(evidence,{recursive:true});
  try{
    const page=await browser.newPage({viewport:{width:1100,height:768}});const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.abort());
    const css=fs.readFileSync('public/styles.css','utf8')+'\n'+fs.readFileSync('public/compact-options.css','utf8');
    const markup=fs.readFileSync('public/popup.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'');
    await page.setContent(markup);await page.addStyleTag({content:css});
    await page.evaluate(()=>{
      window.stored={scoringSource:'aegis',aegisDbMode:'sheet',aegisRatingDisplay:'scores',aegisMode:'both',aegisScoreProfile:'omni',aegisScorePrecision:2,aegisScoreShowPercent:false,aegisScoreComparisonActivity:'pvp',lastSeenChangelogVersion:'1.9.5',aegisLanguage:'auto'};window.listeners=[];
      window.chrome={runtime:{getManifest:()=>({version:'1.9.5'}),getURL:path=>'https://offline.test/'+path,sendMessage(){}},storage:{local:{get(keys,callback){const copy={...stored};if(callback)queueMicrotask(()=>callback(copy));return Promise.resolve(copy);},set(values,callback){Object.assign(stored,values);queueMicrotask(()=>{listeners.forEach(listener=>listener(Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{newValue:value}])),'local'));callback?.();});return Promise.resolve();}},onChanged:{addListener:listener=>listeners.push(listener)}}};
    });
    await page.addScriptTag({content:code});await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
    await page.locator('#language-select-input').waitFor({state:'visible'});
    const trigger=page.locator('#language-select-input');await trigger.focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.waitForFunction(()=>stored.aegisLanguage==='en');
    const snapshots=[];
    for(const lang of ['en','es','ko','ja','zh-CHS','zh-CHT']){
      await trigger.focus();await page.keyboard.press('Enter');await page.keyboard.press('Home');const steps=['auto','en','es','ko','ja','zh-CHS','zh-CHT'].indexOf(lang);for(let i=0;i<steps;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.waitForFunction(expected=>stored.aegisLanguage===expected,lang);
      assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert.equal(await trigger.evaluate(el=>document.activeElement===el),true);
      for(const id of ['rating-display','score-profile','score-precision','score-percent','score-comparison']){
        const group=page.locator('#aegis-'+id+'-segmented');assert.equal(await group.locator('[aria-pressed="true"]').count(),1);assert.equal(await group.getAttribute('role'),'group');
        const snapshot=await group.ariaSnapshot();assert.match(snapshot,/group "/);assert.match(snapshot,/pressed/);snapshots.push({lang,id,snapshot});
      }
      await page.screenshot({path:path.join(evidence,'popup-'+lang+'.png')});
    }
    await trigger.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('End');assert.equal(await page.locator('#aegis-language-option-6').getAttribute('role'),'option');await page.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');
    await page.locator('#aegis-score-percent-segmented button[data-value="true"]').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>stored.aegisScoreShowPercent===true);assert.equal(await page.locator('#aegis-score-percent-segmented button[data-value="true"]').getAttribute('aria-pressed'),'true');
    const open=page.locator('#open-changelog-btn');await open.click();const modal=page.getByRole('dialog');assert.equal(await modal.count(),1);await page.locator('#changelog-ack-btn').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#changelog-close-btn').evaluate(el=>document.activeElement===el),true);await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#changelog-ack-btn').evaluate(el=>document.activeElement===el),true);
    assert.equal(await page.locator('.popup-container').evaluate(el=>el.inert),true);if((process.env.BROWSER_ENGINE||'chromium')==='chromium'){const axClient=await page.context().newCDPSession(page);const nativeAX=await axClient.send('Accessibility.getFullAXTree');await axClient.detach();assert.equal(nativeAX.nodes.filter(node=>!node.ignored && node.role?.value==='combobox').length,0,'inert popup controls removed from native AX tree');fs.writeFileSync(path.join(evidence,'modal-native-ax.json'),JSON.stringify(nativeAX.nodes.filter(node=>!node.ignored),null,2));}await trigger.evaluate(el=>el.focus());assert.equal(await modal.evaluate(el=>el.contains(document.activeElement)),true,'inertness prevents focus from leaving modal');await page.keyboard.press('Escape');assert.equal(await open.evaluate(el=>document.activeElement===el),true);assert.equal(await page.locator('.popup-container').evaluate(el=>el.inert),false);
    // Automatic entry has the same containment and restores a usable opener.
    await page.evaluate(()=>{document.activeElement.blur();stored.lastSeenChangelogVersion='older';listeners.forEach(listener=>listener({lastSeenChangelogVersion:{newValue:'older'}},'local'));});await page.waitForFunction(()=>document.querySelector('#changelog-modal').contains(document.activeElement));await page.keyboard.press('Escape');await page.waitForFunction(()=>stored.lastSeenChangelogVersion==='1.9.5');assert.equal(await open.evaluate(el=>document.activeElement===el),true);
    fs.writeFileSync(path.join(evidence,'popup-ax.json'),JSON.stringify(snapshots,null,2));assert.deepEqual(errors,[]);
    // Tooltip and search are isolated from popup-specific body geometry.
    await page.setContent('<style>'+css+'body{background:#202126;color:white;margin:0}.item{position:absolute;top:443px;left:30px;width:50px;height:50px}.aegis-tooltip{animation:none}</style><button id="item" class="item">Item</button><input name="filter" aria-label="Inventory search"><button id="after">After</button>');await page.evaluate(()=>{
      const Native=window.ResizeObserver;window.activeReviewResizeObservers=0;
      window.ResizeObserver=class extends Native{observe(node,options){if(!this.counted){this.counted=true;activeReviewResizeObservers++;}super.observe(node,options);}disconnect(){if(this.counted){this.counted=false;activeReviewResizeObservers--;}super.disconnect();}};
    });await page.addScriptTag({content:code});
    await page.evaluate(()=>{const input=document.querySelector('input');input.value='is:weapon aegis:godroll notes:"two  spaces" ';window.writes=[];input.__reactProps$test={onChange:event=>writes.push(event.target.value),onKeyDown(){}};window.stopEditor=review.attach(input);});
    const raw='is:weapon aegis:godroll notes:"two  spaces" ';
    for(const lang of ['en','es','ko','ja','zh-CHS','zh-CHT']){
      await page.evaluate(lang=>review.setLanguage(lang),lang);assert.equal(await page.locator('input').inputValue(),raw);assert.equal(await page.locator('.aegis-search-token-label').first().textContent(),await page.evaluate(()=>review.t('searchLabelWeapon')));assert.equal(await page.locator('.aegis-search-token-remove').first().getAttribute('aria-label'),await page.evaluate(()=>review.t('searchRemoveTerm',{term:'is:weapon'})));
    }
    assert.equal(await page.evaluate(()=>writes.length),0);await page.locator('.aegis-inline-search').focus();await page.keyboard.press('Control+A');const copied=await page.locator('.aegis-inline-search').evaluate(el=>{const event=new ClipboardEvent('copy',{clipboardData:new DataTransfer(),bubbles:true,cancelable:true});el.dispatchEvent(event);return event.clipboardData.getData('text/plain');});assert.equal(copied,raw);
    await page.evaluate(()=>{stopEditor();review.setLanguage('en');});
    const metrics=[];
    for(const motion of ['no-preference','reduce'])for(const forced of ['none','active'])for(const side of ['right','left']){
      await page.emulateMedia({reducedMotion:motion,forcedColors:forced});await page.evaluate(side=>{const target=document.getElementById('item');target.style.left=side==='right'?'30px':'1010px';review.show(target);},side);
      await page.locator('.aegis-score-details summary').click();await page.waitForFunction(()=>{const r=document.querySelector('#aegis-hover-tooltip').getBoundingClientRect();return r.bottom<=window.innerHeight-11;});
      const rect=await page.locator('#aegis-hover-tooltip').boundingBox();assert.ok(rect.y>=12 && rect.y+rect.height<=757);const copy=await page.locator('.aegis-copy-score-details').boundingBox();assert.ok(copy.y+copy.height<=757);metrics.push({motion,forced,side,rect,copy});
      await page.screenshot({path:path.join(evidence,`tooltip-${side}-${motion}-${forced}.png`)});
      await page.evaluate(()=>{const details=document.querySelector('.aegis-score-details');const long=document.createElement('p');long.textContent='oversized content '.repeat(500);details.insertBefore(long,details.lastElementChild);});
      await page.waitForFunction(()=>{const card=document.querySelector('#aegis-hover-tooltip');return card.scrollHeight>card.clientHeight && card.getBoundingClientRect().bottom<=window.innerHeight-11;});
      await page.locator('.aegis-copy-score-details').focus();await page.waitForFunction(()=>document.querySelector('.aegis-copy-score-details').getBoundingClientRect().bottom<=window.innerHeight-11);assert.equal(await page.locator('#aegis-hover-tooltip').evaluate(el=>getComputedStyle(el).overflowY),'auto');
      await page.evaluate(()=>review.hideTooltip());assert.equal(await page.evaluate(()=>activeReviewResizeObservers),0,'hide releases geometry observer');assert.equal(await page.locator('#aegis-hover-tooltip').isVisible(),false);
    }
    await page.setViewportSize({width:450,height:300});await page.evaluate(()=>{const target=document.getElementById('item');target.style.left='350px';target.style.top='180px';review.show(target);});await page.locator('.aegis-score-details summary').click();await page.waitForFunction(()=>document.querySelector('#aegis-hover-tooltip').getBoundingClientRect().bottom<=289);await page.screenshot({path:path.join(evidence,'tooltip-narrow.png')});
    await page.evaluate(()=>document.getElementById('item').remove());await page.waitForFunction(()=>activeReviewResizeObservers===0);assert.equal(await page.locator('#aegis-hover-tooltip').isVisible(),false,'removed anchor hides tooltip');await page.evaluate(()=>review.hideTooltip());fs.writeFileSync(path.join(evidence,'tooltip-geometry.json'),JSON.stringify(metrics,null,2));
    assert.deepEqual(errors,[]);console.log('PASS A06/A07/A11/A12/A13: real keyboard, six-language AX state and mounted chips, raw copy, automatic modal, both tooltip sides, oversized scroll, reduced motion, forced colors, narrow viewport.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
