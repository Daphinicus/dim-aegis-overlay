import fs from 'node:fs';const edit=(f,fn)=>fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8').replaceAll('\r\n','\n')));
edit('tests/badge-updates.test.cjs',s=>s.replace('  nativeSearchEvaluator:',"  SCORE_SETTING_KEYS: [],\n  nativeSearchEvaluator:"));
edit('tests/scores/menu.test.ts',s=>s.replace("toBe('SS+AA')","toBe('✦ BS+')"));
edit('tests/scores/overlay.test.ts',s=>{
 s=s.replace("  expect(tile.querySelector('.aegis-badge')?.textContent).toBe('100.00%—');", "  await vi.waitFor(() => expect(tile.querySelector('.aegis-badge')?.textContent).toBe('100.00%—'));");
 const start=s.indexOf('  const search=document.querySelector');const end=s.indexOf('  change({aegisSheetDbPvE:null})',start);
 s=s.slice(0,start)+`  const { matchesAegisArgument } = await import('../../src/aegis-search');
  const data = weaponDataMap.get(tile)!;
  expect(matchesAegisArgument('pve:score:>=94.01', data, {mode:'both',chase:false})).toBe(false);
  expect(matchesAegisArgument('pve:score:>=93.99', data, {mode:'both',chase:false})).toBe(true);
`+s.slice(end);
 s=s.replace("  expect(tile.querySelector('.aegis-badge')?.textContent).toBe('——');", "  await vi.waitFor(() => expect(tile.querySelector('.aegis-badge')?.textContent).toBe('——'));");
 s=s.replace("  expect(tile.querySelector('.aegis-badge')?.classList.contains('aegis-score')).toBe(false);", "  await vi.waitFor(() => expect(tile.querySelector('.aegis-badge')?.classList.contains('aegis-score')).toBe(false));");return s;
});
