const countriesAll=[
['Brasil','Brasília','br'],['Estados Unidos','Washington, D.C.','us'],['China','Pequim','cn'],['Índia','Nova Délhi','in'],['Rússia','Moscou','ru'],['Canadá','Ottawa','ca'],['Austrália','Canberra','au'],['Argentina','Buenos Aires','ar'],['México','Cidade do México','mx'],['Indonésia','Jacarta','id'],['Turquia','Ancara','tr'],['Arábia Saudita','Riad','sa'],['África do Sul','Pretória','za'],['Egito','Cairo','eg'],['Nigéria','Abuja','ng'],['Alemanha','Berlim','de'],['França','Paris','fr'],['Reino Unido','Londres','gb'],['Itália','Roma','it'],['Espanha','Madri','es'],['Ucrânia','Kiev','ua'],['Polônia','Varsóvia','pl'],['Romênia','Bucareste','ro'],['Países Baixos','Amsterdã','nl'],['Grécia','Atenas','gr'],['Portugal','Lisboa','pt'],['Suécia','Estocolmo','se'],['Noruega','Oslo','no'],['Finlândia','Helsinque','fi'],['Dinamarca','Copenhague','dk'],['Suíça','Berna','ch'],['Áustria','Viena','at'],['Bélgica','Bruxelas','be'],['Irlanda','Dublin','ie'],['República Tcheca','Praga','cz'],['Hungria','Budapeste','hu'],['Israel','Jerusalém','il'],['Emirados Árabes Unidos','Abu Dhabi','ae'],['Irã','Teerã','ir'],['Iraque','Bagdá','iq'],['Paquistão','Islamabad','pk'],['Bangladesh','Daca','bd'],['Japão','Tóquio','jp'],['Coreia do Sul','Seul','kr'],['Vietnã','Hanói','vn'],['Tailândia','Bangcoc','th'],['Filipinas','Manila','ph'],['Malásia','Kuala Lumpur','my'],['Singapura','Singapura','sg'],['Nova Zelândia','Wellington','nz'],['Chile','Santiago','cl'],['Colômbia','Bogotá','co'],['Peru','Lima','pe'],['Venezuela','Caracas','ve'],['Cuba','Havana','cu'],['Marrocos','Rabat','ma'],['Argélia','Argel','dz'],['Sudão','Cartum','sd'],['Etiópia','Adis Abeba','et'],['Quênia','Nairóbi','ke'],['Tanzânia','Dodoma','tz'],['Gana','Acra','gh'],['Angola','Luanda','ao'],['Moçambique','Maputo','mz'],['Camarões','Iaundé','cm'],['República Democrática do Congo','Kinshasa','cd'],['Cazaquistão','Astana','kz'],['Uzbequistão','Tashkent','uz'],['Afeganistão','Cabul','af'],['Mianmar','Naypyidaw','mm'],['Nepal','Catmandu','np'],['Sri Lanka','Sri Jayawardenepura Kotte','lk'],['Coreia do Norte','Pyongyang','kp']];
// Educational selection: familiar flags, ties to Brazil and continental variety.
const selectedCodes=new Set('br us ca ar mx cl co pe cu de fr gb it es pt nl be ch at ie gr se no fi dk pl ua ru cn in jp kr id th vn ph sg sa ae il tr pk za eg ma ng ke ao au nz'.split(' '));
const countryPool=countriesAll.filter(c=>selectedCodes.has(c[2]));
const countryPrepositions=Object.fromEntries([
  ['do','br ca mx eg gb ir iq pk bd jp vn cl pe sd ke kz uz af np lk'],
  ['da','cn in ru au ar id tr sa za ng de fr it es ua pl ro gr se no fi dk ch at be ie cz hu kr th my nz co ve dz et tz cd kp'],
  ['dos','us nl ae cm'],
  ['das','ph'],
  ['de','pt il sg cu ma gh ao mz mm']
].flatMap(([preposition,codes])=>codes.split(' ').map(code=>[code,preposition])));
function countryWithPreposition(country=current()){
  return `${countryPrepositions[country[2]]||'de'} ${country[0]}`;
}
let clarificationAttempts=0;
let countries=[], index=0, stage='country', score=0, mode='voice', capitals=false;
let phase='setup', recognition=null, utterance=null, revision=0;
let timer=null, answerTimer=null, retryTimer=null, readyTimer=null;
let speechTimer=null;
let listeningTimer=null, listeningRetries=0;
let heard='', failures=0;
let speechActive=false, transcriptFinal=false, lastVoiceUpdate=0;
function scheduleAnswer(delay){
  clearTimeout(answerTimer);
  if(phase!=='waiting'||!heard)return;
  const version=revision;
  answerTimer=setTimeout(()=>{
    if(version!==revision||phase!=='waiting'||!heard)return;
    // Give a child who resumed speaking time to finish. A missing browser
    // speech-end event must still have a bounded fallback.
    if(speechActive&&!transcriptFinal&&Date.now()-lastVoiceUpdate<4000){
      scheduleAnswer(600);return;
    }
    answer(heard);
  },delay);
}
const voiceEvents=[];
let voiceReady=false;
const $=id=>document.getElementById(id);
function traceVoice(event,detail=''){
  // Diagnostics contain event metadata only: no recordings or transcripts.
  voiceEvents.push({time:Date.now(),event,phase,country:current()?.[2],stage,detail});
  if(voiceEvents.length>40)voiceEvents.shift();
  $('voice-diagnostics').textContent=voiceEvents.map(e=>
    `${e.time} | ${e.event} | ${e.phase} | ${e.country||'-'}/${e.stage} ${e.detail}`
  ).join('\n');
}
function cue(state,icon,text){
  $('turn-cue').className='turn-cue '+state;
  $('turn-icon').textContent=icon;
  $('turn-label').textContent=text;
}
function waitingCue(){
  if(mode==='buttons')cue('listening','👆','Sua vez de tocar!');
  else if(voiceReady)cue('listening','🎙️','Pode falar!');
  else cue('speaking','⏳','Só um instante…');
}
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
const clean=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const answerAliases={
  'Washington, D.C.':['Washington','Washington DC'],
  'Nova Délhi':['Nova Delhi','Nova Deli'],
  'Cabul':['Kabul']
};
function answerNames(name){return [name,...(answerAliases[name]||[])].map(clean)}
function editDistance(a,b){
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const next=[i];
    for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));
    row=next;
  }
  return row[b.length];
}
function soundKey(word){
  return word.replace(/ph/g,'f').replace(/lh/g,'li').replace(/nh/g,'ni')
    .replace(/qu/g,'k').replace(/c(?=[ei])/g,'s').replace(/c(?=[aou])/g,'k')
    .replace(/z/g,'s').replace(/(.)\1+/g,'$1');
}
function similarAnswer(value,target){
  const length=Math.max(value.length,target.length);
  // Short names need stricter matching; whole answers only, never substrings.
  if(Math.min(value.length,target.length)<3)return false;
  if(length<=3)return value===target;
  const limit=length<=5?1:Math.min(3,Math.floor(length*(stage==='capital'?.3:.25)));
  return editDistance(value,target)<=limit||
    (Math.abs(value.length-target.length)<=limit&&soundKey(value)===soundKey(target));
}
function shuffle(items){
  const result=[...items];
  for(let i=result.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}
function clearRound(){
  revision++;
  clearTimeout(timer);
  clearTimeout(answerTimer);
  clearTimeout(speechTimer);
  clearTimeout(listeningTimer);
  heard='';
  speechActive=false;transcriptFinal=false;
  if(utterance){utterance.onend=utterance.onerror=null;utterance=null}
  if(window.CeciliaAudio)window.CeciliaAudio.cancel();
  else window.speechSynthesis?.cancel();
}
function stopVoice(){
  voiceReady=false;
  clearTimeout(retryTimer);
  clearTimeout(readyTimer);
  clearTimeout(listeningTimer);
  if(recognition){
    const old=recognition;
    recognition=null;
    old.onstart=old.onresult=old.onerror=old.onend=null;
    old.onaudiostart=old.onaudioend=old.onsoundstart=old.onsoundend=old.onspeechstart=old.onspeechend=old.onnomatch=null;
    old.abort();
  }
}
function setup(message=''){
  clearRound();
  stopVoice();
  phase='setup';
  $('setup').hidden=false;
  $('play').hidden=true;
  $('setup-message').textContent=message;
  $('start').disabled=false;
  $('start').textContent='▶ Começar a brincar';
  $('cancel-start').hidden=true;
}
function speak(text,done){
  stopVoice();
  const version=revision;
  if(!window.speechSynthesis){done();return}
  const speech=new SpeechSynthesisUtterance(text);
  utterance=speech;
  speech.lang='pt-BR';speech.rate=1.18;speech.pitch=1.08;
  const requestedAt=Date.now();
  let started=false;
  const finish=()=>{
    if(version!==revision||utterance!==speech)return;
    traceVoice('narracao-concluida');
    clearTimeout(speechTimer);
    window.CeciliaAudio?.finished(speech);
    speech.onstart=speech.onend=speech.onerror=null;
    utterance=null;done();
  };
  // Some browser/voice combinations omit the completion event or never start.
  // Keep waiting for real speech; only recover a stalled synthesis service.
  const watch=()=>{
    if(version!==revision||utterance!==speech)return;
    const elapsed=Date.now()-requestedAt;
    if((!window.speechSynthesis.speaking&&(started||elapsed>=8000))||elapsed>=Math.max(30000,text.length*180+10000)){
      speech.onstart=speech.onend=speech.onerror=null;
      if(!started||window.speechSynthesis.speaking)window.CeciliaAudio?.timeout(speech);
      if(window.CeciliaAudio)window.CeciliaAudio.cancel();else window.speechSynthesis.cancel();
      finish();
      return;
    }
    speechTimer=setTimeout(watch,1000);
  };
  speech.onstart=()=>{started=true};
  speech.onend=finish;
  speech.onerror=finish;
  speechTimer=setTimeout(watch,1000);
  try{if(window.CeciliaAudio)window.CeciliaAudio.play(speech);else window.speechSynthesis.speak(speech)}catch{finish()}
}
function current(){return countries[index]}
function render(){
  const [name,capital,flag]=current();
  $('flag').src=`assets/flags/${flag}.svg`;
  $('progress').textContent=`Bandeira ${index+1} de ${countries.length} · ⭐ ${score}`;
  $('question').textContent=stage==='country'?'Qual é o país dessa bandeira?':`Qual é a capital ${countryWithPreposition()}?`;
  $('feedback').className='feedback';
  const column=stage==='country'?0:1;
  const correct=current()[column];
  const others=shuffle(countryPool.map(c=>c[column]).filter(x=>x!==correct)).slice(0,2);
  const options=shuffle([correct,...others]);
  $('answers').innerHTML=options.map((x,i)=>`<button data-answer="${x}" data-number="${i+1}"><span class="number">${i+1}</span> ${x}</button>`).join('');
  document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>answer(b.dataset.answer));
  $('answers').hidden=mode==='voice';
}
function ask(intro=''){
  if(['feedback','paused','setup','starting'].includes(phase))return;
  clearRound();
  listeningRetries=0;
  phase='speaking';
  cue('speaking','👂','Agora escute…');
  $('feedback').className='feedback';
  $('feedback').textContent='🔊 Escute…';
  $('repeat').disabled=false;
  document.querySelectorAll('[data-answer]').forEach(b=>b.disabled=true);
  let question=intro+ $('question').textContent;
  if(mode==='buttons'){
    question+=' '+Array.from(document.querySelectorAll('[data-answer]'),b=>`Botão ${b.dataset.number}: ${b.dataset.answer}.`).join(' ');
  }
  speak(question,()=>{
    const version=revision;
    // Let loudspeaker audio finish before accepting new recognition segments.
    timer=setTimeout(()=>{
      if(version!==revision)return;
      heard='';
      phase='waiting';
      if(mode==='voice')connectVoice();
      traceVoice('vez-de-responder');
      waitingCue();
      $('feedback').textContent=mode==='voice'?(voiceReady?'🎙️ Sua vez! Pode falar com calma.':'Preparando o microfone…'):'👆 Sua vez! Toque na resposta.';
      $('repeat').disabled=false;
      document.querySelectorAll('[data-answer]').forEach(b=>b.disabled=false);
    },250);
  });
}
function interpretAnswer(value){
  const words=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  const normalized=clean(words.replace(/^(eu acho que e|acho que e|a resposta e|o pais e|a capital e|e o pais|e|o|a)\s+/,''));
  const correct=current()[stage==='country'?0:1];
  const targets=answerNames(correct);
  if(targets.includes(normalized))return 'correct';
  if(/\b(nao entendi|nao ouvi|repete|repetir|repita|fala de novo|fale de novo|pode repetir)\b/.test(words))return 'repeat';
  if(/\b(nao sei|nao conheco|nao lembro|nao me lembro|esqueci|me ajuda|ajuda|qual e a resposta|me conta|desisto|nao faco ideia|sei la)\b/.test(words))return 'help';
  // A clearly named different country/capital must not become a fuzzy match.
  if(countriesAll.some(c=>[c[0],c[1]].some(x=>answerNames(x).includes(normalized))))return 'incorrect';
  if(targets.some(target=>similarAnswer(normalized,target)))return 'correct';
  return 'unclear';
}
function answer(value){
  if(phase!=='waiting')return;
  let intent=interpretAnswer(value);
  if(intent==='repeat'||(intent==='unclear'&&clarificationAttempts===0)){
    if(intent==='unclear')clarificationAttempts++;
    traceVoice('pedindo-esclarecimento',intent);
    ask(intent==='repeat'?'Claro! Vou repetir. ':'Não entendi sua resposta. Se não souber, pode dizer: não sei. ');
    return;
  }
  if(intent==='unclear')intent='help';
  clearRound();
  phase='feedback';
  $('repeat').disabled=true;
  document.querySelectorAll('[data-answer]').forEach(b=>b.disabled=true);
  const correct=current()[stage==='country'?0:1];
  traceVoice('avaliando-resposta',intent);
  const right=intent==='correct', helping=intent==='help';
  if(right)score++;
  const explanation=stage==='country'?`Essa é a bandeira ${countryWithPreposition()}.`:`A capital ${countryWithPreposition()} é ${correct}.`;
  cue(right?'correct':helping?'speaking':'incorrect',right?'🌟':'💛',right?'Parabéns! Você acertou!':helping?'Vamos aprender juntos!':'Não foi dessa vez!');
  const message=right?`Parabéns! Você acertou! ${explanation}`:helping?`Tudo bem não saber! ${explanation} Agora você já sabe!`:`Não, não era essa. ${explanation}`;
  $('feedback').textContent=(right?'⭐ ':'💛 ')+message;
  $('feedback').className='feedback '+(right?'good':helping?'':'bad');
  $('progress').textContent=`Bandeira ${index+1} de ${countries.length} · ⭐ ${score}`;
  speak(message,()=>{
    const version=revision;
    timer=setTimeout(()=>{if(version===revision)next()},400);
  });
}
function next(){
  clarificationAttempts=0;
  if(stage==='country'&&capitals)stage='capital';
  else{
    stage='country';index++;
    if(index===countries.length){
      countries=shuffle(countryPool);index=0;
    }
  }
  phase='ready';render();ask();
}
function beginRound(){
  clearTimeout(readyTimer);
  $('setup').hidden=true;
  $('play').hidden=false;
  $('pause').textContent='⏸ Pausar';
  phase='ready';render();ask();
}
function start(){
  if(phase!=='setup')return;
  mode=document.querySelector('input[name="mode"]:checked').value;
  if(mode==='voice'&&(window.location.protocol==='file:'||!window.isSecureContext)){
    $('setup-message').textContent='Para brincar falando, feche esta aba e abra o arquivo Iniciar jogo.cmd na pasta do jogo. Ele prepara o endereço que guarda a permissão do microfone.';
    return;
  }
  if(mode==='voice'&&!Recognition){
    $('setup-message').textContent='Abra no Google Chrome para brincar falando, ou escolha os botões.';
    return;
  }
  if(mode==='voice'&&window.CeciliaAudio?.requiresActivation()){
    $('setup-message').textContent='No iPhone, toque primeiro em “Ativar som”. Depois, toque em Começar a brincar.';
    $('activate-sound').focus();
    return;
  }
  clearRound();stopVoice();
  const previous=countries[0]?.[2];
  countries=shuffle(countryPool);
  // A new game should visibly start with a different flag too.
  if(countries[0][2]===previous)[countries[0],countries[1]]=[countries[1],countries[0]];
  index=0;stage='country';score=0;failures=0;clarificationAttempts=0;
  capitals=$('capitals').checked;
  phase='starting';
  $('start').disabled=true;
  $('start').textContent='Preparando…';
  $('cancel-start').hidden=false;
  $('setup-message').textContent=mode==='voice'?'Permita o microfone no Chrome. Escolha permitir durante as visitas, em vez de somente desta vez.':'';
  if(mode==='voice')connectVoice(true);
  else beginRound();
}
function connectVoice(initial=false){
  if(recognition||mode!=='voice'||!['starting','waiting'].includes(phase))return;
  const r=new Recognition();
  recognition=r;
  r.lang='pt-BR';r.continuous=true;r.interimResults=true;
  const active=()=>recognition===r;
  let startedAt=Date.now();
  r.onaudiostart=()=>{if(active())traceVoice('captura-audio-iniciada')};
  r.onaudioend=()=>{if(active())traceVoice('captura-audio-encerrada')};
  r.onsoundstart=()=>{if(active())traceVoice('som-detectado')};
  r.onsoundend=()=>{if(active())traceVoice('som-encerrado')};
  r.onspeechstart=()=>{
    if(!active())return;
    traceVoice('fala-detectada');
    if(phase==='waiting'){
      speechActive=true;transcriptFinal=false;lastVoiceUpdate=Date.now();
      scheduleAnswer(1800);
      $('feedback').textContent='Pode falar. Estou ouvindo!';
    }
  };
  r.onspeechend=()=>{
    if(!active())return;
    traceVoice('fala-encerrada');
    speechActive=false;
    if(phase==='waiting'){
      if(heard)scheduleAnswer(transcriptFinal?250:600);
      else watchListening(6000);
    }
  };
  r.onnomatch=()=>{
    if(!active())return;
    traceVoice('fala-sem-transcricao');
    if(phase==='waiting'&&!heard)watchListening(1500);
  };
  r.onstart=()=>{
    if(!active())return;
    clearTimeout(readyTimer);
    voiceReady=true;
    traceVoice('microfone-pronto');
    if(phase==='waiting'){
      waitingCue();watchListening();
      $('feedback').textContent='🎙️ Sua vez! Pode falar com calma.';
    }
    startedAt=Date.now();
    if(initial)beginRound();
  };
  r.onresult=e=>{
    if(!active())return;
    failures=0;
    traceVoice('resultado',`quantidade=${e.results.length}; alterado=${e.resultIndex??0}`);
    if(phase!=='waiting')return;
    // Every question has a fresh recognition session, with no narrator history.
    const transcript=Array.from(e.results).map(x=>x[0].transcript).join(' ').trim();
    const finalResult=e.results.length>0&&Array.from(e.results).every(x=>x.isFinal===true);
    if(!transcript)return;
    if(clean(transcript)===clean(heard)&&finalResult===transcriptFinal)return;
    transcriptFinal=finalResult;
    lastVoiceUpdate=Date.now();
    heard=transcript;
    clearTimeout(listeningTimer);
    traceVoice('resposta-capturada');
    $('feedback').textContent='Ouvi você! Só um instante…';
    cue('listening','🎙️','Estou ouvindo!');
    // A final transcript can arrive with identical text to its interim result.
    // Process that event too, so it accelerates evaluation.
    scheduleAnswer(transcriptFinal?250:1800);
  };
  r.onerror=e=>{
    if(!active())return;
    traceVoice('erro-microfone',e.error);
    if(e.error==='no-speech')return;
    const message=['not-allowed','service-not-allowed'].includes(e.error)
      ?'O microfone não foi autorizado. Um adulto precisa permitir o microfone nas configurações deste site no Chrome antes de começar.'
      :e.error==='audio-capture'?'Não encontrei o microfone. Confira se está conectado antes de começar.'
      :'A conexão de voz parou. Confira a internet e tente começar novamente, ou escolha brincar com os botões.';
    setup(message);
  };
  r.onend=()=>{
    if(!active())return;
    traceVoice('microfone-encerrado');
    recognition=null;
    clearTimeout(readyTimer);
    voiceReady=false;
    speechActive=false;
    if(phase==='waiting'&&heard){scheduleAnswer(250);return}
    if(phase==='waiting')waitingCue();
    if(phase==='starting'){setup('Não consegui preparar a voz. Confira o microfone e tente começar novamente.');return}
    if(['setup','paused'].includes(phase))return;
    failures=Date.now()-startedAt<3000?failures+1:0;
    if(failures>=3){setup('A voz não ficou disponível. Confira o microfone e a internet antes de tentar novamente.');return}
    // Browsers can end a session on silence; do not restart it every turn.
    retryTimer=setTimeout(()=>connectVoice(),1000);
  };
  readyTimer=setTimeout(()=>{
    if(active())setup('A preparação da voz demorou. Confira a permissão do microfone e tente novamente.');
  },initial?30000:8000);
  try{r.start()}catch{setup('Não consegui iniciar a voz. Confira o microfone e tente novamente.')}
}
function watchListening(delay=20000){
  clearTimeout(listeningTimer);
  if(mode!=='voice'||phase!=='waiting'||heard)return;
  const version=revision;
  listeningTimer=setTimeout(()=>{
    if(version!==revision||phase!=='waiting'||heard)return;
    traceVoice('sem-resposta-do-reconhecimento');
    if(listeningRetries>=1){
      setup('Não recebi uma resposta do serviço de voz. Confira se o Chrome está usando o microfone correto e copie o registro em Ajuda para o adulto para investigar. Nenhuma resposta foi marcada como errada.');
      return;
    }
    listeningRetries++;
    stopVoice();
    waitingCue();
    $('feedback').textContent='Não consegui entender. Vou preparar o microfone de novo…';
    // Keep the same flag and score. Restart only once, not an endless loop.
    retryTimer=setTimeout(()=>{
      if(version===revision&&phase==='waiting')connectVoice();
    },500);
  },delay);
}
function pause(){
  if(phase==='paused'){
    phase='ready';
    $('pause').textContent='⏸ Pausar';
    if(mode==='voice'){
      phase='starting';
      cue('speaking','⏳','Só um instante…');
      connectVoice(true);
    }else ask();
    return;
  }
  clearRound();stopVoice();phase='paused';
  cue('paused','⏸️','Pausa para descansar');
  $('pause').textContent='▶ Continuar';
  $('repeat').disabled=true;
  document.querySelectorAll('[data-answer]').forEach(b=>b.disabled=true);
  $('feedback').textContent='Pausa para descansar 💛';
}
$('start').onclick=start;
$('cancel-start').onclick=()=>setup();
$('pause').onclick=pause;
$('repeat').onclick=()=>ask();
$('new-game').onclick=()=>setup();
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&!['setup','paused'].includes(phase)){
    if(phase==='starting')setup();else pause();
  }
});
window.addEventListener('pagehide',()=>setup());
setup();
