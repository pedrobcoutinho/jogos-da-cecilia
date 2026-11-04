/* Shared speech transport. No silent priming, media elements or microphone access. */
(function(){
  'use strict';
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const standalone=()=>navigator.standalone===true||window.matchMedia?.('(display-mode: standalone)').matches===true;
  let voices=[],active=null,startedOnce=false,testTimer=null;
  const history=[];
  const element=id=>document.getElementById(id);
  function diagnostic(event,detail=''){
    history.push(new Date().toISOString().slice(11,23)+' | '+event+(detail?' | '+detail:''));
    if(history.length>25)history.shift();
    const output=element('audio-diagnostics');
    if(output)output.textContent='Áudio 2 · '+(standalone()?'PWA instalada':'aba do navegador')+
      '\n'+navigator.userAgent+'\nVozes pt-BR: '+voices.filter(v=>/^pt[-_]BR$/i.test(v.lang)).map(v=>v.name+(v.localService?' (local)':'')).join(', ')+
      '\n'+history.join('\n');
  }
  function readVoices(){
    try{voices=window.speechSynthesis?.getVoices?.()||[]}catch{voices=[]}
  }
  function notice(message){
    const output=element('audio-notice');
    if(output){output.textContent=message;output.hidden=!message}
  }
  function prepare(utterance){
    readVoices();
    utterance.lang='pt-BR';utterance.volume=1;
    // On iOS let the system resolve pt-BR; an explicit unavailable voice can fail.
    // Never substitute a pt-PT voice for Brazilian Portuguese.
    if(!isIOS){
      const brazilian=voices.filter(v=>/^pt[-_]BR$/i.test(v.lang));
      const voice=brazilian.find(v=>v.localService)||brazilian[0];
      if(voice)utterance.voice=voice;
    }
  }
  function fault(reason){
    startedOnce=false;
    diagnostic('falha',reason);
    notice('O som não iniciou. Toque em “Ouvir de novo” para tentar novamente. No início da brincadeira, use “Ativar som”.');
  }
  function finished(utterance){
    if(active!==utterance)return;
    active=null;
    utterance.onstart=utterance.onend=utterance.onerror=null;
  }
  function cancel(){
    const synth=window.speechSynthesis;
    const needsCancel=!!active||synth?.speaking||synth?.pending;
    if(active){finished(active);diagnostic('cancelado')}
    clearTimeout(testTimer);
    // cancel() even while idle can race the next speak() on older WebKit releases.
    if(needsCancel)synth?.cancel();
  }
  function play(utterance){
    const synth=window.speechSynthesis;
    if(!synth){fault('API indisponível');utterance.onerror?.({error:'synthesis-unavailable'});return}
    prepare(utterance);
    const onstart=utterance.onstart,onend=utterance.onend,onerror=utterance.onerror;
    active=utterance; // Keep a strong reference until completion or explicit cancellation.
    utterance.onstart=event=>{
      if(active!==utterance)return;
      startedOnce=true;notice('');diagnostic('iniciou');
      onstart?.(event);
    };
    utterance.onend=event=>{
      if(active!==utterance)return;
      startedOnce=true;notice(''); // A completed utterance also confirms the session if onstart was omitted.
      finished(utterance);diagnostic('terminou');onend?.(event);
    };
    utterance.onerror=event=>{
      if(active!==utterance)return;
      finished(utterance);fault(event?.error||'erro sem código');onerror?.(event);
    };
    diagnostic('solicitado','gesto='+String(navigator.userActivation?.isActive??'indisponível')+
      '; voz='+(utterance.voice?.name||'automática pt-BR'));
    try{
      if(synth.paused){synth.resume();diagnostic('retomado')}
      // Keep this synchronous: do not await voiceschanged or defer the first speak.
      synth.speak(utterance);
    }catch(error){utterance.onerror?.({error:error.name||'exceção'})}
  }
  function timeout(utterance){
    if(active===utterance)fault('sem retorno do sintetizador');
  }
  function testSound(){
    cancel();
    const output=element('audio-test-status');
    if(!window.SpeechSynthesisUtterance||!window.speechSynthesis){
      fault('API indisponível');if(output)output.textContent='Este navegador não oferece narração.';return;
    }
    if(output)output.textContent='Escute a mensagem…';
    const utterance=new window.SpeechSynthesisUtterance('Olá, Cecília! Vamos brincar!');
    utterance.rate=1.12;
    utterance.onend=()=>{
      clearTimeout(testTimer);
      if(output)output.textContent='Teste concluído. Se você ouviu, pode começar a brincadeira.';
    };
    utterance.onerror=()=>{
      clearTimeout(testTimer);
      if(output)output.textContent='O teste não iniciou. Toque em Ativar som para tentar de novo.';
    };
    testTimer=setTimeout(()=>{
      if(active!==utterance)return;
      timeout(utterance);cancel();
      if(output)output.textContent='O navegador não confirmou o áudio. Tente novamente e confira o volume do aparelho.';
    },8000);
    play(utterance);
  }
  window.CeciliaAudio={prepare,play,cancel,finished,timeout,testSound,requiresActivation:()=>isIOS&&!startedOnce};
  readVoices();diagnostic('pronto','sem fala automática');
  window.speechSynthesis?.addEventListener?.('voiceschanged',()=>{readVoices();diagnostic('vozes atualizadas')});
  const button=element('activate-sound');
  if(button)button.onclick=testSound;
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)cancel();
    else{readVoices();diagnostic('voltou à tela')}
  });
  window.addEventListener('pagehide',cancel);
})();
