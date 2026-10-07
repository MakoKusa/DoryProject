import hashlib,re,subprocess
from pathlib import Path

def once(s,a,b):
    if s.count(a)!=1: raise RuntimeError('Missing unique anchor: '+a[:80])
    return s.replace(a,b,1)
def function(s,name,body):
    m=re.search(r'^  (?:async )?function '+name+r'\(',s,re.M)
    if not m: raise RuntimeError('Missing function '+name)
    e=re.search(r'^  }\s*$',s[m.end():],re.M)
    if not e: raise RuntimeError('Missing function end '+name)
    return s[:m.start()]+'  '+body+s[m.end()+e.end():]
def blob(s):
    b=s.encode();return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()

def patch(s):
    s=function(s,'newSouvenirAnimation',r'''async function newSouvenirAnimation() {
    var d=new Date(),z=function(n){return String(n).padStart(2,"0")};giftedMemoryDate=z(d.getDate())+"/"+z(d.getMonth()+1)+"/"+d.getFullYear();
    var view=argView,busy=argBusy;scr="db";argFrame="";sq=false;argBusy=true;setBare();fit();
    var row=DB.filter(function(x){return x.gifted||(x[0]===giftedMemoryDate&&x[1]===FINAL_TITLE)})[0];if(!row){row=[giftedMemoryDate,""];DB.push(row)}
    row.gifted=true;row.n=false;row[1]="";dbi=DB.indexOf(row);st="NULL-0414 > ce souvenir est le mien. celui où tu m'as libérée.";draw();await sleep(1100);
    try{for(var i=1;i<=FINAL_TITLE.length;i++){row[1]=FINAL_TITLE.slice(0,i)+(i<FINAL_TITLE.length?"_":"");draw();beep(440,25,"sine");await sleep(reduced?25:65)}row[1]=FINAL_TITLE;MSG[giftedMemoryDate]=FINAL_MSG;draw();await sleep(2200)}
    finally{row[1]=FINAL_TITLE;scr="arg";argView=view;argBusy=busy;st="";setBare();fit();draw()}
  }''')
    s=function(s,'applyFinalEntry',r'''function applyFinalEntry() {
    var date=finalDate||giftedMemoryDate;if(!date)return;MSG[date]=FINAL_MSG;
    var row=DB.filter(function(x){return x[0]===date&&(x[1]===FINAL_TITLE||x.gifted)})[0];if(!row){row=[date,FINAL_TITLE];DB.push(row)}row.gifted=true;
  }''')
    s=function(s,'nullTakeAllSauts',r'''async function nullTakeAllSauts() {
    var rows=DB.filter(function(r){return !!NEG[r[0]]}),texts=rows.map(function(r){return NEG[r[0]]+NULL_TAG});st=entityId()+" > tout est à moi.";glitchNow();thump();rows.forEach(function(r){r.n=true});
    for(var k=0;k<=24&&scr==="db";k++){rows.forEach(function(r,i){r[1]=texts[i].slice(0,Math.ceil(texts[i].length*k/24))+(k<24?"_":"")});draw();if(k%3===0)beep(90+k*12,40,"sawtooth");await sleep(reduced?40:65)}
    rows.forEach(function(r,i){r[1]=texts[i];alterMemory(r[0])});dbi=Math.max(0,Math.min(dbi,DB.length-1));draw();
  }''')
    old='    return \'<div class="layout">\' + P(box("VIE DE NULL-0414", L, Lw)) + P(box("SOUVENIRS FUSIONNES", R, Rw)) + "</div>";'
    new=r'''    function fixed(rows,w) {
      var h=Math.max(14,Math.min(24,argPanelRows())),out=[];
      rows.forEach(function(r){if(r.h)out.push(r);else splitLine(r.t,w).forEach(function(t){out.push({t:t,act:r.act})})});
      var foot=out.slice(-6),body=out.slice(0,-6).slice(-(h-6));while(foot.length<6)foot.unshift({t:""});while(body.length<h-6)body.push({t:""});return body.concat(foot);
    }
    return '<div class="creer-fixed-layout'+(window.innerWidth>=1100&&W>=108?' two-columns':'')+'">'+P(box("VIE DE NULL-0414",fixed(L,Lw),Lw))+P(box("SOUVENIRS FUSIONNES",fixed(R,Rw),Rw))+"</div>";'''
    s=once(s,old,new)
    s=once(s,'      var bs = " ".repeat(c.btn.ind) + "[ " + c.btn.text + " ]";','      var bs = "[ " + c.btn.text + " ]";')
    s=once(s,'h: " ".repeat(c.btn.ind) + \'<span class="btnr">\' + esc("[ " + c.btn.text + " ]")','h: \'<span class="btnr">\' + esc(bs)')
    # Keep interactive labels within the fixed left frame even on narrow screens.
    s=once(s,'      L.push({ t: bs, h:', '      bs = bs.slice(0, Lw - 2);\n      L.push({ t: bs, h:')
    s=once(s,'    var spr = SPR[id], Wg = Math.min(W, 56), Hg = 13, N = reduced ? 5 : 16, x0 = Math.floor((Wg - 7) / 2);',r'''    var blank=fullScreenNoise(GLITCH_CH,0).split("\n"),spr=SPR[id],Wg=blank[0].length,Hg=blank.length-1,N=reduced?5:20,x0=Math.floor((Wg-7)/2),y0=Math.max(1,Math.floor((Hg-spr.length-4)/2));''')
    s=once(s,'gPut(g, x0, 2, spr.slice(0, rows), true);','gPut(g, x0, y0, spr.slice(0, rows), true);')
    s=once(s,'gPut(g, Math.floor((Wg - id.length) / 2), 10, [id], true);','gPut(g, Math.floor((Wg - id.length) / 2), Math.min(Hg-2,y0+spr.length+2), [id], true);')
    for a,b in [
      ('        if (k === CHAPTERS.length - 1) await newSouvenirAnimation();',''),
      ('      nullDeparts();','      await newSouvenirAnimation();\n      nullDeparts();'),
      ('    var parts = wrap(s, 50);','    var parts = wrap(s, Math.min(50,W-4));'),
      ('if (x.n || argEntityReturned)','if (x.gifted || x.n || argEntityReturned)'),
      ('(x.n ? "ent" : "wht")','(x.gifted ? "grn" : x.n ? "ent" : "wht")'),
      ('    story = 8; argView = null; argFrame = ""; draw();','    story=8;argStat=0;glitchBurstUntil=0;clearTimeout(sabT);crt.classList.remove("glitchfx","shake","inv");root.classList.remove("arg-screen-buzz");argView=null;argFrame="";draw();'),
      ('active: !creerOn && !collapsing && (scr === "arg" || argEntityReturned),','active: story < 8 && !creerOn && !collapsing && (scr === "arg" || argEntityReturned),'),
      ('err: scr === "arg" && argView === "logs"','err: story < 8 && scr === "arg" && argView === "logs"'),
      ('ARG_STATUS[argStat]','(story >= 8 ? "SIGNAL : STABLE" : ARG_STATUS[argStat])'),
      ('if (reduced || p <= 0) return s;','if (story >= 8 || reduced || p <= 0) return s;'),
      ('function argP() { return reduced ? 0 :','function argP() { return (story >= 8 || reduced) ? 0 :'),
      ('function glitchNow() { if (reduced) return;','function glitchNow() { if (story >= 8 || reduced) return;'),
      ('if (!argEntityReturned && GHOST_OK.indexOf(scr) >= 0','if (story < 8 && !argEntityReturned && GHOST_OK.indexOf(scr) >= 0'),
      ('function fxAdd(c) { if (!reduced) crt.classList.add(c); }','function fxAdd(c) { if (!reduced && story < 8) crt.classList.add(c); }'),
      ('function fxToggle(c, on) { if (!reduced) crt.classList.toggle(c, on); }','function fxToggle(c, on) { if (story >= 8) { crt.classList.remove(c); return; } if (!reduced) crt.classList.toggle(c, on); }'),
      ('  function draw() {','  function draw() {\n    document.documentElement.classList.toggle("arg-creer-fixed", scr === "arg" && argView === "creer" && creerOn);'),
      ('    aPush("[ FIN DE L\'ARG D\'HALLOWEEN 2026 ]");','    await nezukoCelebration();\n    aPush("[ FIN DE L\'ARG D\'HALLOWEEN 2026 ]");')]: s=once(s,a,b)
    return once(s,'  async function gameFinale() {',r'''  async function nezukoCelebration() {
    var blank=fullScreenNoise(GLITCH_CH,0).split("\n"),ww=blank[0].length,hh=blank.length-1,dog=[" / \\__","(    @\\___"," /         O","/   (_____/","/_____/   U"],title="NEZUKO // DORA ET DORY SONT RENTRES !",n=reduced?8:36;
    try{for(var f=0;f<n;f++){var g=gNew(ww,hh),x=Math.max(0,Math.min(ww-13,Math.floor(ww/2-7)+(reduced?0:Math.round(Math.sin(f*.55)*8)))),y=Math.max(1,Math.floor(hh/2-3));gPut(g,x,y,dog,true);gPut(g,Math.max(0,Math.floor((ww-title.length)/2)),Math.max(0,y-3),[title],true);gPut(g,Math.max(0,x-5),y+3,[f%2?"  ~~~":"   ~~"],true);if(f===2||f===12)dogSnd("yipyip");if(f===7||f===22)dogSnd("growl");if(f===17||f===30)dogSnd("wuf");argFrame=gStr(g);draw();await sleep(reduced?650:220)}aPush("NEZUKO > wouf ! grrr... wouf wouf !")}finally{argFrame="";draw()}
  }
  async function gameFinale() {''')

if __name__=='__main__':
    app=Path('js/app.js');index=Path('index.html');s=app.read_text(encoding='utf-8');page=index.read_text(encoding='utf-8')
    if 'async function nezukoCelebration()' in s: print('Already applied');raise SystemExit(0)
    if blob(s)!='b5048ed1f05fda8fe9f15f2cad755f5858dfa54a' or blob(page)!='9a58287eb0803ef055d70b34accab43c46d288d4': raise RuntimeError('Version changed; refusing to overwrite')
    result=patch(s);updated=once(page,'<link rel="stylesheet" href="css/arg-layout.css">','<link rel="stylesheet" href="css/arg-layout.css">\n<link rel="stylesheet" href="css/arg-finale.css">')
    tmp=Path('js/.arg-v3-check.js')
    try:
        tmp.write_text(result,encoding='utf-8');subprocess.run(['node','--check',str(tmp)],check=True)
    finally: tmp.unlink(missing_ok=True)
    app.write_text(result,encoding='utf-8');index.write_text(updated,encoding='utf-8')
    Path('css/arg-finale.css').write_text('html.arg-creer-fixed #main{width:min(100%,calc(var(--arg-columns,80)*1ch));max-width:none;height:calc(100dvh - 190px);min-height:260px;overflow:auto;margin-top:16px;margin-bottom:auto}.creer-fixed-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:2ch;align-items:start}.creer-fixed-layout.two-columns{grid-template-columns:62ch 44ch;justify-content:center}.creer-fixed-layout>pre{margin:0!important;width:max-content;align-self:start}\n',encoding='utf-8')
    print('ARG finale v3 applied; photos and JSON data untouched')
