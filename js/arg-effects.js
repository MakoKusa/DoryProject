(function () {
  "use strict";
  var state = {active:false,err:false,reduced:true,muted:true,volume:0}, hiss = null;
  var original = new Map(), restoreTimer = null, buzzTimer = null, nextText = 0, nextBuzz = 0;
  var chars = "▓▒░#@%!?/\\{}[]01";
  function stopHiss() {
    if (!hiss) return;
    var old = hiss; hiss = null;
    try { old.gain.gain.setTargetAtTime(0, old.context.currentTime, .045); old.source.stop(old.context.currentTime+.2); } catch(e) {}
    setTimeout(function(){[old.source,old.high,old.low,old.gain].forEach(function(n){try{n.disconnect();}catch(e){}});},250);
  }
  function updateHiss() {
    if (!state.err || state.muted || state.volume <= 0 || document.hidden) { stopHiss(); return; }
    if (hiss) { hiss.gain.gain.setTargetAtTime(.055*state.volume/100,hiss.context.currentTime,.08); return; }
    try {
      var context = state.audio(), source = context.createBufferSource(), gain = context.createGain();
      var high = context.createBiquadFilter(), low = context.createBiquadFilter();
      var buffer = context.createBuffer(1,context.sampleRate*2,context.sampleRate), data = buffer.getChannelData(0);
      for(var i=0;i<data.length;i++) data[i]=Math.random()*2-1;
      source.buffer=buffer; source.loop=true;
      high.type="highpass"; high.frequency.value=350;
      low.type="lowpass"; low.frequency.value=5500;
      gain.gain.value=0;
      source.connect(high); high.connect(low); low.connect(gain); gain.connect(context.destination);
      source.start(); gain.gain.setTargetAtTime(.055*state.volume/100,context.currentTime,.08);
      hiss={source:source,gain:gain,high:high,low:low,context:context};
      if(context.state==="suspended") context.resume().catch(function(){});
    } catch(e) { stopHiss(); }
  }
  function restoreText() {
    clearTimeout(restoreTimer); restoreTimer=null;
    original.forEach(function(value,node){if(node.isConnected && node.nodeValue===value.corrupted)node.nodeValue=value.text;});
    original.clear();
  }
  function corruptText() {
    restoreText();
    [document.getElementById("crt"),document.getElementById("tbar")].forEach(function(root){
      if(!root)return;
      var walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),node;
      while((node=walk.nextNode())) {
        if(!node.parentElement || node.parentElement.closest("script,style,input,textarea,.arg-full-glitch"))continue;
        var text=node.nodeValue, changed=false;
        var corrupted=Array.from(text).map(function(ch){
          if(!/\s/.test(ch) && !/[╔╗╚╝║═╠╣╦╩╬┌┐└┘│─]/.test(ch) && Math.random()<.035){changed=true;return chars.charAt(Math.random()*chars.length|0);}return ch;
        }).join("");
        if(changed){original.set(node,{text:text,corrupted:corrupted});node.nodeValue=corrupted;}
      }
    });
    restoreTimer=setTimeout(restoreText,140);
  }
  function clearBuzz() {
    clearTimeout(buzzTimer); buzzTimer=null;document.documentElement.classList.remove("arg-screen-buzz");
  }
  function buzz() {
    clearBuzz();document.documentElement.classList.add("arg-screen-buzz");corruptText();
    buzzTimer=setTimeout(clearBuzz,240);
    if(state.muted || state.volume<=0)return;
    try{
      var c=state.audio(), s=c.createBufferSource(), g=c.createGain(), f=c.createBiquadFilter();
      var b=c.createBuffer(1,Math.ceil(c.sampleRate*.22),c.sampleRate),d=b.getChannelData(0);
      for(var i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.sin(i*.11);
      s.buffer=b;f.type="bandpass";f.frequency.value=850;f.Q.value=.8;
      g.gain.setValueAtTime(.035*state.volume/100,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.2);
      s.connect(f);f.connect(g);g.connect(c.destination);s.onended=function(){s.disconnect();f.disconnect();g.disconnect();};s.start();
    }catch(e){}
  }
  function sync(next) {
    if(next.active && !state.active){nextText=Date.now()+5000;nextBuzz=Date.now()+22000;}
    state=next;
    if(!state.active || state.reduced || document.hidden){restoreText();clearBuzz();}
    updateHiss();
  }
  window.DoryArgEffects={sync:sync};
  setInterval(function(){
    if(!state.active || state.reduced || document.hidden)return;
    var now=Date.now();
    if(now>=nextText){nextText=now+4000+Math.random()*6000;corruptText();}
    if(now>=nextBuzz){nextBuzz=now+18000+Math.random()*17000;buzz();}
  },1000);
  nextText=Date.now()+5000;nextBuzz=Date.now()+22000;
  document.addEventListener("visibilitychange",function(){if(document.hidden){stopHiss();restoreText();clearBuzz();}else updateHiss();});
  document.addEventListener("pointerdown",updateHiss,{passive:true});
  document.addEventListener("keydown",updateHiss);
  window.addEventListener("pagehide",function(){stopHiss();restoreText();clearBuzz();});
})();
