const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],C=CONFIG;
function el(t,c,x){const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
const RM=matchMedia('(prefers-reduced-motion:reduce)').matches,ROM=['I','II','III','IV','V','VI','VII'];
document.title=C.title;$('#gateText').textContent=C.gateText;$('#open').textContent=C.gateButton;$('#title').textContent=C.title;$('#from').textContent=C.from;$('#f1').textContent=C.finalLine1;$('#f2').textContent=C.finalLine2;
C.timeline.forEach((i,n)=>{const l=el('li','rv');l.style.setProperty('--d',n*.08+'s');l.append(el('b','',i.d),i.t);$('#timeline').append(l)});
C.details.forEach((d,n)=>{const l=el('li','rv',d);l.style.setProperty('--d',n*.06+'s');$('#details').append(l)});
C.chapters.forEach((c,n)=>{const s=el('article','page rv');s.append(el('i'),el('span','no','Capítulo '+ROM[n]),el('h3','',c.title));const d=el('div','div');d.innerHTML='<svg class="o"><use href="#heart"/></svg>';s.append(d);if(n==0)s.append(el('p','greet',C.greeting));c.p.forEach(p=>s.append(el('p',p.k,p.t)));$('#chapters').append(s)});
C.gallery.forEach(g=>{const f=el('figure','rv'),i=el('img');i.src=g.src;i.alt=g.alt;i.loading='lazy';f.append(i);$(g.group=='arte'?'#gArte':'#gGosta').append(f)});
/* lightbox */
const lb=$('#lb'),li=lb.querySelector('img');let gi=0;const figs=()=>$$('.grid figure img');
function show(n){const a=figs();gi=(n+a.length)%a.length;li.src=a[gi].src;li.alt=a[gi].alt;lb.classList.add('on')}
document.addEventListener('click',e=>{const f=e.target.closest('.grid figure');if(f){show(figs().indexOf(f.querySelector('img')));return}
 if(e.target.closest('.x')||e.target===lb)lb.classList.remove('on');else if(e.target.closest('.pv'))show(gi-1);else if(e.target.closest('.nx'))show(gi+1)});
addEventListener('keydown',e=>{if(!lb.classList.contains('on'))return;if(e.key=='Escape')lb.classList.remove('on');if(e.key=='ArrowLeft')show(gi-1);if(e.key=='ArrowRight')show(gi+1)});
/* gate */
document.body.classList.add('lock');
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.06});
$('#open').onclick=$('#env').onclick=()=>{const g=$('#gate');g.classList.add('opening');setTimeout(()=>{g.classList.add('gone');$('#main').hidden=false;document.body.classList.remove('lock');scrollTo(0,0);$$('.rv').forEach(n=>io.observe(n))},1600)};
addEventListener('scroll',()=>{const h=document.documentElement;$('#bar').style.width=(100*h.scrollTop/(h.scrollHeight-h.clientHeight||1))+'%'},{passive:true});
/* corações ao tocar, brilhos ao mover */
function spawn(x,y,ch,n){for(let k=0;k<n;k++){const h=el('span','hrt',ch);h.style.left=x-10+'px';h.style.top=y-10+'px';h.style.setProperty('--dx',(Math.random()*80-40)+'px');document.body.append(h);setTimeout(()=>h.remove(),1200)}}
document.addEventListener('pointerdown',e=>{if(e.target.closest('iframe,input,#lb'))return;spawn(e.clientX,e.clientY,'♡',e.target.closest('.hb')?7:1)});
if(!RM&&matchMedia('(pointer:fine)').matches){let t=0;addEventListener('pointermove',e=>{if(e.timeStamp-t>70){t=e.timeStamp;spawn(e.clientX,e.clientY,'✦',1)}})}
/* partículas (corações e brilhos) */
if(!RM){const c=$('#fx'),x=c.getContext('2d'),cols=['#E85B9C','#F5A6CE','#F8D9E8','#9D315E'];let W,H;const P=[];
 const size=()=>{W=c.width=innerWidth;H=c.height=innerHeight};size();addEventListener('resize',size);
 for(let i=0;i<(innerWidth<600?16:30);i++)P.push({x:Math.random()*W,y:Math.random()*H,s:5+Math.random()*10,v:.2+Math.random()*.5,a:Math.random()*6,k:i%3,c:cols[i%4],o:.25+Math.random()*.4});
 const heart=s=>{x.beginPath();x.moveTo(0,s*.4);x.bezierCurveTo(-s*1.1,-s*.2,-s*.5,-s*.9,0,-s*.35);x.bezierCurveTo(s*.5,-s*.9,s*1.1,-s*.2,0,s*.4);x.fill()};
 const star=s=>{x.beginPath();for(let i=0;i<8;i++){const r=i%2?s*.25:s;x.lineTo(Math.cos(i*Math.PI/4)*r,Math.sin(i*Math.PI/4)*r)}x.closePath();x.fill()};
 (function loop(){if(!document.hidden){x.clearRect(0,0,W,H);P.forEach(p=>{p.y-=p.v;p.a+=.01;p.x+=Math.sin(p.a)*.4;if(p.y<-20){p.y=H+20;p.x=Math.random()*W}x.save();x.translate(p.x,p.y);x.rotate(Math.sin(p.a)*.5);x.globalAlpha=p.o;x.fillStyle=p.c;p.k?star(p.s):heart(p.s);x.restore()})}requestAnimationFrame(loop)})()}
/* player: só toca quando ela aperta play ou escolhe uma faixa */
let P,cur=0,ready=false,tick;const T=C.tracks,fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
T.forEach((t,i)=>{const l=el('li');const b=el('button','pick');b.type='button';const im=el('img');im.src='https://img.youtube.com/vi/'+t.id+'/mqdefault.jpg';im.alt='';const d=el('span');d.append(t.title,el('small','',t.note));b.append(im,d);b.onclick=()=>pick(i,true);const a=el('a','','abrir no YouTube');a.href='https://youtu.be/'+t.id;a.target='_blank';a.rel='noopener';l.append(b,a);$('#tracks').append(l)});
function mark(){$$('.tracks li').forEach((l,i)=>l.classList.toggle('on',i==cur));$('#now').textContent='♪ '+T[cur].title}
function pick(i,go){cur=(i+T.length)%T.length;mark();if(!ready){$('#now').textContent='Carregando o player... (se não abrir, use o link do YouTube)';return}go?P.loadVideoById(T[cur].id):P.cueVideoById(T[cur].id)}
const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.onerror=()=>$('#now').textContent='Player indisponível agora. Use os links do YouTube abaixo.';document.head.append(s);
window.onYouTubeIframeAPIReady=()=>{P=new YT.Player('yt',{videoId:T[0].id,playerVars:{playsinline:1,rel:0,modestbranding:1},events:{onReady:()=>{ready=true;mark()},onStateChange:e=>{const on=e.data==1;['#eq','#disc','.player'].forEach(q=>$(q).classList.toggle('on',on));$('#play').textContent=on?'⏸':'▶';if(e.data==0)pick(cur+1,true);clearInterval(tick);if(on)tick=setInterval(()=>{const d=P.getDuration(),c=P.getCurrentTime();$('#seek').value=d?100*c/d:0;$('#t1').textContent=fmt(c);$('#t2').textContent=fmt(d)},500)}}})};
$('#play').onclick=()=>{if(ready)P.getPlayerState()==1?P.pauseVideo():P.playVideo()};
$('#prev').onclick=()=>pick(cur-1,true);$('#next').onclick=()=>pick(cur+1,true);
$('#seek').oninput=e=>{if(ready)P.seekTo(P.getDuration()*e.target.value/100,true)};
