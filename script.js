// Fatto da GPT per Salvatore Incremona. Nessuna libreria esterna richiesta.
// I confronti sono coppie automatiche. La clip centrale dello showreel parte muta e in loop.
const videos = [...document.querySelectorAll('video')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused = reducedMotion.matches;
const visibleVideos = new Set();
const userPaused = new WeakSet();
const internalPauses = new WeakSet();
const toggleMotion = document.querySelector('.motion-toggle');
const comparisons = [...document.querySelectorAll('.case')].map(element => ({element, videos:[...element.querySelectorAll('video')], running:false, starting:false}));
function pauseVideo(video) {
  if (!video.paused) { internalPauses.add(video); video.pause(); }
}
function eligible(video) {
  if (document.hidden || video.inert) return false;
  const comparison = comparisons.find(group => group.videos.includes(video));
  return comparison ? comparison.videos.some(v => visibleVideos.has(v)) : visibleVideos.has(video);
}
function stopComparison(group) {
  group.running = false;
  group.videos.forEach(pauseVideo);
}
function startComparison(group, restart = false) {
  if (group.starting || !eligible(group.videos[0]) || motionPaused) return;
  if (group.running && !restart) return;
  group.starting = true;
  group.running = true;
  group.videos.forEach(video => { try { video.currentTime = 0; } catch {} });
  Promise.all(group.videos.map(video => video.play())).then(() => {
    group.starting = false;
    group.element.classList.remove('needs-start');
    if (!eligible(group.videos[0]) || motionPaused) stopComparison(group);
  }).catch(() => {
    group.starting = false;
    stopComparison(group);
    group.element.classList.add('needs-start');
  });
}
function refreshPlayback() {
  comparisons.forEach(group => {
    if (eligible(group.videos[0]) && !motionPaused) startComparison(group);
    else stopComparison(group);
  });
  videos.filter(v => v.closest('.reel')).forEach(video => {
    if (eligible(video) && !motionPaused) { if(video.paused) video.play().catch(()=>{}); }
    else pauseVideo(video);
  });
}
comparisons.forEach(group => {
  const fallback = document.createElement('button');
  fallback.type='button'; fallback.className='comparison-start'; fallback.textContent='Avvia confronto';
  group.element.querySelector('.case-info').append(fallback);
  fallback.addEventListener('click', () => {
    group.element.classList.remove('needs-start');
    motionPaused=false; updateMotionButton();
    startComparison(group, true);
  });
  group.videos.forEach(video => {
    video.muted = true; video.defaultMuted = true; video.loop = false;
    video.removeAttribute('loop'); video.removeAttribute('controls');
    video.addEventListener('ended', () => startComparison(group, true));
    video.addEventListener('timeupdate', () => {
      if (!group.running || video.paused) return;
      const master=group.videos.reduce((a,b) => (a.duration||Infinity)<=(b.duration||Infinity)?a:b);
      if (video !== master) return;
      group.videos.forEach(other => {
        if(other!==master && other.readyState>=2 && Math.abs(other.currentTime-master.currentTime)>.14) other.currentTime=master.currentTime;
      });
    });
  });
});
videos.forEach(video => {
  if (video.closest('.reel')) {
    video.muted=true; video.defaultMuted=true; video.loop=true;
    video.setAttribute('muted',''); video.setAttribute('loop',''); video.removeAttribute('controls');
  }
  video.addEventListener('play', () => {
    userPaused.delete(video);
    if (video.closest('.reel')) videos.filter(other=>other.closest('.reel')).forEach(other => { if(other!==video) pauseVideo(other); });
  });
  const fail = () => {
    if (video.parentElement.querySelector('.video-error')) return;
    const note=document.createElement('p'); note.className='small video-error';
    note.textContent='Video non disponibile. Riprova o contattami per ricevere il file.';
    video.after(note);
  };
  video.addEventListener('error',fail); video.querySelector('source')?.addEventListener('error',fail);
});
const videoObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting && entry.intersectionRatio>=.25) visibleVideos.add(entry.target);
    else visibleVideos.delete(entry.target);
  });
  refreshPlayback();
},{threshold:[0,.25,.5]});
videos.forEach(video => videoObserver.observe(video));
document.addEventListener('visibilitychange',refreshPlayback);
function updateMotionButton() {
  document.documentElement.classList.toggle('motion-paused',motionPaused);
  toggleMotion.setAttribute('aria-pressed',String(motionPaused));
  toggleMotion.textContent=motionPaused?'Attiva movimento':'Pausa movimento';
}
toggleMotion.addEventListener('click',()=>{
  motionPaused=!motionPaused;
  document.documentElement.classList.toggle('motion-override',!motionPaused);
  if(motionPaused) { comparisons.forEach(stopComparison); videos.forEach(pauseVideo); }
  updateMotionButton(); refreshPlayback();
});
reducedMotion.addEventListener('change',()=>{
  motionPaused=reducedMotion.matches;
  document.documentElement.classList.remove('motion-override');
  if(motionPaused) { comparisons.forEach(stopComparison); videos.forEach(pauseVideo); }
  updateMotionButton(); refreshPlayback();
});
updateMotionButton();
document.documentElement.classList.add('js');
const rail=document.querySelector('.reel-rail');
const clips=[...rail.querySelectorAll('.reel')];
let selected=0;
clips.forEach((clip,index)=>{
  const button=document.createElement('button');
  button.type='button';button.className='clip-select';
  button.setAttribute('aria-label','Seleziona clip: '+clip.querySelector('h3').textContent);
  button.addEventListener('click',()=>selectClip(index)); clip.append(button);

});
function selectClip(index){
  selected=(index+clips.length)%clips.length;
  clips.forEach((clip,i)=>{
    let offset=(i-selected+clips.length)%clips.length;if(offset>clips.length/2)offset-=clips.length;
    const depth=Math.abs(offset);
    clip.style.setProperty('--offset',offset);clip.style.setProperty('--depth',depth);
    clip.style.setProperty('--scale',depth?.86:1);clip.style.setProperty('--opacity',depth>2?0:depth?.4:1);
    clip.style.setProperty('--z',10-depth);clip.style.setProperty('--visibility',depth>2?'hidden':'visible');
    clip.classList.toggle('active',i===selected);
    const video=clip.querySelector('video'); video.inert=i!==selected;
    if(i!==selected)pauseVideo(video);
    clip.querySelector('.clip-select').tabIndex=depth>2||!depth?-1:0;
  });
  document.querySelector('.reel-status').textContent=`Clip ${selected+1} di ${clips.length}`;
  refreshPlayback();
}
document.querySelectorAll('[data-scroll]').forEach(button=>button.addEventListener('click',()=>selectClip(selected+Number(button.dataset.scroll))));
rail.addEventListener('keydown',event=>{if(event.target!==rail)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();selectClip(selected+(event.key==='ArrowRight'?1:-1));}});
selectClip(0);

// Contatori una sola volta, al primo ingresso nella finestra.
const numberFormat = new Intl.NumberFormat('it-IT');
const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const node = entry.target;
    counterObserver.unobserve(node);
    const end = Number(node.dataset.count);
    node.setAttribute('aria-label', numberFormat.format(end));
    if (motionPaused) { node.textContent = numberFormat.format(end); return; }
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / 1600, 1);
      node.textContent = numberFormat.format(Math.round(end * (1 - Math.pow(1-progress,3))));
      if (progress < 1 && !motionPaused) requestAnimationFrame(tick);
      else node.textContent = numberFormat.format(end);
    }
    requestAnimationFrame(tick);
  });
}, {threshold:.35});
document.querySelectorAll('[data-count]').forEach(node => counterObserver.observe(node));
const ambientObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => entry.target.classList.toggle('in-view', entry.isIntersecting));
}, {threshold:.08});
document.querySelectorAll('.contact,.motion-stage').forEach(node => ambientObserver.observe(node));
// Sul telefono è possibile scegliere quale versione guardare in grande.
document.querySelectorAll('.compare-switch').forEach(button => {
  button.addEventListener('click', () => {
    const enlarged = button.closest('.case').classList.toggle('show-raw');
    button.setAttribute('aria-pressed', String(enlarged));
    button.textContent = enlarged ? 'Torna al montaggio' : 'Ingrandisci il girato';
  });
});
videos.forEach(video => video.addEventListener('playing', () => {
  if (!video.closest('.reel') && !eligible(video)) pauseVideo(video);
}));
// Navigazione e scelta del percorso sono progettate per il telefono.
const mobileMenu = document.querySelector('.menu-toggle');
const header = document.querySelector('header');
mobileMenu.addEventListener('click', () => {
  const opened = header.classList.toggle('menu-open');
  mobileMenu.setAttribute('aria-expanded', String(opened));
});
document.querySelectorAll('header nav a').forEach(link => link.addEventListener('click', () => {
  header.classList.remove('menu-open');
  mobileMenu.setAttribute('aria-expanded', 'false');
}));
function setAudience(id) {
  document.querySelectorAll('.audience-grid article').forEach(panel => panel.classList.toggle('audience-active', panel.id === id));
  document.querySelectorAll('[data-audience]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.audience === id)));
}
document.querySelectorAll('[data-audience]').forEach(button => button.addEventListener('click', () => {
  setAudience(button.dataset.audience);
  history.replaceState(null, '', '#' + button.dataset.audience);
}));
document.querySelectorAll('a[href="#agenzie"], a[href="#sanitari"]').forEach(link => link.addEventListener('click', () => setAudience(link.getAttribute('href').slice(1))));
function syncAudienceToHash() {
  if (location.hash === '#sanitari' || location.hash === '#agenzie') setAudience(location.hash.slice(1));
}
addEventListener('hashchange', syncAudienceToHash);
syncAudienceToHash();

// La lettura diventa una timeline: i tagli seguono le sezioni del portfolio.
const sceneMarkers = [...document.querySelectorAll('[data-scene]')];
let timelineQueued = false;
function updateReadingTimeline() {
  timelineQueued = false;
  const cursor = scrollY + innerHeight * .65;
  sceneMarkers.forEach(marker => {
    const scene = document.getElementById(marker.dataset.scene);
    const box = scene.getBoundingClientRect();
    const start = scrollY + box.top;
    const progress = Math.min(Math.max((cursor - start) / Math.max(box.height, 1), 0), 1);
    marker.style.setProperty('--fill', `${(progress * 100).toFixed(1)}%`);
  });
}
function queueTimeline() {
  if (!timelineQueued) { timelineQueued = true; requestAnimationFrame(updateReadingTimeline); }
}
addEventListener('scroll', queueTimeline, {passive:true});
addEventListener('resize', queueTimeline);
updateReadingTimeline();
// Solo con un puntatore preciso: un leggero cambio di profondità nella motion.
const motionStage = document.querySelector('.motion-stage');
motionStage.addEventListener('pointermove', event => {
  if (motionPaused || !matchMedia('(pointer:fine)').matches) return;
  const box = motionStage.getBoundingClientRect();
  motionStage.style.setProperty('--pointer-x', `${((event.clientX-box.left)/box.width-.5)*10}px`);
  motionStage.style.setProperty('--pointer-y', `${((event.clientY-box.top)/box.height-.5)*10}px`);
});
motionStage.addEventListener('pointerleave', () => {
  motionStage.style.setProperty('--pointer-x','0px');
  motionStage.style.setProperty('--pointer-y','0px');
});
// Il titolo della chiusura si svela parola per parola, come nel riferimento.
const finalTitle = document.querySelector('[data-final-words]');
let finalWordIndex = 0;
function wrapFinalWords(node) {
  [...node.childNodes].forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      const fragment = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) fragment.append(document.createTextNode(part));
        else {
          const word = document.createElement('span');
          word.className = 'final-word';
          word.style.setProperty('--word-delay', `${finalWordIndex++ * 110}ms`);
          word.textContent = part;
          fragment.append(word);
        }
      });
      child.replaceWith(fragment);
    } else if (child.nodeType === Node.ELEMENT_NODE) wrapFinalWords(child);
  });
}
wrapFinalWords(finalTitle);
const finalRevealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('has-revealed');
    finalRevealObserver.unobserve(entry.target);
  });
}, {rootMargin:'-20% 0px -20% 0px', threshold:0});
finalRevealObserver.observe(document.querySelector('.contact'));

// Hero: i tasselli orbitano come elettroni, poi uno alla volta cadono su una timeline stile Premiere (V1/A1), vengono tagliati col rasoio e montati in sequenza; il cursore blu legge la sequenza.
(()=>{
  const stage=document.querySelector('.motion-stage'); if(!stage) return;
  const svg=stage.querySelector('.motion-orbits'); const cards=[...stage.querySelectorAll('.m-clips i')];
  const N=cards.length, HD=34, RU=18;
  cards.forEach((c,i)=>{const n=document.createElement('span');n.className='m-name';n.textContent=`clip_0${i+1}.mp4`;c.append(n);const fx=document.createElement('span');fx.className='m-fx';fx.textContent='fx';c.append(fx)});
  const tl=document.createElement('div'); tl.className='m-tl';
  tl.innerHTML='<div class="m-ru"></div><div class="m-hd"><span>V1</span><span>A1</span></div><div class="m-a1"></div><span class="m-tc">00;00;00;00</span><b class="m-ph"></b>';
  stage.append(tl);
  const ru=tl.querySelector('.m-ru'), a1=tl.querySelector('.m-a1'), tc=tl.querySelector('.m-tc'), ph=tl.querySelector('.m-ph');
  ru.innerHTML=Array.from({length:N+1},(_,i)=>`<em style="--i:${i}">00;00;0${i*2};00</em>`).join('');
  const auds=cards.map(()=>{const d=document.createElement('i');a1.append(d);return d});
  const ORB=[{cx:300,cy:325,rx:235,ry:100,a:-40},{cx:300,cy:325,rx:270,ry:125,a:50}];
  const LOOP=12500, F0=4400, STEP=430, DUR=800, P0=F0+STEP*N+450, P1=P0+2000, B0=11300;
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2, cl=v=>Math.min(1,Math.max(0,v));
  let t0=0,last=0,started=false;
  function frame(now){
    requestAnimationFrame(frame);
    const paused=document.documentElement.classList.contains('motion-paused')||!stage.classList.contains('in-view');
    if(paused&&started){t0+=now-last;last=now;return}
    last=now;started=true;
    const sr=stage.getBoundingClientRect(), vr=svg.getBoundingClientRect();
    const sc=Math.min(vr.width/600,vr.height/650), ox=vr.left-sr.left+(vr.width-600*sc)/2, oy=vr.top-sr.top+(vr.height-650*sc)/2;
    const W=sr.width,H=sr.height, cw=W*.11, ch=cw*1.55, pw=(W*.84-HD)/N, vh=Math.max(30,W*.075), ah=vh*.62;
    const PL=(W-(HD+pw*N))/2, PT=H*.6, TLW=HD+pw*N, TLH=RU+vh+ah+10, X0=PL+HD, VY=PT+RU+4+vh/2;
    const t=(now-t0)%LOOP, back=t>=B0?ease((t-B0)/(LOOP-B0)):0;
    tl.style.cssText=`left:${PL}px;top:${PT}px;width:${TLW}px;height:${TLH}px;--hd:${HD}px;--ru:${RU}px;--vh:${vh}px;--ah:${ah}px;--pw:${pw}px;opacity:${cl((t-F0+500)/450)*(1-back)}`;
    const pp=cl((t-P0)/(P1-P0)), pos=t<P0?cl((t-F0)/(P0-F0))*.0:pp;
    ph.style.left=(HD+pos*pw*N)+'px';
    const fr=Math.floor(pp*N*2*25); tc.textContent=`00;00;${String(Math.floor(fr/25)).padStart(2,'0')};${String(fr%25).padStart(2,'0')}`;
    stage.classList.toggle('formed',t>P1-300&&t<B0+150);
    cards.forEach((c,i)=>{
      const o=ORB[i%2], th=(t/LOOP)*Math.PI*2*2+i*Math.PI*2/N*(i%2?1:1.15), al=o.a*Math.PI/180;
      const ex=o.rx*Math.cos(th), ey=o.ry*Math.sin(th);
      const x=ox+(o.cx+ex*Math.cos(al)-ey*Math.sin(al))*sc, y=oy+(o.cy+ex*Math.sin(al)+ey*Math.cos(al))*sc;
      const dx=-o.rx*Math.sin(th)*Math.cos(al)-o.ry*Math.cos(th)*Math.sin(al), dy=-o.rx*Math.sin(th)*Math.sin(al)+o.ry*Math.cos(th)*Math.cos(al);
      const ang=Math.atan2(dy,dx)*180/Math.PI+90, depth=(Math.sin(th)+1)/2, s=.62+.5*depth;
      const ts=F0+i*STEP, lk=cl((t-ts)/DUR), k=ease(cl(lk/.68))*(1-back), trim=ease(cl((lk-.72)/.28))*(1-back);
      const longW=pw*1.6, w0=cw+(longW-cw)*k, w=w0+(pw-2-w0)*trim, h=ch+(vh-ch)*k;
      const sx=X0+pw*i+1+w/2, cx=x+(sx-x)*k, cy=y+(VY-y)*k, r=ang*(1-k), z=s+(1-s)*k;
      c.style.width=w+'px';c.style.height=h+'px';
      c.style.transform=`translate(${cx-w/2}px,${cy-h/2}px) rotate(${r}deg) scale(${z})`;
      c.style.zIndex=k>.5?5:(depth>.5?3:1); c.style.opacity=k>.5?1:(.55+.45*depth);
      c.style.setProperty('--cut',lk>.66&&lk<.9?1:0); c.style.setProperty('--on',k>.92?1:0);
      c.classList.toggle('lock',pp*N>i+.5&&t<B0);
      const a=auds[i]; a.style.left=(pw*i+1)+'px'; a.style.width=(pw-2)+'px'; a.style.transform=`scaleX(${trim})`; a.style.opacity=trim;
    });
  }
  requestAnimationFrame(n=>{t0=n;last=n;frame(n)});
})();

// Spazio vero uguale tra le sezioni (computer e telefono): misura il contenuto visibile e regola lo spazio sotto ogni sezione.
(()=>{
  const S=[...document.querySelectorAll('main > section')];
  const absTop=e=>{let y=0;while(e){y+=e.offsetTop;e=e.offsetParent}return y};
  const skip='.contact-mosaic,.motion-stage,.reading-timeline,.clip-select';
  function edges(s){let top=Infinity,bot=-Infinity;
    s.querySelectorAll('*').forEach(e=>{
      if(e.children.length&&e.tagName!=='VIDEO'&&e.tagName!=='IMG')return;
      if(e.closest(skip)&&!e.classList.contains('motion-stage'))return;
      if(!e.offsetParent||e.offsetHeight<2)return;
      const c=getComputedStyle(e); if(c.visibility==='hidden')return;
      const y=absTop(e); top=Math.min(top,y); bot=Math.max(bot,y+e.offsetHeight)});
    const st=s.querySelector('.motion-stage'); if(st){const y=absTop(st);top=Math.min(top,y);bot=Math.max(bot,y+st.offsetHeight)}
    return [top,bot]}
  function pareggia(){
    S.forEach(s=>s.style.paddingBottom='');
    const sp=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sp'))||104, target=sp*2;
    for(let i=0;i<S.length-1;i++){
      const a=edges(S[i])[1], b=edges(S[i+1])[0]; if(!isFinite(a)||!isFinite(b))continue;
      const pb=parseFloat(getComputedStyle(S[i]).paddingBottom)||0;
      S[i].style.setProperty('padding-bottom',Math.max(0,pb+target-(b-a))+'px','important');
    }
  }
  let t; const presto=()=>{clearTimeout(t);t=setTimeout(pareggia,150)};
  addEventListener('load',pareggia); addEventListener('resize',presto); document.fonts&&document.fonts.ready.then(pareggia); pareggia();
})();
