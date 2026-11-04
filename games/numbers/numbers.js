(function(){
  'use strict';
  const C=window.CeciliaNumbers,$=id=>document.getElementById(id);
  let storage;
  try{storage=window.localStorage}catch{storage=null}
  const loaded=C.load(storage);
  let progress=loaded.progress,mode=null,question=null,selected=0,previous=-1;
  let token=0,speech=null,speechWatch=null,nextTimer=null,phase='menu',attempts=0;
  let pauseState=null;
  $('storage-note').hidden=loaded.available;
  function persist(){
    if(!C.save(storage,progress))$('storage-note').hidden=false;
    $('stars').textContent='⭐ '+progress.stars;
  }
  function cancel(){
    token++;
    clearTimeout(nextTimer);clearTimeout(speechWatch);
    if(speech){speech.onend=speech.onerror=speech.onstart=null;speech=null}
    if(window.CeciliaAudio)window.CeciliaAudio.cancel();
    else window.speechSynthesis?.cancel();
  }
  function say(text,done=()=>{}){
    cancel();
    const version=token;
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){done();return}
    const u=new SpeechSynthesisUtterance(text);
    speech=u;u.lang='pt-BR';u.rate=1.12;u.pitch=1.08;
    let started=false;const began=Date.now();
    const finish=()=>{
      if(version!==token||speech!==u)return;
      clearTimeout(speechWatch);window.CeciliaAudio?.finished(u);
      u.onend=u.onerror=u.onstart=null;speech=null;done();
    };
    u.onstart=()=>{started=true};
    u.onend=finish;u.onerror=finish;
    function watch(){
      if(version!==token||speech!==u)return;
      const elapsed=Date.now()-began;
      if((!window.speechSynthesis.speaking&&(started||elapsed>8000))||elapsed>Math.max(30000,text.length*180+10000)){
        if(!started||window.speechSynthesis.speaking)window.CeciliaAudio?.timeout(u);
        u.onend=u.onerror=null;
        if(window.CeciliaAudio)window.CeciliaAudio.cancel();else window.speechSynthesis.cancel();
        finish();
      }else speechWatch=setTimeout(watch,1000);
    }
    speechWatch=setTimeout(watch,1000);
    try{if(window.CeciliaAudio)window.CeciliaAudio.play(u);else window.speechSynthesis.speak(u)}catch{finish()}
  }
  function max(){return progress[mode==='math'?'mathMax':mode==='learn'?'learnMax':'recognizeMax']}
  function setPhase(value){
    phase=value;
    $('repeat').disabled=['paused','feedback'].includes(value);
    document.querySelectorAll('#choices button').forEach(b=>b.disabled=value!=='answer'||b.dataset.tried==='yes');
  }
  function feedback(text,success=false){
    $('feedback').textContent=text;$('feedback').className='feedback'+(success?' success':'');
  }
  function objects(count,icon='⭐',removed=0){
    if(count===0)return '<p class="zero">Nenhum objeto. Isso é zero!</p>';
    return '<div class="objects" role="img" aria-label="'+count+' objetos'+(removed?', '+removed+' retirados':'')+'">'+Array.from({length:count},(_,i)=>
      '<span aria-hidden="true" class="object'+(i>=count-removed?' removed':'')+'">'+icon+'</span>').join('')+'</div>';
  }
  function configureRange(){
    const choices=mode==='math'?[5,10,20]:[10,20];
    $('range').innerHTML=choices.map(n=>'<option value="'+n+'">Até '+n+'</option>').join('');
    $('range').value=String(max());
  }
  function note(){
    $('progress-note').textContent=mode==='learn'?
      progress.seen.filter(n=>n<=max()).length+' de '+(max()+1)+' números explorados':
      mode==='math'?(max()<20?progress.streak+' de 5 acertos seguidos para o próximo nível':'Você chegou às continhas até 20!'):'Cada acerto ganha uma estrela!';
  }
  function openMode(value){
    clearImport();
    cancel();mode=value;previous=-1;pauseState=null;
    $('menu').hidden=true;$('paused').hidden=true;$('activity').hidden=false;
    configureRange();
    if(mode==='learn')showLearning(Math.min(selected,max()));else newQuestion();
    $('question').focus();
  }
  function showLearning(n){
    selected=n;setPhase('learn');
    $('question').textContent='Toque em um número!';
    $('content').innerHTML='<div class="number-display">'+n+'</div><p class="number-name">'+C.names[n]+'</p>'+objects(n);
    $('choices').innerHTML='';$('celebration').textContent='';
    $('learn-grid').hidden=false;
    $('learn-grid').innerHTML=Array.from({length:max()+1},(_,i)=>'<button class="number-button" data-number="'+i+'" aria-label="'+C.names[i]+'" aria-pressed="'+(i===n)+'">'+i+'</button>').join('');
    document.querySelectorAll('[data-number]').forEach(b=>b.onclick=()=>showLearning(Number(b.dataset.number)));
    if(!progress.seen.includes(n)){progress.seen.push(n);persist()}
    feedback(n===0?'Zero: nenhuma estrela!':'Vamos contar '+(n===1?'uma estrela!':n+' estrelas!'));
    note();say(C.names[n]+'. '+(n===0?'Nenhuma estrela.':n===1?'Uma estrela.':C.names[n]+' estrelas.'));
  }
  function questionText(){
    if(mode==='recognize')return 'Onde está o número '+C.names[question.answer]+'?';
    return 'Quanto é '+C.names[question.a]+(question.operator==='+'?' mais ':' menos ')+C.names[question.b]+'?';
  }
  function renderQuestion(){
    $('learn-grid').hidden=true;$('learn-grid').innerHTML='';
    $('celebration').textContent='';$('celebration').className='celebration';
    $('question').textContent=mode==='recognize'?'Onde está o '+C.names[question.answer].toLocaleUpperCase('pt-BR')+'?':'Vamos contar as maçãs!';
    if(mode==='recognize'){
      $('content').innerHTML='<div class="number-display" aria-hidden="true">🔎</div>';
    }else{
      const visual=question.operator==='+'?
        '<div class="math-picture">'+objects(question.a,'🍎')+'<span class="operator" aria-hidden="true">+</span>'+objects(question.b,'🍎')+'</div>':
        objects(question.a,'🍎',question.b);
      $('content').innerHTML='<div class="equation">'+question.a+' '+question.operator+' '+question.b+' = ?</div>'+visual+
        (question.operator==='−'?'<p>As maçãs riscadas saíram. Quantas ficaram?</p>':'');
    }
    $('choices').innerHTML=question.options.map(n=>'<button class="choice" data-answer="'+n+'" aria-label="'+C.names[n]+'">'+n+'</button>').join('');
    document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>answer(Number(b.dataset.answer),b));
    note();
  }
  function ask(){
    setPhase('speaking');feedback('🔊 Escute…');
    say(questionText(),()=>{setPhase('answer');feedback('Sua vez! Toque na resposta.');});
  }
  function newQuestion(){
    cancel();attempts=0;
    question=mode==='recognize'?C.recognition(max(),previous):C.arithmetic(max());
    previous=question.answer;
    renderQuestion();ask();
  }
  function answer(value,button){
    if(phase!=='answer'||button.dataset.tried==='yes')return;
    setPhase('feedback');
    if(value!==question.answer){
      attempts++;
      if(mode==='math'){progress.streak=0;persist();note()}
      button.dataset.tried='yes';button.className='choice wrong';
      feedback(mode==='math'?'Ainda não! Conte as maçãs e tente de novo.':'Ainda não! Vamos procurar o '+C.names[question.answer].toLocaleUpperCase('pt-BR')+'.');
      say(mode==='math'?'Ainda não. Conte as maçãs e tente de novo.':'Ainda não. Procure o número '+C.names[question.answer]+'.',()=>setPhase('answer'));
      return;
    }
    button.className='choice correct';
    if(mode==='recognize'){
      $('content').innerHTML='<div class="number-display">'+question.answer+'</div><p class="number-name">'+C.names[question.answer]+'</p>';
    }
    const earned=C.reward(progress,mode,attempts===0);progress=earned.progress;persist();note();
    $('celebration').textContent='⭐ ⭐ ⭐';$('celebration').className='celebration pop';
    const message='Parabéns! Você acertou!'+(earned.promoted?' Agora vamos brincar até '+max()+'!':'');
    feedback(message,true);
    configureRange();
    say('Parabéns! Você acertou!'+(earned.promoted?' Você chegou ao próximo nível!':''),()=>{
      const version=token;
      nextTimer=setTimeout(()=>{if(version===token)newQuestion()},650);
    });
  }
  function menu(){
    cancel();mode=null;question=null;pauseState=null;phase='menu';
    $('menu').hidden=false;$('activity').hidden=true;$('paused').hidden=true;
  }
  function pause(){
    if(!mode||phase==='paused')return;
    pauseState={advance:phase==='feedback'&&document.querySelector('#choices .correct')!==null};
    cancel();setPhase('paused');$('activity').hidden=true;$('paused').hidden=false;
  }
  function resume(){
    if(phase!=='paused')return;
    $('paused').hidden=true;$('activity').hidden=false;
    if(mode==='learn')showLearning(selected);
    else if(pauseState?.advance)newQuestion();
    else ask();
    pauseState=null;
  }
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>openMode(b.dataset.mode));
  $('back-menu').onclick=menu;$('paused-menu').onclick=menu;
  $('pause').onclick=pause;$('resume').onclick=resume;
  $('range').onchange=()=>{
    const n=Number($('range').value);
    if(!(mode==='math'?[5,10,20]:[10,20]).includes(n))return;
    progress[mode==='math'?'mathMax':mode==='learn'?'learnMax':'recognizeMax']=n;
    if(mode==='math')progress.streak=0;
    persist();openMode(mode);
  };
  $('repeat').onclick=()=>{if(mode==='learn')showLearning(selected);else if(['answer','speaking'].includes(phase))ask()};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
  window.addEventListener('pagehide',cancel);
  let pendingImport=null,importRevision=0;
  function clearImport(){
    pendingImport=null;importRevision++;
    $('backup-preview').hidden=true;$('backup-file').value='';
  }
  $('backup-export').onclick=()=>{
    const blob=new Blob([C.exportBackup(progress)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='cecilia-numeros-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    $('backup-message').textContent='Backup preparado. Guarde o arquivo em Arquivos ou Downloads.';
  };
  $('backup-file').onchange=async()=>{
    const file=$('backup-file').files[0];clearImport();
    const version=importRevision;
    $('backup-message').textContent='';
    if(!file)return;
    try{
      if(file.size>65536)throw Error('Arquivo muito grande. Escolha um backup dos números.');
      const content=await file.text();
      if(version!==importRevision||phase!=='menu')return;
      pendingImport=C.importBackup(content);
      $('backup-summary').textContent=pendingImport.stars+' estrelas; '+pendingImport.seen.length+' números explorados; aprender até '+pendingImport.learnMax+', encontrar até '+pendingImport.recognizeMax+' e continhas até '+pendingImport.mathMax+'. A restauração substitui o progresso atual neste aparelho.';
      $('backup-preview').hidden=false;
    }catch(error){if(version===importRevision)$('backup-message').textContent=error.message}
  };
  $('backup-cancel').onclick=clearImport;
  $('backup-restore').onclick=()=>{
    if(!pendingImport||phase!=='menu')return;
    try{
      // Keep the previous state before replacing the existing, unchanged key.
      storage.setItem(C.key+'.before-import',C.exportBackup(progress));
      if(!C.save(storage,pendingImport))throw Error('storage');
      progress=pendingImport;clearImport();
      $('stars').textContent='⭐ '+progress.stars;$('storage-note').hidden=true;
      $('backup-message').textContent='Progresso restaurado! Vamos brincar?';
    }catch{$('backup-message').textContent='Não foi possível salvar neste navegador. O progresso atual foi mantido.'}
  };
  $('stars').textContent='⭐ '+progress.stars;
})();
