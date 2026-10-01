import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const files=execFileSync('git',['diff','--name-only','--diff-filter=U'],{encoding:'utf8'}).trim().split('\n');
const pattern=/^<<<<<<<[^\n]*\n([\s\S]*?)^=======\r?\n([\s\S]*?)^>>>>>>>[^\n]*(?:\n|$)/gm;
for(const file of files){
 let text=fs.readFileSync(file,'utf8'),i=0;
 text=text.replace(pattern,(block,ours,theirs)=>{const n=i++;
  if(file==='package-lock.json')return ours;
  if(file==='public/styles.css'||file==='src/i18n.ts')return ours+theirs;
  if(file==='package.json'){if(n===0)return ours.replace('"test:browser:install":','"test:scores": "vitest run tests/scores",\n    "test:browser:install":');return ours+theirs;}
  if(file==='src/types.ts')return ours.replace('export interface LocalStorageSchema {','export interface LocalStorageSchema extends Partial<ScoreSettings> {');
  if(file==='src/main-world-content.ts'){
   if(n===0)return "import { extractRawOwnedSnapshot } from './score-owned';\n"+ours;
   if(n===1)return ours+"      setItemAttribute(el, 'data-aegis-score-owned', null);\n";
   if(n===4)return "    writeAttribute('data-aegis-score-owned', JSON.stringify(extractRawOwnedSnapshot(item)));\n"+ours;
   return ours;
  }
  if(file==='src/popup.ts'){if(n===0)return ours+theirs.split('\n').slice(0,2).join('\n')+'\n';return ours;}
  if(file==='src/tooltip.ts'){
   if(n===0)return ours+theirs;
   if(n===1)return ours+theirs.split('\n').slice(1).join('\n');
   return ours.replace(/if \(/,'if (!scoreDisplay && ');
  }
  if(file==='src/content.ts'){
   if(n===0||n===2)return ours+theirs;
   if(n===1)return ours.replace('chrome.storage.local.get([','chrome.storage.local.get([...SCORE_SETTING_KEYS,').replace('  initLanguage(res.aegisLanguage);','  initLanguage(res.aegisLanguage);\n  scoreSettings = readScoreSettings(res);');
   if(n===3)return theirs.slice(0,theirs.indexOf('function showTooltipForElement'))+ours;
   if(n===4)return ours+theirs;
   if(n===7)return ours.replace('result.grade &&','(result.grade || scoresEnabled()) &&');
   return ours;
  }
  return ours;
 });fs.writeFileSync(file,text);
}
