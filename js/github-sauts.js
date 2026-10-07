(function (root) {
  'use strict';
  class GitClient {
    #token;
    constructor(token, branch, folder='') {
      this.#token=token;this.branch=branch;this.folder=folder;
      this.base='https://api.github.com/repos/MakoKusa/DoryProject';
      if(folder!==''&&folder!=='docs') throw Error('Dossier de publication : racine ou docs uniquement.');
    }
    clear(){this.#token='';}
    async api(route, method='GET', body, missingOK=false) {
      if(!this.#token) throw Error('Jeton manquant.');
      const response=await fetch(this.base+route,{method,cache:'no-store',credentials:'omit',headers:{
        Accept:'application/vnd.github+json',Authorization:'Bearer '+this.#token,
        'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})
      },...(body?{body:JSON.stringify(body)}:{})});
      if(missingOK&&response.status===404)return null;
      if(!response.ok){
        let detail='';try {const d=await response.json();detail=d.message||'';}catch{}
        const note=response.status===401?'Jeton invalide ou expiré.':response.status===403?'Droits insuffisants ou limite API atteinte.':response.status===409||response.status===422?'Conflit ou règle de protection de branche : aucune écriture forcée.':'';
        throw Error('GitHub '+response.status+'. '+note+' '+detail);
      }
      return response.json();
    }
    path(relative){return (this.folder?this.folder+'/':'')+relative;}
    refRoute(){return '/git/ref/heads/'+this.branch.split('/').map(encodeURIComponent).join('/');}
    async inspect(){
      const ref=await this.api(this.refRoute());
      const commit=await this.api('/git/commits/'+ref.object.sha);
      const result=await this.api('/git/trees/'+commit.tree.sha+'?recursive=1');
      if(result.truncated)throw Error('Arborescence trop grande pour ce prototype.');
      const map=new Map(result.tree.map(x=>[x.path,x]));
      for(const name of ['index.html','js/app.js','js/sauts-common.js'])if(!map.has(this.path(name)))throw Error('Installer le paquet v52 dans ce dossier avant de publier : '+name+' absent.');
      const file=map.get(this.path('data/sauts.json'));let data={version:1,entries:[]};
      if(file){
        const blob=await this.api('/git/blobs/'+file.sha);
        if(blob.encoding!=='base64')throw Error('Encodage JSON inattendu.');
        const bytes=Uint8Array.from(atob(blob.content.replace(/\s/g,'')),c=>c.charCodeAt(0));
        data=DorySauts.validateData(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
      }
      return {head:ref.object.sha,tree:commit.tree.sha,map,data};
    }
    async publish(snapshot, entry, photos){
      const current=await this.api(this.refRoute());
      if(current.object.sha!==snapshot.head)throw Error('La branche a changé. Revérifier le dépôt avant de publier.');
      const updated=DorySauts.validateData({version:1,entries:[...snapshot.data.entries,entry]});
      const items=[];
      for(const photo of photos){
        if(snapshot.map.has(this.path(photo.path)))throw Error('Photo existante : refus de remplacement.');
        const blob=await this.api('/git/blobs','POST',{content:photo.base64,encoding:'base64'});
        items.push({path:this.path(photo.path),mode:'100644',type:'blob',sha:blob.sha});
      }
      const bytes=new TextEncoder().encode(JSON.stringify(updated,null,2)+'\n');
      let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      const blob=await this.api('/git/blobs','POST',{content:btoa(binary),encoding:'base64'});
      items.push({path:this.path('data/sauts.json'),mode:'100644',type:'blob',sha:blob.sha});
      const tree=await this.api('/git/trees','POST',{base_tree:snapshot.tree,tree:items});
      const commit=await this.api('/git/commits','POST',{message:'Ajout du SAUT '+entry.date+' : '+entry.title,tree:tree.sha,parents:[snapshot.head]});
      // Non-fast-forward updates are rejected: never overwrite concurrent changes.
      await this.api('/git/refs/heads/'+this.branch.split('/').map(encodeURIComponent).join('/'),'PATCH',{sha:commit.sha,force:false});
      return commit.sha;
    }
  }
  root.DoryGitClient=GitClient;
})(globalThis);
