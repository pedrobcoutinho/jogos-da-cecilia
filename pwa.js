(function(){
  'use strict';
  const script=document.currentScript;
  const root=new URL('./',script.src);
  const output=document.getElementById('pwa-status');
  const status=text=>{if(output)output.textContent=text};
  if(!('serviceWorker' in navigator)||!window.isSecureContext||location.protocol==='file:'){
    status('Para instalar e usar offline, abra pelo endereço HTTPS publicado ou pelo atalho no computador.');
    return;
  }
  let registration,lastCheck=0;
  function show(){
    if(!registration)return;
    if(registration.waiting){
      status('Atualização pronta. Ela será aplicada ao fechar todas as janelas do jogo e abrir novamente.');
    }else if(registration.active){
      status(navigator.onLine?'Pronto para brincar offline por toque. A voz depende do aparelho.':'Você está offline. Os jogos por toque estão disponíveis; a voz pode precisar de internet.');
    }else status('Preparando os dois jogos para brincar offline…');
  }
  function watch(worker){
    if(!worker)return;
    worker.addEventListener('statechange',()=>{
      if(worker.state==='redundant'&&!registration.waiting){
        status('Não foi possível preparar a nova versão offline. A versão anterior foi mantida. Tente novamente com internet.');
      }else show();
    });
  }
  async function check(){
    show();
    if(!registration||!navigator.onLine||Date.now()-lastCheck<60000)return;
    lastCheck=Date.now();
    try{await registration.update();show()}catch{
      if(!registration.active)status('Não foi possível baixar os jogos offline. Abra novamente com internet.');
    }
  }
  navigator.serviceWorker.register(new URL('sw.js',root),{scope:root.href,updateViaCache:'none'}).then(reg=>{
    registration=reg;watch(reg.installing);
    reg.addEventListener('updatefound',()=>{watch(reg.installing);show()});
    show();check();
    navigator.serviceWorker.ready.then(show);
  }).catch(()=>status('A instalação offline não está disponível neste navegador. Os jogos continuam funcionando online.'));
  window.addEventListener('online',check);
  window.addEventListener('offline',show);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
})();
