const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const OLD='flip_121_state', CURRENT='flip_122_state';
function loadState(){
 let s={history:[],favorites:[]};
 for(const key of [OLD,CURRENT]){
  try{const x=JSON.parse(localStorage.getItem(key)||'null');if(x){if(Array.isArray(x.history))s.history.push(...x.history);if(Array.isArray(x.favorites))s.favorites.push(...x.favorites)}}catch(e){}
 }
 // preserve old Lite counters/saved where present
 try{const saved=JSON.parse(localStorage.getItem('flipSaved')||'[]');saved.forEach((name,i)=>s.favorites.push({id:('lite_'+i+'_'+name),label:name,score:0,buy:0,sell:0,net:0,date:'Старое избранное'}))}catch(e){}
 const uniq=a=>{const m=new Map();a.forEach(x=>m.set(String(x.id||JSON.stringify(x)),x));return [...m.values()]};
 s.history=uniq(s.history).slice(0,50);s.favorites=uniq(s.favorites).slice(0,50);return s
}
let state=loadState(), mode={history:false,favorites:false}, selectedH=new Set(),selectedF=new Set();
function save(){localStorage.setItem(CURRENT,JSON.stringify(state));renderStats()}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(window._t);window._t=setTimeout(()=>t.classList.remove('show'),1900)}
function money(n){return Number(n||0).toLocaleString('ru-RU',{maximumFractionDigits:2})+' BYN'}
function median(a){a=[...a].sort((x,y)=>x-y);if(!a.length)return 0;let m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function calc(){
 const buy=parseFloat($('#buyPrice').value),manual=parseFloat($('#sellPrice').value),analogs=$$('.analog').map(x=>parseFloat(x.value)).filter(x=>Number.isFinite(x)&&x>0);
 const market=median(analogs),sell=Number.isFinite(manual)&&manual>0?manual:market,feePct=Math.max(0,Math.min(100,parseFloat($('#fee').value)||0)),condition=$('#condition').value;
 if(!Number.isFinite(buy)||buy<=0)return {error:'Укажи цену покупки.'};
 if(!Number.isFinite(sell)||sell<=0)return {error:'Укажи цену продажи или цены аналогов.'};
 if(!Number.isFinite(manual)&&analogs.length<3)return {error:'Добавь минимум 3 цены аналогов или укажи цену продажи.'};
 const fee=sell*feePct/100,net=sell-buy-fee,margin=buy?net/buy*100:0;
 let score=50+margin*.45+(analogs.length>=3?Math.min(10,analogs.length*2):0);if(condition==='used')score-=8;if(condition==='bad')score-=20;score=Math.max(0,Math.min(100,Math.round(score)));
 return {id:Date.now(),label:score>=75?'Интересная возможность':score>=50?'Есть что проверить':'Осторожно',risk:score>=75?'Низкий':score>=50?'Средний':'Высокий',score,buy,sell,manual:Number.isFinite(manual)&&manual>0,analogs,market,fee,net,margin,url:$('#url').value.trim(),date:new Date().toLocaleString('ru-RU')}
}
function toggleFav(r){
 const i=state.favorites.findIndex(x=>String(x.id)===String(r.id));if(i>=0){state.favorites.splice(i,1);toast('Убрано из избранного')}else{state.favorites.unshift(r);toast('❤️ Добавлено в избранное')};save();renderFavorites();
 const h=$('#resultHeart');if(h){h.classList.toggle('saved',i<0);h.textContent=i<0?'♥':'♡'}
}
function renderResult(){
 const r=calc();if(r.error){toast(r.error);return}
 state.history.unshift(r);state.history=state.history.slice(0,50);save();
 const fav=state.favorites.some(x=>String(x.id)===String(r.id));
 $('#result').innerHTML=`<div class="resultTop"><div class="resultMain"><div class="resultTitle">${r.label}</div><div class="risk">Риск: ${r.risk}</div></div><button id="resultHeart" class="heart ${fav?'saved':''}">${fav?'♥':'♡'}</button><div class="score">${r.score}<small>/100</small></div></div>
 <div class="metrics"><div class="metric"><span>Покупка</span><b>${money(r.buy)}</b></div><div class="metric"><span>Цена расчёта</span><b>${money(r.sell)}</b></div><div class="metric"><span>Расходы</span><b>${money(r.fee)}</b></div><div class="metric"><span>После расходов</span><b>${money(r.net)}</b></div></div>
 <div class="market"><b>📊 Рынок</b><p>${r.manual?`Медиана аналогов: ${money(r.market)}. Для расчёта использована указанная цена продажи.`:`FLIP взял медиану из ${r.analogs.length} аналогов.`}</p><p>Диапазон: ${r.analogs.length?money(Math.min(...r.analogs))+' — '+money(Math.max(...r.analogs)):'нет данных'} · Аналогов: ${r.analogs.length}</p></div>
 <div class="checklist"><b>Что проверить перед покупкой</b>${['Цена соответствует рынку','Состояние соответствует описанию','Работоспособность проверена','Комплектация соответствует объявлению','Нет серьёзных повреждений','Продавец вызывает доверие','Нет подозрительных признаков'].map((x,i)=>`<label class="checkItem"><input type="checkbox" data-c="${i}"><span>${x}</span></label>`).join('')}<div id="progress" class="hint">Проверено: 0 из 7</div></div>
 <div class="market"><b>Почему такой score?</b><p>Учитываются потенциальная маржа, расходы, состояние и количество аналогов. Score — ориентир, а не гарантия прибыли.</p></div>`;
 $('#result').classList.remove('hidden');$('#resultHeart').onclick=()=>toggleFav(r);
 $$('[data-c]').forEach(x=>x.onchange=()=>$('#progress').textContent=`Проверено: ${$$('[data-c]').filter(y=>y.checked).length} из 7`);
 renderHistory();renderFavorites();renderStats()
}
function itemHTML(r,type){
 const set=type==='history'?selectedH:selectedF, sel=mode[type]&&set.has(r.id);
 return `<div class="itemWrap"><div class="deleteBg">Удалить</div><div class="item" data-id="${r.id}" data-type="${type}"><div class="itemRow">${mode[type]?`<input class="selectBox" type="checkbox" data-select="${r.id}" ${sel?'checked':''}>`:''}<div class="itemMain"><div class="itemTop"><div><b>${r.label||'Сохранённый товар'}</b><br><small>${r.date||''}</small></div><b>${r.score||0}/100</b></div><p>${r.buy?money(r.buy)+' → '+money(r.sell)+' · после расходов '+money(r.net):'Сохранено в FLIP'}</p></div></div></div></div>`
}
function renderHistory(){const b=$('#historyList');b.innerHTML=state.history.map(r=>itemHTML(r,'history')).join('');$('#emptyHistory').style.display=state.history.length?'none':'block';bind('history');}
function renderFavorites(){const b=$('#favoritesList');b.innerHTML=state.favorites.map(r=>itemHTML(r,'favorites')).join('');$('#emptyFavorites').style.display=state.favorites.length?'none':'block';bind('favorites');}
function bind(type){
 const box=type==='history'?'#historyList':'#favoritesList';
 $$(box+' .item').forEach(el=>{let sx=0,dx=0;el.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;dx=0;el.classList.add('swiping')},{passive:true});el.addEventListener('touchmove',e=>{dx=e.touches[0].clientX-sx;if(dx<0&&dx>-100)el.style.transform=`translateX(${dx}px)`},{passive:true});el.addEventListener('touchend',()=>{el.classList.remove('swiping');if(dx<-45){el.style.transform='translateX(-90px)';setTimeout(()=>removeOne(type,el.dataset.id),120)}else el.style.transform='';})});
 $$(box+' [data-select]').forEach(x=>x.onchange=()=>{const s=type==='history'?selectedH:selectedF;x.checked?s.add(String(x.dataset.select)):s.delete(String(x.dataset.select));updateTools(type)})
}
function removeOne(type,id){const a=type==='history'?state.history:state.favorites,i=a.findIndex(x=>String(x.id)===String(id));if(i>=0)a.splice(i,1);save();toast('Удалено');type==='history'?renderHistory():renderFavorites()}
function enter(type){mode[type]=true;type==='history'?renderHistory():renderFavorites();$(type==='history'?'#historyTools':'#favTools').classList.remove('hidden')}
function cancel(type){mode[type]=false;(type==='history'?selectedH:selectedF).clear();type==='history'?renderHistory():renderFavorites();$(type==='history'?'#historyTools':'#favTools').classList.add('hidden')}
function all(type){const a=type==='history'?state.history:state.favorites,s=type==='history'?selectedH:selectedF;s.clear();a.forEach(x=>s.add(String(x.id)));type==='history'?renderHistory():renderFavorites()}
function del(type){const s=type==='history'?selectedH:selectedF;if(!s.size){toast('Сначала выбери элементы');return}const a=type==='history'?state.history:state.favorites,n=a.filter(x=>!s.has(String(x.id)));if(type==='history')state.history=n;else state.favorites=n;cancel(type);save();toast('Выбранное удалено')}
function updateTools(type){const s=type==='history'?selectedH:selectedF;const b=$(type==='history'?'#historyDelete':'#favDelete');if(b)b.textContent=`Удалить выбранное${s.size?' ('+s.size+')':''}`}
function renderStats(){let h=state.history;$('#statChecks').textContent=h.length;$('#statFav').textContent=state.favorites.length;$('#statAvg').textContent=h.length?Math.round(h.reduce((a,x)=>a+(Number(x.score)||0),0)/h.length):0}
$$('.navItem').forEach(b=>b.onclick=()=>{$$('.navItem').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.screen').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.screen).classList.add('active');renderHistory();renderFavorites();renderStats()});
$('#toggleAdvanced').onclick=()=>{const a=$('#advanced'),hidden=a.style.display==='none';a.style.display=hidden?'block':'none';$('#chevron').textContent=hidden?'⌄':'›'};
$('#analyzeBtn').onclick=renderResult;
$('#historySelect').onclick=()=>enter('history');$('#historyCancel').onclick=()=>cancel('history');$('#historyAll').onclick=()=>all('history');$('#historyDelete').onclick=()=>del('history');
$('#favSelect').onclick=()=>enter('favorites');$('#favCancel').onclick=()=>cancel('favorites');$('#favAll').onclick=()=>all('favorites');$('#favDelete').onclick=()=>del('favorites');
if(window.Telegram?.WebApp){Telegram.WebApp.ready();Telegram.WebApp.expand()}
renderHistory();renderFavorites();renderStats();
