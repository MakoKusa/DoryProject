const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
let starts=0,stops=0,gains=[];const listeners={};
function n(){return {connect(){},disconnect(){},gain:{value:0,setTargetAtTime(v){gains.push(v)}},frequency:{value:0},start(){starts++},stop(){stops++}}}
const c={sampleRate:100,currentTime:0,state:'running',destination:{},createBufferSource:n,createGain:n,createBiquadFilter:n,createBuffer:(channels,len)=>({getChannelData:()=>new Float32Array(len)})};
const document={hidden:false,documentElement:{classList:{remove(){},add(){}}},addEventListener:(k,f)=>listeners[k]=f};const window={addEventListener(){}};
vm.runInNewContext(fs.readFileSync(process.argv[2],'utf8'),{window,document,Math,Date,Map,Array,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1});
const api=window.DoryArgEffects,base={active:true,err:true,reduced:false,muted:false,volume:50,audio:()=>c};
api.sync(base);api.sync(base);assert.equal(starts,1);assert(gains.includes(.0275));
api.sync({...base,err:false});assert.equal(stops,1);
api.sync({...base,muted:true});assert.equal(starts,1);
api.sync(base);assert.equal(starts,2);document.hidden=true;listeners.visibilitychange();assert.equal(stops,2);
document.hidden=false;listeners.visibilitychange();assert.equal(starts,3);api.sync({...base,volume:0});assert.equal(stops,3);
console.log('PASS: LOG #ERR looping audio; no duplicate source; mute, zero volume, exit and tab-visibility cleanup.');
