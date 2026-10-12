(function(root){
  'use strict';
  function buildUpdate(data,entry){
    const clean=DorySauts.validateData(data),matches=clean.entries.filter(e=>e.id===entry.id);
    if(matches.length!==1)throw Error('SAUT absent ou identifiant ambigu. Recharger le dépôt.');
    const old=matches[0];
    if(entry.date!==old.date)throw Error('La date ne peut pas être changée dans ce mode.');
    if(!Array.isArray(entry.photos)||entry.photos.some(p=>!old.photos.some(o=>o.path===p.path)))throw Error('Conserver ou retirer les images existantes uniquement.');
    const updated=DorySauts.validateData({version:1,entries:clean.entries.map(e=>e.id===entry.id?entry:e)});
    if(JSON.stringify(updated)===JSON.stringify(clean))throw Error('Aucune modification à enregistrer.');
    return updated;
  }
  async function save(client,snapshot,entry,target){
    if(client.branch!==target.branch||client.folder!==target.folder)throw Error('La source a changé. Recharger le dépôt.');
    const updated=buildUpdate(snapshot.data,entry),route='/git/refs/heads/'+target.branch.split('/').map(encodeURIComponent).join('/');
    const current=await client.api(client.refRoute());
    if(current.object.sha!==snapshot.head)throw Error('La branche a changé. Recharger le dépôt avant de modifier.');
    const bytes=new TextEncoder().encode(JSON.stringify(updated,null,2)+'\n');let binary='';
    for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const blob=await client.api('/git/blobs','POST',{content:btoa(binary),encoding:'base64'});
    const path=(target.folder?target.folder+'/':'')+'data/sauts.json';
    const tree=await client.api('/git/trees','POST',{base_tree:snapshot.tree,tree:[{path,mode:'100644',type:'blob',sha:blob.sha}]});
    const commit=await client.api('/git/commits','POST',{message:'Modification du SAUT '+entry.date+' : '+entry.title,tree:tree.sha,parents:[snapshot.head]});
    await client.api(route,'PATCH',{sha:commit.sha,force:false});return commit.sha;
  }
  root.DorySautsEditor={buildUpdate,save};
  if(typeof document==='undefined'||window.top!==window.self)return;
  const $=id=>document.getElementById(id),Base=root.DoryGitClient;
  let active=null,state=null,saving=false,selected=null;
  const section=document.createElement('section');
  function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
  section.append(node('h2','Modifier un SAUT existant'),node('p','Titre, message, heure et légendes modifiables. Date et identifiant conservés. Retirer une image la masque dans le SAUT ; son fichier reste dans le dépôt.'));
  const choose=node('select'),form=node('form'),images=node('div'),notice=node('p'),preview=node('pre'),submit=node('button','Enregistrer les modifications');
  images.id='edit-photo-preview';notice.id='edit-status';
  notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');submit.type='submit';
  function field(text,tag,type,max){const label=node('label',text),el=node(tag);if(type)el.type=type;if(max)el.maxLength=max;label.append(el);form.append(label);return el;}
  const choiceLabel=node('label','SAUT à modifier');choiceLabel.append(choose);section.append(choiceLabel);
  const date=field('Date (non modifiable)','input','date'),time=field('Heure facultative','input','time'),title=field('Titre','input','text',120),message=field('Message','textarea',null,10000);
  date.readOnly=true;time.step='1';title.required=true;message.required=true;message.rows=6;
  form.append(images,submit);section.append(form,preview,notice);$('entries').closest('section').after(section);
  function reset(){selected=null;form.reset();images.replaceChildren();preview.textContent='';submit.disabled=true;}
  function render(){
    reset();choose.replaceChildren();const first=node('option',state?'Choisir un SAUT':'Vérifier et charger le dépôt d’abord');first.value='';choose.append(first);
    if(state)for(const e of state.snapshot.data.entries){const option=node('option',DorySauts.displayDate(e.date)+' — '+e.title);option.value=e.id;choose.append(option);}
    choose.disabled=!state||saving;for(const el of form.querySelectorAll('input,textarea,button'))el.disabled=!state||saving;submit.disabled=true;
  }
  root.DoryGitClient=class extends Base{
    constructor(...args){super(...args);active=this;state=null;render();}
    clear(){super.clear();if(active===this){active=null;state=null;render();notice.textContent='Déconnecté. Aucune modification enregistrée.';}}
    async inspect(){
      if(active===this){state=null;render();}
      const branch=this.branch,folder=this.folder,snapshot=await super.inspect();
      if(active===this&&this.branch===branch&&this.folder===folder){state={client:this,snapshot,branch,folder};setTimeout(render,0);}
      return snapshot;
    }
  };
  for(const id of ['branch','folder','source-confirm'])$(id).addEventListener('change',()=>{state=null;render();notice.textContent='Source modifiée : revérifier le dépôt.';});
  choose.onchange=()=>{
    reset();if(!state||!choose.value)return;
    selected=state.snapshot.data.entries.find(e=>e.id===choose.value);if(!selected)return;
    date.value=selected.date;time.value=selected.time;title.value=selected.title;message.value=selected.message;
    selected.photos.forEach((photo,i)=>{
      const figure=node('figure'),img=node('img');img.src=photo.path;img.alt='Photo existante '+(i+1);
      const captionLabel=node('label','Légende'),caption=node('input');caption.type='text';caption.value=photo.caption;caption.maxLength=300;caption.dataset.caption=String(i);captionLabel.append(caption);
      const removeLabel=node('label','Retirer cette image du SAUT'),remove=node('input');remove.type='checkbox';remove.dataset.remove=String(i);removeLabel.className='check';removeLabel.prepend(remove);
      figure.append(img,captionLabel,removeLabel);images.append(figure);
    });
    submit.disabled=false;notice.textContent='Modification préparée localement. Rien n’est encore enregistré.';
  };
  form.onsubmit=async event=>{
    event.preventDefault();if(saving)return;
    try{
      if(!state||!selected)throw Error('Choisir un SAUT après avoir vérifié le dépôt.');
      if(!form.reportValidity())return;
      const entry={...selected,time:time.value,title:title.value.trim(),message:message.value.trim(),photos:selected.photos.filter((p,i)=>!images.querySelector('[data-remove="'+i+'"]').checked).map(p=>{
        const i=selected.photos.indexOf(p);return {path:p.path,caption:images.querySelector('[data-caption="'+i+'"]').value.trim()};
      })};
      buildUpdate(state.snapshot.data,entry);
      const removed=selected.photos.filter(p=>!entry.photos.some(kept=>kept.path===p.path)).map(p=>p.path);
      const draft='Dépôt : MakoKusa/DoryProject\nSource : '+state.branch+' / '+(state.folder||'racine')+'\nIdentifiant : '+entry.id+'\nDate : '+entry.date+'\nHeure : '+entry.time+'\nTitre : '+entry.title+'\nMessage : '+entry.message+'\nImages conservées : '+JSON.stringify(entry.photos)+'\nImages retirées du SAUT : '+(removed.join(', ')||'aucune')+'\nLes fichiers image restent dans le dépôt.';
      preview.textContent=draft;if(!window.confirm('Enregistrer ces modifications ?\n\n'+draft))return;
      saving=true;const controls=[...document.querySelectorAll('button,input,select,textarea')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);
      try{
        notice.textContent='Enregistrement dans GitHub…';const sha=await save(state.client,state.snapshot,entry,{branch:state.branch,folder:state.folder});
        state=null;reset();notice.replaceChildren(node('span','ENREGISTRÉ DANS GITHUB. Déploiement du site à vérifier. '));const link=node('a','Voir le commit');link.href='https://github.com/MakoKusa/DoryProject/commit/'+sha;link.target='_blank';link.rel='noopener noreferrer';notice.append(link);
      }finally{saving=false;controls.forEach(([el,disabled])=>el.disabled=disabled);if(!state)render();}
      $('inspect').click();
    }catch(e){notice.textContent=e.message+' Si l’envoi a été interrompu, vérifier GitHub avant de réessayer.';}
  };
  render();
})(globalThis);
