const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='flip_123_state';
const LEGACY_KEYS=['flip_121_state','flip_122_state'];
function readJSON(k){try{return JSON.parse(localStorage.getItem(k)||'null')||{history:[],favorites:[]}}catch(e){return {history:[],favorites:[]}}}
function mergeUnique(arrs){const m=new Map();arrs.flatMap(a=>a||[]).forEach(x=>{if(x&&x.id!=null)m.set(String(x.id),x)});return [...m.values()].sort((a,b)=>(b.id||0)-(a.id||0))}
const loaded=[readJSON(KEY),...LEGACY_KEYS.map(readJSON)];
let state={history:mergeUnique(loaded.map(x=>x.history)).slice(0,100),favorites:mergeUnique(loaded.map(x=>x.favorites)).slice(0,100)};
let selectMode={history:false,favorites:false};
function save(){localStorage.setItem(KEY,JSON.stringify(state));localStorage.setItem('flip_121_state',JSON.stringify(state));localStorage.setItem('flip_122_state',JSON.stringify(state));renderStats()}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(window.tt);window.tt=setTimeout(()=>t.classList.remove('show'),2100)}
function money(n){return Number(n||0).toLocaleString('ru-RU',{maximumFractionDigits:2})+' BYN'}
function median(a){a=[...a].sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function calc(){
 const buy=parseFloat($('#buyPrice').value), manual=parseFloat($('#sellPrice').value);
 const analogs=$$('.analog').map(x=>parseFloat(x.value)).filter(x=>Number.isFinite(x)&&x>0);
 const market=median(analogs), sell=Number.isFinite(manual)&&manual>0?manual:market;
 const feePct=clamp(parseFloat($('#fee').value)||0,0,100), condition=$('#condition').value;
 if(!Number.isFinite(buy)||buy<=0)return {error:'Укажи цену покупки.'};
 if(!Number.isFinite(sell)||sell<=0)return {error:'Укажи цену продажи или минимум 3 цены аналогов.'};
 if(!Number.isFinite(manual)&&analogs.length<3)return {error:'Для оценки рынка добавь минимум 3 цены аналогов.'};
 const fee=sell*feePct/100,net=sell-buy-fee,margin=buy?net/buy*100:0;
 let score=50+margin*.45+(analogs.length>=3?Math.min(10,analogs.length*2):0);
 if(condition==='used')score-=8;if(condition==='bad')score-=20;score=clamp(Math.round(score),0,100);
 return {buy,sell,manual:Number.isFinite(manual)&&manual>0,analogs,market,feePct,fee,net,margin,score,
 risk:score>=75?'Низкий':score>=50?'Средний':'Высокий',
 label:score>=75?'Интересная возможность':score>=50?'Есть что проверить':'Осторожно',id:Date.now(),
 url:$('#url').value.trim(),date:new Date().toLocaleString('ru-RU'),condition};
}
function renderResult(){
 const r=calc();if(r.error){toast(r.error);return}
 const id='check_'+r.id;
 const marketText=r.manual?`Медиана введённых аналогов: ${money(r.market)}. Для расчёта использована указанная цена продажи.`:`FLIP использует медиану ${r.analogs.length} аналогов. Это ориентир рынка, а не гарантия фактической цены продажи.`;
 const rec=r;
 state.history.unshift(rec);state.history=state.history.slice(0,50);save();
 const saved=state.favorites.some(x=>x.id===rec.id);
 $('#result').innerHTML=`
 <div class="resultTop"><div><div class="resultTitle">${r.label}</div><div class="risk">Риск: ${r.risk}</div></div>
 <button id="heartResult" class="heart ${saved?'saved':''}">${saved?'♥':'♡'}</button><div class="score">${r.score}<small>/100</small></div></div>
 <div class="metrics"><div class="metric"><span>Покупка</span><b>${money(r.buy)}</b></div><div class="metric"><span>Цена расчёта</span><b>${money(r.sell)}</b></div><div class="metric"><span>Расходы</span><b>${money(r.fee)}</b></div><div class="metric"><span>После расходов</span><b>${money(r.net)}</b></div></div>
 <div class="market"><b>📊 Рынок</b><p>${marketText}</p><p>Диапазон: ${r.analogs.length?money(Math.min(...r.analogs))+' — '+money(Math.max(...r.analogs)):'нет данных'} · Аналогов: ${r.analogs.length}</p></div>
 <div class="checklist"><b>✅ Что проверить перед покупкой</b>
 ${['Цена соответствует рынку','Состояние соответствует описанию','Работоспособность проверена','Комплектация соответствует объявлению','Нет серьёзных повреждений','Продавец вызывает доверие','Нет подозрительных признаков'].map((x,i)=>`<label class="checkItem"><input type="checkbox" data-check="${i}"><span>${x}</span></label>`).join('')}
 <div id="checkProgress" class="hint">Проверено: 0 из 7</div></div>
 <div class="market"><b>Почему такой score?</b><p>Учитываются потенциальная маржа, расходы, состояние и количество аналогов. Score — расчётный ориентир, а не гарантия прибыли.</p></div>`;
 $('#result').classList.remove('hidden');
 $('#heartResult').onclick=()=>toggleFavorite(rec);
 $$('[data-check]').forEach(x=>x.onchange=()=>{const n=$$('[data-check]').filter(c=>c.checked).length;$('#checkProgress').textContent=`Проверено: ${n} из 7`});
 renderHistory();renderFavorites();renderStats();
}
function toggleFavorite(r){
 const i=state.favorites.findIndex(x=>x.id===r.id);
 if(i>=0){state.favorites.splice(i,1);toast('Убрано из избранного')}
 else{state.favorites.unshift(r);state.favorites=state.favorites.slice(0,50);toast('❤️ Добавлено в избранное')}
 save();renderFavorites();
 const h=$('#heartResult');if(h){h.classList.toggle('saved',i<0);h.textContent=i<0?'♥':'♡'}
}
function card(r,type,idx){
 const selected=(selectMode[type]&&((type==='history'?selectedHistory:selectedFavorites).has(r.id)));
 const href=r.url?`<small>${r.url}</small>`:'';
 return `<div class="cardWrap"><div class="deleteBg">Удалить</div><div class="card" data-card="${r.id}" data-type="${type}">
 <div class="cardRow">${selectMode[type]?`<input class="selectBox" type="checkbox" data-select="${r.id}" ${selected?'checked':''}>`:''}
 <div class="cardMain"><div class="cardTop"><div><b>${r.label}</b><br><small>${r.date}</small></div><span class="cardScore">${r.score}/100</span></div>
 <p>${money(r.buy)} → ${money(r.sell)} · после расходов ${money(r.net)} ${href}</p></div></div></div></div>`
}
let selectedHistory=new Set(),selectedFavorites=new Set();
function renderHistory(){
 const box=$('#historyList'),empty=$('#emptyHistory');box.innerHTML='';
 empty.style.display=state.history.length?'none':'block';
 state.history.slice(0,30).forEach((r,i)=>box.insertAdjacentHTML('beforeend',card(r,'history',i)));
 bindCards('history');updateTools('history');
}
function renderFavorites(){
 const box=$('#favoritesList'),empty=$('#emptyFavorites');box.innerHTML='';
 empty.style.display=state.favorites.length?'none':'block';
 state.favorites.forEach((r,i)=>box.insertAdjacentHTML('beforeend',card(r,'favorites',i)));
 bindCards('favorites');updateTools('favorites');
}
function bindCards(type){
 $$('#'+(type==='history'?'historyList':'favoritesList')+' .card').forEach(c=>{
  let sx=0,dx=0;
  c.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;c.classList.add('swiping')},{passive:true});
  c.addEventListener('touchmove',e=>{dx=e.touches[0].clientX-sx;if(dx<0&&dx>-100)c.style.transform=`translateX(${dx}px)`},{passive:true});
  c.addEventListener('touchend',()=>{c.classList.remove('swiping');if(dx<-45){c.classList.add('swiped');setTimeout(()=>removeOne(type,+c.dataset.card),180)}else c.style.transform='';dx=0});
 });
 $$('#'+(type==='history'?'historyList':'favoritesList')+' [data-select]').forEach(x=>x.onchange=()=>{const s=type==='history'?selectedHistory:selectedFavorites;x.checked?s.add(+x.dataset.select):s.delete(+x.dataset.select);updateTools(type)});
}
function removeOne(type,id){const arr=type==='history'?state.history:state.favorites;const i=arr.findIndex(x=>x.id===id);if(i>=0)arr.splice(i,1);save();toast('Удалено');type==='history'?renderHistory():renderFavorites()}
function updateTools(type){
 const set=type==='history'?selectedHistory:selectedFavorites, arr=type==='history'?state.history:state.favorites;
 const tools=$(type==='history'?'#historyTools':'#favTools');tools.classList.toggle('hidden',!selectMode[type]);
 if(selectMode[type])tools.querySelector('[id$="Delete"]').textContent=`Удалить выбранное${set.size?` (${set.size})`:''}`;
}
function enterSelect(type,on){
 selectMode[type]=on; if(!on)(type==='history'?selectedHistory:selectedFavorites).clear();
 $(type==='history'?'#historyTools':'#favTools').classList.toggle('hidden',!on);
 type==='history'?renderHistory():renderFavorites();
}
function deleteSelected(type){
 const set=type==='history'?selectedHistory:selectedFavorites, arr=type==='history'?state.history:state.favorites;
 if(!set.size){toast('Сначала выбери элементы');return}
 const keep=arr.filter(x=>!set.has(x.id));if(type==='history')state.history=keep;else state.favorites=keep;
 set.clear();selectMode[type]=false;save();toast('Выбранное удалено');type==='history'?renderHistory():renderFavorites();
}
function selectAll(type){
 const arr=type==='history'?state.history:state.favorites,set=type==='history'?selectedHistory:selectedFavorites;set.clear();arr.forEach(x=>set.add(x.id));type==='history'?renderHistory():renderFavorites()
}
$$('.navItem').forEach(b=>b.onclick=()=>{$$('.navItem').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.screen').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.screen).classList.add('active');document.querySelector('.app').classList.toggle('homeActive',b.dataset.screen==='home');renderHistory();renderFavorites();renderStats()});
$('#toggleAdvanced').onclick=()=>{const a=$('#advanced');const hidden=a.style.display==='none';a.style.display=hidden?'block':'none';$('#chevron').textContent=hidden?'⌄':'›'};
$('#analyzeBtn').onclick=renderResult;
$('#historySelect').onclick=()=>enterSelect('history',true);$('#historyCancel').onclick=()=>enterSelect('history',false);$('#historyAll').onclick=()=>selectAll('history');$('#historyDelete').onclick=()=>deleteSelected('history');
$('#favSelect').onclick=()=>enterSelect('favorites',true);$('#favCancel').onclick=()=>enterSelect('favorites',false);$('#favAll').onclick=()=>selectAll('favorites');$('#favDelete').onclick=()=>deleteSelected('favorites');
function renderStats(){$('#statChecks').textContent=state.history.length;$('#statFav').textContent=state.favorites.length;$('#statAvg').textContent=state.history.length?Math.round(state.history.reduce((a,x)=>a+x.score,0)/state.history.length):0}
document.querySelector('.app').classList.add('homeActive');
if(window.Telegram?.WebApp){Telegram.WebApp.ready();Telegram.WebApp.expand()}
renderHistory();renderFavorites();renderStats();
