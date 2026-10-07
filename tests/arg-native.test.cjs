const assert=require('node:assert/strict');
var DB=[['a','Original A','10:30:00'],['b','Original B'],['custom','Extra']]; DB[2].custom=true;
var NEG={a:'Souvenir A de NULL',b:'Souvenir B de NULL'},NULL_TAG=' // NULL-0414',scr='db',dbi=0,st='',sautsEdits=0;
function hRand(a){return a[0]}function isNull(row){return row[1].includes(NULL_TAG)}function draw(){}function beep(){}function thump(){}function alterMemory(){}function entityId(){return 'NULL-0414'}function sleep(){return Promise.resolve()}
  async function appropriateSaut(row, text) {
    var idx = DB.indexOf(row); if (idx < 0 || scr !== "db") return;
    row.n = true; dbi = idx;
    for (var k = 1; k <= text.length && scr === "db"; k++) {
      row[1] = text.slice(0,k) + (k < text.length ? "_" : "");
      draw(); beep(300 + Math.random()*400,25,"square"); await sleep(50);
    }
    row[1] = text; alterMemory(row[0]); draw();
  }
  async function sautsEditLoop(n) {
    while (n-- > 0 && scr === "db") {
      var candidates = DB.filter(function(row) { return !isNull(row) && NEG[row[0]]; });
      if (!candidates.length) break;
      var row = hRand(candidates);
      dbi = DB.indexOf(row); st = entityId() + " > " + hRand(["ce souvenir est à moi.", "je me souviens. moi.", "ce jour-là, c'était moi."]);
      draw(); await sleep(900); if (scr !== "db") return;
      await appropriateSaut(row, NEG[row[0]] + NULL_TAG);
      sautsEdits++; thump(); draw(); await sleep(1400 + Math.random()*900);
    }
    st = entityId() + " > je me les approprie."; draw();
  }
  async function nullTakeAllSauts() {
    var rows = DB.slice();
    for (var i = 0; i < rows.length && scr === "db"; i++) {
      if (!NEG[rows[i][0]]) continue;
      await appropriateSaut(rows[i], NEG[rows[i][0]] + NULL_TAG);
    }
    dbi = Math.max(0, Math.min(dbi,DB.length-1)); draw();
  }

var W=112,touchUI=false,window={innerWidth:1920,innerHeight:1080},document={body:{},createElement:()=>({getContext:()=>({measureText:()=>({width:9.6})})})};
function getComputedStyle(){return {fontSize:'16px',lineHeight:'20px',fontFamily:'Courier New'}}function $(){return null}function esc(t){return t}
  function splitLine(t, inner) {
    var lead = /^(> |  )/.test(t) ? t.slice(0, 2) : "";
    var parts = wrap(t.slice(lead.length), Math.max(8, inner - 1 - lead.length));
    return parts.map(function (p, i) { return (i === 0 ? lead : (lead ? "  " : "")) + p; });
  }
  function box(title, lines, inner) {
    inner = Math.min(inner, W);
    var t = " " + title + " ", l = Math.floor((inner - t.length) / 2);
    var out = "╔" + "═".repeat(l) + t + "═".repeat(Math.max(0, inner - t.length - l)) + "╗\n";
    var ls = [];
    lines.forEach(function (x) {
      if (!x.h && (" " + x.t).length > inner) splitLine(x.t, inner).forEach(function (s) { ls.push({ t: s, sel: x.sel, act: x.act }); });
      else ls.push(x);
    });
    ls.forEach(function (x) {
      var plain = " " + x.t, pad = " ".repeat(Math.max(0, inner - plain.length));
      var body = (x.h ? " " + x.h : esc(plain)) + pad;
      var cell = x.sel ? '<span class="sel">' + body + "</span>" : body;
      if (x.act) cell = '<span class="tap" data-a="' + x.act + '">' + cell + "</span>";
      out += "║" + cell + "║\n";
    });
    return out + "╚" + "═".repeat(inner) + "╝";
  }
  function wrap(s, w) {
    var out = [];
    s.split("\n").forEach(function (para) {
      var l = "";
      para.split(" ").forEach(function (x) {
        if ((l + " " + x).trim().length > w) { out.push(l); l = x; } else l = (l + " " + x).trim();
      });
      out.push(l);
    });
    return out;
  }
  function argPanelRows() {
    var cs = getComputedStyle(document.body), fs = parseFloat(cs.fontSize) || 16;
    var line = parseFloat(cs.lineHeight) || fs * 1.25;
    if (touchUI) line = fs * 1.5;
    var bar = $("tbar"), inset = bar && bar.getBoundingClientRect().height > 0 ? bar.getBoundingClientRect().height : 0;
    return Math.max(10, Math.min(42, Math.floor(Math.max(180, window.innerHeight - 180 - inset) / line) - 2));
  }
  function fullScreenNoise(chars, density) {
    var cs = getComputedStyle(document.body), fs = parseFloat(cs.fontSize) || 16;
    var ctx = document.createElement("canvas").getContext("2d");
    ctx.font = fs + "px " + (cs.fontFamily || '"Courier New", monospace');
    var cw = ctx.measureText("M").width || fs * .6;
    var lh = (touchUI ? fs * 1.5 : parseFloat(cs.lineHeight)) || fs * 1.25;
    var columns = Math.max(30, Math.ceil(window.innerWidth / cw) + 1);
    var rows = Math.max(8, Math.ceil(window.innerHeight / lh) + 1), text = "";
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < columns; c++) text += Math.random() < density ? chars.charAt(Math.random() * chars.length | 0) : " ";
      text += "\n";
    }
    return text;
  }
  function fixedArgRows(lines, prompt) {
    function expand(rows) {
      var out = [];
      rows.forEach(function (row) { if (row.h) out.push(row); else splitLine(row.t, W).forEach(function (t) { out.push({t:t}); }); });
      return out;
    }
    var target = argPanelRows(), prompts = expand([prompt]).slice(-3);
    var headers = expand(lines.slice(0,4)), history = expand(lines.slice(4));
    var capacity = Math.max(headers.length, target - prompts.length - 1), keep = Math.max(0, capacity - headers.length);
    var out = headers.concat(keep ? history.slice(-keep) : []);
    while (out.length < capacity) out.push({t:""});
    return out.concat([{t:""}],prompts);
  }
  function archiveColumns() {
    return window.innerWidth < 850 || W < 88 ? {list:Math.min(40,W),reader:W,stacked:true} : {list:40,reader:W-44,stacked:false};
  }

(async()=>{
 const refs=DB.slice(),dates=DB.map(x=>x[0]);
 await sautsEditLoop(20);await nullTakeAllSauts();await sautsEditLoop(20);
 assert.equal(DB.length,3);assert.deepEqual(DB.map(x=>x[0]),dates);assert(DB.every((x,i)=>x===refs[i]));assert.equal(DB[0][2],'10:30:00');assert(DB[2].custom);assert.equal(DB[2][1],'Extra');
 for(const width of [112,78,40]){W=width;for(const height of [1080,800,500]){window.innerHeight=height;for(const count of [0,1,30,60]){const rows=[{t:''},{t:'CLASSIFICATION : NIVEAU 5 // ACCES RESTREINT'},{t:'SIGNAL : STABLE'},{t:''}].concat(Array.from({length:count},()=>({t:'long message '.repeat(30)})));assert.equal(fixedArgRows(rows,{t:'MSG> '+'x'.repeat(150)}).length,argPanelRows());}}}
 window.innerHeight=1080;const noise=fullScreenNoise('#',1).split('\n');assert(noise[0].length*9.6>=1920);assert((noise.length-1)*20>=1080);
 console.log('PASS: appropriation preserves counts, dates, row identity, time and custom metadata; terminal dimensions and fullscreen noise.');
})().catch(e=>{console.error(e);process.exitCode=1});
