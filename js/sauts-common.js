(function (root) {
  "use strict";
  const RESERVED = ["2026-09-19", "2026-09-29"];
  const HISTORICAL_PHOTOS = {"2026-03-12":1,"2026-03-26":1,"2026-04-16":1,"2026-04-25":1,"2026-05-02":1,"2026-05-14":2,"2026-06-18":1,"2026-06-19":3};
  function validateDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Date invalide.');
    const [y,m,d]=value.split('-').map(Number), date=new Date(Date.UTC(y,m-1,d));
    if(y<1900||y>9999||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d) throw Error('Date inexistante.');
    return value;
  }
  function displayDate(value) { validateDate(value);return value.split('-').reverse().join('/'); }
  function validateData(data) {
    if(!data || data.version!==1 || !Array.isArray(data.entries) || data.entries.length>5000) throw Error('Format des données incompatible.');
    const seen=new Set();
    const entries=data.entries.map(e=>{
      validateDate(e.date);
      if(RESERVED.includes(e.date)||seen.has(e.date)) throw Error('Date réservée ou doublon : '+e.date);
      seen.add(e.date);
      if(typeof e.id!=='string'||!/^saut-[a-z0-9-]{12,80}$/.test(e.id)) throw Error('Identifiant invalide.');
      if(typeof e.title!=='string'||!e.title.trim()||e.title.length>120) throw Error('Titre invalide (120 caractères maximum).');
      if(typeof e.message!=='string'||!e.message.trim()||e.message.length>10000) throw Error('Message invalide (10 000 caractères maximum).');
      if(e.time && !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(e.time)) throw Error('Heure invalide.');
      if(!Array.isArray(e.photos)||e.photos.length>3) throw Error('Trois photos maximum.');
      const photos=e.photos.map(p=>{
        const modern=typeof p.path==='string'&&new RegExp('^photos/'+e.date+'_'+e.id+'_[1-3]\\.jpg$').test(p.path);
        const historical=e.id==='saut-historique-'+e.date&&Object.prototype.hasOwnProperty.call(HISTORICAL_PHOTOS,e.date)&&Array.from({length:HISTORICAL_PHOTOS[e.date]},(_,i)=>'photos/'+e.date+'_'+(i+1)+'.jpg').includes(p.path);
        if(!modern&&!historical) throw Error('Chemin photo invalide.');
        if(typeof p.caption!=='string'||p.caption.length>300) throw Error('Légende invalide.');
        return {path:p.path,caption:p.caption};
      });
      if(new Set(photos.map(p=>p.path)).size!==photos.length) throw Error('Photo dupliquée.');
      return {id:e.id,date:e.date,time:e.time||'',title:e.title.trim(),message:e.message.trim(),photos};
    });
    return {version:1,entries};
  }
  root.DorySauts={RESERVED,validateDate,displayDate,validateData};
})(typeof globalThis!=='undefined'?globalThis:window);
