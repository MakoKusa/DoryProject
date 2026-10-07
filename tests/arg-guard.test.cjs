const assert=require('node:assert/strict');var hauntSelfCmd=true,nullSautsUsed=false,userRanSauts=false,tk=1,scr='arg',sautsEdits=1,visits=0;
function draw(){}function thump(){}function go(){visits++}function hauntSautsVisit(){}function argType(){return {then(f){f(true)}}}
function cmd(){
      var selfS = hauntSelfCmd;
      if (selfS) { if (nullSautsUsed) { draw(); return; } nullSautsUsed = true; }
      else userRanSauts = true;
      argType(["Les dates sont à moi.", "Je les range."], tk, 520).then(function (ok) { if (ok && scr === "arg") { thump(); go("db"); if (!selfS && sautsEdits === 0) hauntSautsVisit(); } }); return;
}
cmd();cmd();assert.equal(visits,1);hauntSelfCmd=false;cmd();cmd();assert.equal(visits,3);assert(userRanSauts);console.log('PASS: NULL only once; player unrestricted.');
