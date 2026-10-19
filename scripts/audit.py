import json, sys
from playwright.sync_api import sync_playwright
URL='file:///home/claude/ca-computacao/dist/index.html'
pages=['inicio','sobre','integrantes','grade','documentos','complementares','contato']
JS_TAP='''() => {
  const out=[];
  const sel='a[href],button,input,select,textarea,summary,[role=button]';
  document.querySelectorAll(sel).forEach(el=>{
    const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
    if(r.width===0||r.height===0||cs.visibility==='hidden') return;
    if(el.classList.contains('sr-only')) return;
    const inline = el.classList.contains('link-inline') || el.matches('h3 a');
    const txt=(el.textContent||'').trim().length>0; if(r.height<43.5||(!txt&&r.width<43.5)){ if(inline) return; out.push((el.textContent||el.getAttribute('aria-label')||el.id||el.tagName).trim().slice(0,28)+' '+Math.round(r.width)+'x'+Math.round(r.height)); }
  });
  return out;
}'''
res={}
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h,label in [(375,800,'retrato'),(812,375,'paisagem'),(1280,800,'desktop')]:
        ctx=b.new_context(viewport={'width':w,'height':h},has_touch=(w<900))
        pg=ctx.new_page(); errs=[]
        pg.on('console',lambda m: errs.append(m.text) if m.type in('error','warning') else None)
        pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.add_init_script("""window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries()){if(!e.hadRecentInput)window.__cls+=e.value}}).observe({type:'layout-shift',buffered:true});""")
        for pa in pages:
            pg.goto(URL+'#'+pa); pg.wait_for_timeout(900)
            small=pg.evaluate(JS_TAP)
            if small: res[f'{label}/{pa} alvos<44px']=small[:8]
            ov=pg.evaluate('document.documentElement.scrollWidth-innerWidth')
            if ov>0: res[f'{label}/{pa} overflow']=ov
        res[f'{label} CLS']=round(pg.evaluate('window.__cls'),4)
        res[f'{label} console']=[e for e in errs if 'fonts.g' not in e and 'ERR_' not in e][:4]
        if w==812:
            pg.goto(URL+'#inicio'); pg.wait_for_timeout(300)
            pg.click('button[aria-label="Abrir menu"]'); pg.wait_for_timeout(300)
            nav=pg.evaluate("(()=>{const n=document.querySelector('#menu-movel');const r=n.getBoundingClientRect();return {bottom:Math.round(r.bottom),vh:innerHeight}})()")
            res['paisagem menu']=nav
        ctx.close()
    b.close()
print(json.dumps(res,indent=1,ensure_ascii=False))
