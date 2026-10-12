(function(){
  'use strict';
  const Client=window.DoryGitClient;
  const inspect=Client.prototype.inspect;
  Client.prototype.inspect=async function(...args){
    const snapshot=await inspect.apply(this,args);
    window.dispatchEvent(new CustomEvent('dory-sauts-inspected',{detail:{client:this,snapshot}}));
    return snapshot;
  };
  Client.prototype.edit=async function(snapshot,entry){
    const original=snapshot.data.entries.find(e=>e.id===entry.id);
    if(!original||entry.date!==original.date||entry.time!==original.time)throw Error('Entrée inconnue ou date/heure modifiée.');
    if(entry.photos.some(p=>!original.photos.some(o=>o.path===p.path)))throw Error('Seules les photos existantes peuvent être conservées.');
    const updated=DorySauts.validateData({version:1,entries:snapshot.data.entries.map(e=>e.id===entry.id?entry:e)});
    const current=await this.api(this.refRoute());
    if(current.object.sha!==snapshot.head)throw Error('La branche a changé. Recharge les entrées avant de modifier.');
    const removed=original.photos.filter(p=>!entry.photos.some(o=>o.path===p.path));
    const bytes=new TextEncoder().encode(JSON.stringify(updated,null,2)+'\n');
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const blob=await this.api('/git/blobs','POST',{content:btoa(binary),encoding:'base64'});
    const items=[{path:this.path('data/sauts.json'),mode:'100644',type:'blob',sha:blob.sha}];
    for(const photo of removed){
      const shared=updated.entries.some(e=>e.photos.some(p=>p.path===photo.path));
      const file=snapshot.map.get(this.path(photo.path));
      if(!shared&&file&&file.type==='blob')items.push({path:this.path(photo.path),mode:'100644',type:'blob',sha:null});
    }
    const tree=await this.api('/git/trees','POST',{base_tree:snapshot.tree,tree:items});
    const commit=await this.api('/git/commits','POST',{message:'Modification du SAUT '+entry.date+' : '+entry.title,tree:tree.sha,parents:[snapshot.head]});
    await this.api('/git/refs/heads/'+this.branch.split('/').map(encodeURIComponent).join('/'),'PATCH',{sha:commit.sha,force:false});
    return commit.sha;
  };
  // Editor UI: reuse the connection validated by the existing manager.
  const $=id=>document.getElementById(id);
  let context=null,busy=false;
  const section=document.createElement('section');
  section.innerHTML='<h2>Modifier un SAUT ajouté</h2><p>Charge les entrées avec « Vérifier la source et charger les entrées ». Les souvenirs d’origine et de l’ARG ne sont pas éditables ici.</p><form id="edit-form"><label>SAUT<select id="edit-entry"><option value="">Choisir un SAUT</option></select></label><p id="edit-date"></p><label>Titre<input id="edit-title" maxlength="120" required></label><label>Message<textarea id="edit-message" rows="6" maxlength="10000" required></textarea></label><div id="edit-gallery"></div><p>Cocher une image la retirera du SAUT et supprimera son fichier de la version courante du dépôt après confirmation. Les anciens commits restent intacts.</p><button id="edit-save" type="submit" disabled>Enregistrer les modifications</button><button id="edit-cancel" type="button">Annuler les modifications</button></form><p id="edit-status" role="status" aria-live="polite">Aucune entrée chargée.</p><div id="edit-result"></div>';
  $('entries').closest('section').before(section);
  function state(){const valid=!!context&&!!$('edit-entry').value;$('edit-save').disabled=busy||!valid;for(const el of section.querySelectorAll('input,textarea'))el.disabled=busy||!valid;}
  function reset(){context=null;$('edit-entry').replaceChildren(new Option('Choisir un SAUT',''));$('edit-gallery').replaceChildren();$('edit-date').textContent='';$('edit-title').value='';$('edit-message').value='';$('edit-status').textContent='Recharge les entrées pour modifier un SAUT.';state();}
  function selected(){return context?.snapshot.data.entries.find(e=>e.id===$('edit-entry').value);}
  function populate(){
    const e=selected();$('edit-gallery').replaceChildren();
    $('edit-title').value=e?.title||'';$('edit-message').value=e?.message||'';$('edit-date').textContent=e?DorySauts.displayDate(e.date)+(e.time?' — '+e.time:''):'';
    if(e)e.photos.forEach((p,i)=>{
      const figure=document.createElement('figure'),image=document.createElement('img'),label=document.createElement('label'),check=document.createElement('input'),caption=document.createElement('figcaption');
      image.src=p.path;image.alt=p.caption||'Photo '+(i+1);check.type='checkbox';check.dataset.path=p.path;label.className='check';label.append(check,document.createTextNode('Retirer cette image'));caption.textContent=p.caption;figure.append(image,caption,label);$('edit-gallery').append(figure);
    });
    state();
  }
  window.addEventListener('dory-sauts-inspected',event=>{
    const {client,snapshot}=event.detail;
    if(client.branch!==$('branch').value||client.folder!==$('folder').value||!$('source-confirm').checked)return;
    context={client,snapshot};$('edit-entry').replaceChildren(new Option('Choisir un SAUT',''));
    for(const e of snapshot.data.entries)$('edit-entry').append(new Option(DorySauts.displayDate(e.date)+' — '+e.title,e.id));
    populate();$('edit-status').textContent=snapshot.data.entries.length+' entrée(s) disponibles.';setTimeout(state,0);
  });
  for(const id of ['branch','folder','source-confirm'])$(id).addEventListener('change',reset);
  for(const id of ['disconnect','branches'])$(id).addEventListener('click',reset);
  $('edit-entry').onchange=populate;$('edit-cancel').onclick=populate;
  $('edit-form').onsubmit=async event=>{
    event.preventDefault();if(busy)return;
    const e=selected();if(!e||!context){$('edit-status').textContent='Charge les entrées puis choisis un SAUT.';return;}
    if(!$('edit-form').reportValidity())return;
    const removed=[...$('edit-gallery').querySelectorAll('input:checked')].map(el=>el.dataset.path);
    const entry={...e,title:$('edit-title').value.trim(),message:$('edit-message').value.trim(),photos:e.photos.filter(p=>!removed.includes(p.path)).map(p=>({...p}))};
    try{DorySauts.validateData({version:1,entries:[entry]});}catch(error){$('edit-status').textContent=error.message;return;}
    if(JSON.stringify(entry)===JSON.stringify(e)){$('edit-status').textContent='Aucune modification.';return;}
    const client=context.client,snapshot=context.snapshot;
    if(!window.confirm('Modifier ce SAUT dans MakoKusa/DoryProject ?\nBranche : '+client.branch+' / '+(client.folder||'racine')+'\nDate : '+entry.date+' '+entry.time+'\nTitre : '+entry.title+'\nMessage : '+entry.message+'\nImages retirées : '+(removed.join(', ')||'aucune')+'\nLes autres SAUTS restent inchangés. Les anciens commits conservent les images.'))return;
    const controls=[...document.querySelectorAll('button,input,select,textarea')].map(el=>[el,el.disabled]);busy=true;for(const [el] of controls)el.disabled=true;
    let saved=false;
    try{
      $('edit-status').textContent='Enregistrement dans GitHub…';const sha=await client.edit(snapshot,entry);saved=true;
      $('edit-result').replaceChildren();const link=document.createElement('a');link.href='https://github.com/MakoKusa/DoryProject/commit/'+sha;link.textContent='Voir la modification enregistrée';link.target='_blank';link.rel='noopener noreferrer';$('edit-result').append(link);
      context=null;await $('inspect').onclick();$('edit-status').textContent=context?'Modification enregistrée. Déploiement GitHub Pages à vérifier.':'Modification enregistrée. Recharge les entrées avant de continuer.';
    }catch(error){reset();$('edit-status').textContent=error.message+' Si l’envoi a été interrompu, vérifier GitHub avant de recommencer.';}
    finally{busy=false;for(const [el,disabled] of controls)if(el.isConnected)el.disabled=disabled;if(saved)$('publish').disabled=!context;state();}
  };
  window.addEventListener('pagehide',()=>{context=null;});state();
})();
