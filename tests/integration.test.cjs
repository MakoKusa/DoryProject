const assert=require('node:assert/strict');require('../js/sauts-common.js');

var DB=[['14/04/2025','Original']],dbi=0,MSG={},CAP={},PH_DEL={},customPhotos={};
var argEntityReturned=false,collapsing=false,creerOn=false,theme='rose',finalDate=null,giftedMemoryDate=null;
var customSauts=[{id:'saut-11111111-2222-4333-8444-555555555555',date:'2027-01-02',title:'Nouveau',message:'Message',time:'18:00',photos:[{path:'photos/p.jpg',caption:'Caption'}]}];
  function applyCustomSauts() {
    var hidden = argEntityReturned || collapsing || creerOn || theme === "null";
    var selected = DB[dbi];
    for (var i = DB.length - 1; i >= 0; i--) if (DB[i].custom && (hidden || DB[i][0] === finalDate || DB[i][0] === giftedMemoryDate)) DB.splice(i, 1);
    if (hidden) return;
    var added = false;
    customSauts.forEach(function (e) {
      var d = DorySauts.displayDate(e.date);
      if (d === finalDate || d === giftedMemoryDate) return;
      if (!DB.some(function (r) { return r[0] === d; })) {
        var row = [d, e.title]; if (e.time) row.push(e.time.length === 5 ? e.time + ":00" : e.time);
        row.custom = true; DB.push(row); added = true;
      }
      MSG[d] = e.message; CAP[d] = e.photos.map(function (p) { return p.caption; });
      customPhotos[d] = e.photos.map(function (p) { return p.path; });
      delete PH_DEL[d];
    });
    if (added) {
      DB.sort(function (a,b) { return a[0].split('/').reverse().join('-').localeCompare(b[0].split('/').reverse().join('-')); });
      if (selected && DB.indexOf(selected) >= 0) dbi = DB.indexOf(selected);
    }
    dbi = Math.max(0, Math.min(dbi, DB.length - 1));
  }

applyCustomSauts();assert.equal(DB.length,2);assert.equal(MSG['02/01/2027'],'Message');assert.equal(DB[1][2],'18:00:00');
applyCustomSauts();assert.equal(DB.length,2);
argEntityReturned=true;applyCustomSauts();assert.equal(DB.length,1);assert.equal(DB[0][1],'Original');
argEntityReturned=false;applyCustomSauts();assert.equal(DB.length,2);
DB=[['14/04/2025','Restored']];applyCustomSauts();assert.equal(DB.length,2);
theme='null';applyCustomSauts();assert.equal(DB.length,1);theme='rose';applyCustomSauts();assert.equal(DB.length,2);
finalDate='02/01/2027';MSG[finalDate]='Final';applyCustomSauts();assert.equal(MSG[finalDate],'Final');assert.equal(DB.length,1);
console.log('PASS: custom merge, no duplicates, ARG isolation, restoration, NULL theme and final-date collision.');
