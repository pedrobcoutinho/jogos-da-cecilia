/* Pure rules shared by the numbers interface and its tests. No microphone. */
(function(root){
  'use strict';
  const names=['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','catorze','quinze','dezesseis','dezessete','dezoito','dezenove','vinte'];
  const key='cecilia.numbers.v1';
  const integer=(value,min,max,fallback)=>Number.isInteger(value)&&value>=min&&value<=max?value:fallback;
  function normalize(value={}){
    if(!value||typeof value!=='object')value={};
    return {
      version:1,
      stars:integer(value.stars,0,1000000,0),
      learnMax:[10,20].includes(value.learnMax)?value.learnMax:10,
      recognizeMax:[10,20].includes(value.recognizeMax)?value.recognizeMax:10,
      mathMax:[5,10,20].includes(value.mathMax)?value.mathMax:5,
      streak:integer(value.streak,0,4,0),
      seen:[...new Set(Array.isArray(value.seen)?value.seen.filter(n=>Number.isInteger(n)&&n>=0&&n<=20):[])]
    };
  }
  function load(storage){
    try{return {progress:normalize(JSON.parse(storage.getItem(key)||'{}')),available:true}}
    catch{return {progress:normalize(),available:false}}
  }
  function save(storage,progress){
    try{storage.setItem(key,JSON.stringify(normalize(progress)));return true}catch{return false}
  }
  function shuffle(items,random=Math.random){
    const copy=[...items];
    for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}
    return copy;
  }
  function options(correct,max,count=3,random=Math.random){
    const others=Array.from({length:max+1},(_,n)=>n).filter(n=>n!==correct);
    return shuffle([correct,...shuffle(others,random).slice(0,count-1)],random);
  }
  function recognition(max,previous=-1,random=Math.random){
    const pool=Array.from({length:max+1},(_,n)=>n).filter(n=>n!==previous);
    const answer=pool[Math.floor(random()*pool.length)];
    return {answer,options:options(answer,max,3,random)};
  }
  function arithmetic(max,random=Math.random){
    const subtract=random()<.5;
    const a=Math.floor(random()*(max+1));
    const b=Math.floor(random()*((subtract?a:max-a)+1));
    const answer=subtract?a-b:a+b;
    return {a,b,operator:subtract?'−':'+',answer,options:options(answer,max,3,random)};
  }
  function reward(progress,mode,firstTry){
    const p=normalize(progress);
    p.stars=Math.min(1000000,p.stars+1);
    let promoted=false;
    if(mode==='math'){
      p.streak=firstTry?p.streak+1:0;
      if(p.streak>=5){
        if(p.mathMax<20){p.mathMax=p.mathMax===5?10:20;promoted=true}
        p.streak=0;
      }
    }
    return {progress:p,promoted};
  }
  function exportBackup(progress){
    return JSON.stringify({app:'jogos-da-cecilia',format:1,exportedAt:new Date().toISOString(),progress:normalize(progress)},null,2);
  }
  function importBackup(text){
    if(typeof text!=='string'||text.length>65536)throw Error('Arquivo muito grande. Escolha um backup dos números.');
    let data;
    try{data=JSON.parse(text)}catch{throw Error('Não foi possível ler este arquivo JSON.')}
    if(!data||data.app!=='jogos-da-cecilia'||data.format!==1)throw Error('Este arquivo não é um backup compatível dos Jogos da Cecília.');
    const p=data.progress;
    if(!p||p.version!==1||!Number.isInteger(p.stars)||p.stars<0||p.stars>1000000||
      ![10,20].includes(p.learnMax)||![10,20].includes(p.recognizeMax)||![5,10,20].includes(p.mathMax)||
      !Number.isInteger(p.streak)||p.streak<0||p.streak>4||!Array.isArray(p.seen)||p.seen.length>21||
      p.seen.some(n=>!Number.isInteger(n)||n<0||n>20)||new Set(p.seen).size!==p.seen.length)
      throw Error('O progresso do arquivo está incompleto ou inválido. Nada foi alterado.');
    return normalize(p);
  }
  const api={names,key,normalize,load,save,shuffle,options,recognition,arithmetic,reward,exportBackup,importBackup};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CeciliaNumbers=api;
})(typeof window!=='undefined'?window:globalThis);
