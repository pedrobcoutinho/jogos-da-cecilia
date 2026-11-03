/* iOS gesture initialization and local Portuguese voice preference. */
(function(){
  'use strict';
  let unlocked=false,prime=null;
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  function prepare(utterance){
    const voices=window.speechSynthesis?.getVoices?.()||[];
    const portuguese=voices.filter(v=>/^pt(?:-|_)/i.test(v.lang));
    const voice=portuguese.find(v=>/^pt[-_]BR$/i.test(v.lang)&&v.localService)||
      portuguese.find(v=>/^pt[-_]BR$/i.test(v.lang))||portuguese.find(v=>v.localService)||portuguese[0];
    if(voice)utterance.voice=voice;
    utterance.lang='pt-BR';
  }
  function unlock(){
    if(!isIOS||unlocked||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
    // speak() must run inside the real touch/click, before permission callbacks.
    prime=new SpeechSynthesisUtterance('Vamos brincar.');
    prepare(prime);prime.volume=0;
    prime.onend=prime.onerror=()=>{prime=null};
    try{window.speechSynthesis.speak(prime);unlocked=true}catch{prime=null}
  }
  document.addEventListener('click',event=>{
    if(event.isTrusted&&event.target.closest('button,input,select'))unlock();
  },true);
  window.CeciliaAudio={prepare,unlock};
})();
