(function(){
  'use strict';
  if(window.top!==window.self){document.body.textContent='Ouvrir cette page directement, pas dans un cadre intégré.';return;}
  const $=id=>document.getElementById(id);
  let client=null,snapshot=null,busy=false,previewUrls=[];
  function status(text){$('status').textContent=text;}
  function invalidate(){snapshot=null;$('publish').disabled=true;}
  function unlock(){busy=false;for(const el of document.querySelectorAll('button,input,select,textarea'))el.disabled=false;$('publish').disabled=!snapshot;}
  function lock(){busy=true;for(const el of document.querySelectorAll('button,input,select,textarea'))el.disabled=true;}
  function connection(){
    const token=$('token').value.trim();
    if(!token)throw Error('Saisir un jeton GitHub.');
    const c=new DoryGitClient(token,$('branch').value,$('folder').value);
    $('token').value='';return c;
  }
  $('disconnect').onclick=()=>{if(client)client.clear();client=null;$('token').value='';invalidate();$('entries').replaceChildren();status('Déconnecté. Jeton effacé de la mémoire de l’outil.');};
  $('branches').onclick=async()=>{
    if(busy)return;
    try{
      const newClient=connection();if(client)client.clear();client=newClient;invalidate();lock();
      const info=await client.api(''),branches=[];
      for(let page=1;page<=10;page++){
        const batch=await client.api('/branches?per_page=100&page='+page);branches.push(...batch);if(batch.length<100)break;
      }
      $('branch').replaceChildren();
      for(const branch of branches){const opt=document.createElement('option');opt.value=branch.name;opt.textContent=branch.name+(branch.name===info.default_branch?' (branche par défaut, pas forcément publiée)':'');$('branch').append(opt);}
      $('branch').value=info.default_branch;client.branch=info.default_branch;
      status('Branches chargées. Vérifier la source de publication dans Settings → Pages. Aucune écriture.');
    }catch(e){status(e.message);}finally{unlock();}
  };
  for(const id of ['branch','folder','source-confirm'])$(id).onchange=()=>{invalidate();};
  $('inspect').onclick=async()=>{
    if(busy)return;
    try{
      if(!client)client=connection();
      if(!$('branch').value||!$('source-confirm').checked)throw Error('Choisir la branche et confirmer sa source de publication.');
      client.branch=$('branch').value;client.folder=$('folder').value;invalidate();lock();status('Lecture du dépôt…');
      snapshot=await client.inspect();$('entries').replaceChildren();
      for(const e of snapshot.data.entries){const li=document.createElement('li');li.textContent=DorySauts.displayDate(e.date)+' — '+e.title;$('entries').append(li);}
      status('Source vérifiée : '+client.branch+' / '+(client.folder||'racine')+'. '+snapshot.data.entries.length+' entrée(s) ajoutée(s).');
    }catch(e){invalidate();status(e.message);}finally{unlock();}
  };
  $('photos').onchange=()=>{
    for(const url of previewUrls)URL.revokeObjectURL(url);previewUrls=[];$('photo-preview').replaceChildren();
    const selected=[...$('photos').files];
    if(selected.length>3){$('photos').value='';status('Trois photos maximum.');return;}
    selected.forEach((file,i)=>{
      const fig=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('input');
      const url=URL.createObjectURL(file);previewUrls.push(url);img.src=url;img.alt='Photo '+(i+1);
      caption.id='caption-'+i;caption.maxLength=300;caption.placeholder='Légende facultative';caption.setAttribute('aria-label','Légende photo '+(i+1));
      fig.append(img,caption);$('photo-preview').append(fig);
    });
  };
  function formEntry(){
    if(!$('entry-form').reportValidity())throw Error('Compléter les champs obligatoires.');
    const date=DorySauts.validateDate($('date').value);
    if(DorySauts.RESERVED.includes(date)||snapshot?.data.entries.some(e=>e.date===date))throw Error('Cette date est déjà utilisée ou réservée à l’ARG.');
    let final='';try{final=localStorage.getItem('mop_halloween26')||'';}catch{}
    if(final===DorySauts.displayDate(date))throw Error('Cette date est utilisée par le SAUT final de cet appareil.');
    const e={id:'saut-'+crypto.randomUUID(),date,time:$('time').value,title:$('title').value.trim(),message:$('message').value.trim(),photos:[]};
    return DorySauts.validateData({version:1,entries:[e]}).entries[0];
  }
  $('preview').onclick=()=>{try{const e=formEntry();$('entry-preview').textContent=DorySauts.displayDate(e.date)+(e.time?' — '+e.time:'')+'\n'+e.title+'\n\n'+e.message+'\n\n'+$('photos').files.length+' photo(s).';}catch(e){status(e.message);}};
  async function preparePhoto(file,path,caption){
    if(file.size>10*1024*1024)throw Error('Photo supérieure à 10 Mo : '+file.name);
    const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
    const jpeg=header[0]===255&&header[1]===216&&header[2]===255;
    const png=header[0]===137&&header[1]===80&&header[2]===78&&header[3]===71;
    const webp=String.fromCharCode(...header.slice(0,4))==='RIFF'&&String.fromCharCode(...header.slice(8,12))==='WEBP';
    if(!jpeg&&!png&&!webp)throw Error('JPEG, PNG ou WebP uniquement : '+file.name);
    const image=await createImageBitmap(file);
    try{
      if(image.width*image.height>60000000)throw Error('Image trop grande : '+file.name);
      const ratio=Math.min(1,2048/Math.max(image.width,image.height)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.86));
      if(!blob||blob.size>5*1024*1024)throw Error('Échec de conversion ou image trop lourde.');
      const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
      for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      return {path,caption,base64:btoa(binary)};
    }finally{image.close();}
  }
  $('entry-form').onsubmit=async event=>{
    event.preventDefault();if(busy)return;
    try{
      if(!snapshot||!client)throw Error('Vérifier le dépôt avant de publier.');
      const e=formEntry(),selected=[...$('photos').files];if(selected.length>3)throw Error('Trois photos maximum.');
      const target=client.branch+' / '+(client.folder||'racine');
      if(!window.confirm('Publier ce SAUT dans MakoKusa/DoryProject ?\nSource : '+target+'\nDate : '+e.date+' '+e.time+'\nTitre : '+e.title+'\nMessage : '+e.message+'\nPhotos : '+selected.length+'\nLes données seront publiques. Les autres fichiers ne seront pas remplacés.'))return;
      lock();status('Préparation des photos…');const prepared=[];
      for(let i=0;i<selected.length;i++)prepared.push(await preparePhoto(selected[i],'photos/'+e.date+'_'+e.id+'_'+(i+1)+'.jpg',$('caption-'+i).value.trim()));
      e.photos=prepared.map(p=>({path:p.path,caption:p.caption}));DorySauts.validateData({version:1,entries:[e]});
      status('Enregistrement dans GitHub. Ne pas fermer cette page…');
      const sha=await client.publish(snapshot,e,prepared);invalidate();
      $('result').replaceChildren();const link=document.createElement('a');link.href='https://github.com/MakoKusa/DoryProject/commit/'+sha;link.textContent='Voir le commit enregistré';link.target='_blank';link.rel='noopener noreferrer';$('result').append(link);
      status('ENREGISTRÉ DANS GITHUB. Déploiement GitHub Pages en attente : la présence sur le site n’est pas encore confirmée. Revérifier la source avant un nouvel ajout.');
    }catch(e){invalidate();status(e.message+'\nSi la connexion a été interrompue après l’envoi, vérifier GitHub avant de recommencer.');}finally{unlock();}
  };
  window.addEventListener('pagehide',()=>{if(client)client.clear();for(const url of previewUrls)URL.revokeObjectURL(url);$('token').value='';});
})();
