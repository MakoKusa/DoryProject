from pathlib import Path
import subprocess,re
from apply_arg_finale_v3 import once,function,blob

HELPERS=r'''  var selectedSaut=null,arrivalSaut=null;
  function argSautEligible(r) {
    return !r.custom&&!r.gifted&&!!NEG[r[0]]&&r[0].split("/").reverse().join("")<="20260929";
  }
  function restoreScenarioRows(rows) {
    var keep=DB.filter(function(r){return !argSautEligible(r)});
    DB.length=0;rows.forEach(function(r){DB.push(r)});keep.forEach(function(r){if(DB.indexOf(r)<0)DB.push(r)});
  }
  function arrivalCaps(d) {
    return arrivalSaut&&arrivalSaut[0]===d&&arrivalSaut.entryCaptions?arrivalSaut.entryCaptions:CAP[d];
  }
'''

def patch(s):
    s=once(s,'  function applyCustomSauts() {',HELPERS+'  function applyCustomSauts() {')
    s=function(s,'applyCustomSauts',r'''function applyCustomSauts() {
    var selected=DB[dbi],added=false;
    customSauts.forEach(function(e){
      var d=DorySauts.displayDate(e.date),row=DB.filter(function(r){return r.custom&&(r.entryId===e.id||(!r.entryId&&r[0]===d))})[0];
      if(!row){row=[d,e.title];row.custom=true;DB.push(row);added=true}
      row[0]=d;row[1]=e.title;if(e.time)row[2]=e.time.length===5?e.time+":00":e.time;
      row.entryId=e.id;row.entryMessage=e.message;row.entryPhotos=e.photos.map(function(p){return p.path});row.entryCaptions=e.photos.map(function(p){return p.caption});
      MSG[d]=e.message;CAP[d]=row.entryCaptions;customPhotos[d]=row.entryPhotos;
    });
    applyFinalEntry();
    if(added)DB.sort(function(a,b){return a[0].split("/").reverse().join("-").localeCompare(b[0].split("/").reverse().join("-"))});
    if(selected&&DB.indexOf(selected)>=0)dbi=DB.indexOf(selected);dbi=Math.max(0,Math.min(dbi,DB.length-1));
  }''')
    s=function(s,'applyFinalEntry',r'''function applyFinalEntry() {
    var date=finalDate||giftedMemoryDate;if(!date)return;
    var row=DB.filter(function(r){return r.gifted||(!r.custom&&r[0]===date&&r[1]===FINAL_TITLE)})[0];
    if(!row){row=[date,FINAL_TITLE];DB.push(row)}
    row[0]=date;row.gifted=true;row.entryId="arg-halloween-2026";row.entryMessage=FINAL_MSG;row.entryPhotos=[];row.entryCaptions=[];
  }''')
    s=function(s,'creerRestoreEntry',r'''function creerRestoreEntry(k) {
    var rows=DB_ORIG.map(function(o,i){var r=o.slice();if(i>k){r[1]=NEG[o[0]]+NULL_TAG;r.n=true}return r});
    restoreScenarioRows(rows);unalterMemory(DB_ORIG[k][0]);dbi=0;
  }''')
    s=function(s,'creerBox',r'''function creerBox() {
    var c=creer||{lines:[],cur:null,btn:null,fused:[]},lw=Math.min(60,W),rw=Math.min(42,W),height=Math.max(14,Math.min(24,argPanelRows()));
    function expand(rows,w){var out=[];rows.forEach(function(r){if(r.h)out.push(r);else splitLine(r.t,w).forEach(function(t){out.push({t:t,act:r.act})})});return out}
    function fixed(history,foot,w){foot=expand(foot,w).slice(0,6);while(foot.length<6)foot.push({t:""});var body=history.slice(-(height-6));while(body.length<height-6)body.push({t:""});return body.concat(foot)}
    var left=c.lines.map(function(o){return maskedLine(o.t,o.mask,o.base)});if(c.cur)left.push(maskedLine(c.cur.t+"_",c.cur.mask,"ent"));
    var foot=[{t:""}];if(c.btn){wrap("[ "+c.btn.text+" ]",lw-3).forEach(function(t){foot.push({t:t,h:'<span class="btnr">'+esc(t)+'</span>',act:"k:Enter"})});foot.push({t:"ENTREE OU CLIC POUR REPONDRE"})}else foot.push({t:"..."});
    var right=[];c.fused.forEach(function(x){splitLine("+ "+x,rw).forEach(function(t){right.push({t:t,h:'<span class="wht">'+esc(t)+'</span>'})})});
    return '<div class="creer-fixed-layout'+(window.innerWidth>=1100&&W>=108?' two-columns':'')+'">'+P(box("VIE DE NULL-0414",fixed(left,foot,lw),lw))+P(box("SOUVENIRS FUSIONNES",fixed(right,[{t:""},{t:"SOUVENIRS EN ATTENTE : "+(12-c.fused.length)}],rw),rw))+"</div>";
  }''')
    s=function(s,'nezukoCelebration',r'''async function nezukoCelebration() {
    aPush("NEZUKO > wouf ! grrr... wouf wouf !");dogSnd("yipyip");await sleep(650);dogSnd("growl");
  }''')
    for a,b in [
      ('return !isNull(row) && NEG[row[0]];','return !isNull(row) && argSautEligible(row);'),
      ('return !!NEG[r[0]]','return argSautEligible(r)'),
      ('DB.filter(function (x) { return NEG[x[0]]; })','DB.filter(argSautEligible)'),
      ('MSG[giftedMemoryDate]=FINAL_MSG','row.entryMessage=FINAL_MSG;row.entryPhotos=[];row.entryCaptions=[]'),
      ('finalDate = giftedMemoryDate || (z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear());','finalDate = z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear();'),
      ('function fxAdd(c) { if (!reduced && story < 8) crt.classList.add(c); }','function fxAdd(c) { if (!reduced && (story < 8 || (c === "shake" && scr === "jump"))) crt.classList.add(c); }'),
      ('else if (k === "Enter") { target = DB[dbi][0]','else if (k === "Enter") { selectedSaut=DB[dbi]; target = DB[dbi][0]'),
      ('if (s === "nav") { f = target.match','if (s === "nav") { selectedSaut=null; f = target.match'),
      ('    var ev = DB.filter(function (x) { return x[0] === d; })[0];','    var ev=selectedSaut&&selectedSaut[0]===d&&DB.indexOf(selectedSaut)>=0?selectedSaut:DB.filter(function(x){return x[0]===d&&!x.gifted})[0]||DB.filter(function(x){return x[0]===d})[0];arrivalSaut=ev;'),
      ('    if (ev && MSG[d]) {','    if (ev && (ev.entryMessage || MSG[d])) {'),
      ('      var sections = MSG[d].split("Dora, le vrai :");','      var sections = (ev.entryMessage || MSG[d]).split("Dora, le vrai :");'),
      ('photosBlock(d) + extraBlock(d)','photosBlock(d) + (ev.gifted?extraBlock(d):"")'),
      ('scr === "arrival" && finalDate && arrival && arrival.d === finalDate','scr === "arrival" && arrivalSaut && arrivalSaut.gifted'),
      ('    if (scr !== "arg") return;\n    if (Math.random() < 0.25)','    if (scr !== "arg" || story >= 8) return;\n    if (Math.random() < 0.25)')]: s=once(s,a,b)
    old='DB.length = 0; DB_ORIG.forEach(function (x) { DB.push(x.slice()); });'
    if s.count(old)!=2:raise RuntimeError('Unexpected restoration sites')
    s=s.replace(old,'restoreScenarioRows(DB_ORIG.map(function(x){return x.slice()}));')
    if s.count('if (finalDate && arrival.d === finalDate)')!=2:raise RuntimeError('Unexpected arrival sites')
    s=s.replace('if (finalDate && arrival.d === finalDate)','if (arrivalSaut && arrivalSaut.gifted)')
    s=once(s,'  async function findPhotos(d) {','  async function findPhotos(d) {\n    if(arrivalSaut&&arrivalSaut[0]===d&&arrivalSaut.entryPhotos)return arrivalSaut.entryPhotos;')
    s=s.replace('CAP[d] && CAP[d][i] ? " - " + CAP[d][i]','arrivalCaps(d) && arrivalCaps(d)[i] ? " - " + arrivalCaps(d)[i]')
    s=s.replace('CAP[lb.d] && CAP[lb.d][lb.i] ? " - " + CAP[lb.d][lb.i]','arrivalCaps(lb.d) && arrivalCaps(lb.d)[lb.i] ? " - " + arrivalCaps(lb.d)[lb.i]')
    # During the ARG, custom dates remain visible but are excluded from NULL's operations.
    return s

if __name__=='__main__':
    p=Path('js/app.js');s=p.read_text(encoding='utf-8')
    if 'var selectedSaut=null,arrivalSaut=null;' in s:print('Already applied');raise SystemExit(0)
    if blob(s)!='0756c39c0eb97aba170b81aab4d0587295880f75':raise RuntimeError('Version changed; refusing to overwrite')
    result=patch(s);temp=Path('js/.arg-v4-check.js')
    try:
        temp.write_text(result,encoding='utf-8');subprocess.run(['node','--check',str(temp)],check=True)
    finally:temp.unlink(missing_ok=True)
    p.write_text(result,encoding='utf-8');print('ARG v4 applied; personal JSON and photos unchanged')
