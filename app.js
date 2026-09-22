const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY='flip_121_state', NEW_KEY='flip_122_state';
function loadState(){
  const old=JSON.parse(localStorage.getItem(KEY)||'{"history":[],"favorites":[]}');
  const newer=JSON.parse(localStorage.getItem(NEW_KEY)||'{"history":[],"favorites":[]}');
  const merge=(a,b)=>{const m=new Map();[...(a||[]),...(b||[])].forEach(x=>{if(x&&x.id)m.set(String(x.id),x)});return [...m.values()].sort((x,y)=>(y.id||0)-(x.id||0))};
  return {history:merge(old.history,newer.history).slice(0,100),favorites:merge(old.favorites,newer.favorites).slice(0,100)};
}
let state=loadState(), selectMode={history:false,favorites:false}, selectedHistory=new Set(), selectedFavorites=new Set();
function save(){localStorage.setItem(KEY,JSON.stringify(state));localStorage.setItem(NEW_KEY,JSON.stringify(state));renderStats()}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window._toast);window._toast=setTimeout(()=>t.classList.remove('show'),2200)}
function money(n){return Number(n||0).toLocaleString('ru-RU',{maximumFractionDigits:2})+' BYN'}
function vals(){return $$('.analog').map(x=>parseFloat(x.value)).filter(x=>Number.isFinite(x)&&x>0)}
function median(a){a=[...a].sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function calc(){
 const buy=parseFloat($('#buyPrice').value), manual=parseFloat($('#sellPrice').value), analogs=vals(), market=median(analogs);
 const sell=Number.isFinite(manual)&&manual>0?manual:market, feePct=clamp(parseFloat($('#fee').value)||0,0,100), condition=$('#condition').value;
 if(!Number.isFinite(buy)||buy<=0)return {error:'Укажи цену покупки.'};
 if(!Number.isFinite(sell)||sell<=0)return {error:'Укажи цену продажи или хотя бы 3 цены аналогов.'};
 if(!Number.isFinite(manual)&&analogs.length<3)return {error:'Для оценки рынка добавь минимум 3 цены аналогов.'};
 const fee=sell*feePct/100,net=sell-buy-fee,margin=buy?net/buy*100:0;
 let score=50+margin*.45;if(condition==='used')score-=8;if(condition==='bad')score-=20;if(!Number.isFinite(manual)&&analogs.length>=3)score+=Math.min(10,analogs.length*2);score=clamp(Math.round(score),0,100);
 return {buy,sell,manual:Number.isFinite(manual)&&manual>0,analogs,market,feePct,fee,net,margin,score,risk:score>=75?'Низкий':score>=50?'Средний':'Высокий',label:score>=75?'Интересная возможность':score>=50?'Есть что проверить':'Осторожно',condition};
}
function makeRecord(r){return {...r,id:Date.now()+Math.floor(Math.random()*1000),url:$('#url').value.trim(),date:new Date().toLocaleString('ru-RU')}}
function renderResult(){
 const r=calc(),el=$('#result');if(r.error){toast(r.error);return}
 const record=makeRecord(r), saved=state.favorites.some(x=>x.url===record.url&&x.buy===record.buy&&x.sell===record.sell&&Math.abs(x.date?1:0)>=0);
 const marketText=r.manual?`Рыночная медиана по введённым аналогам: ${money(r.market)}. Для расчёта использована указанная цена продажи.`:`FLIP взял медиану из ${r.analogs.length} аналогов: ${r.analogs.map(money).join(' · ')}. Это ориентир, а не гарантия фактической цены продажи.`;
 el.innerHTML=`<div class="resultTop"><div><div class="resultTitle">${r.label}</div><div class="risk">Риск: ${r.risk}</div></div><button id="heartResult" class="heart ${saved?'saved':''}">${saved?'♥':'♡'}</button><div class="score">${r.score}<small>/100</small></div></div>
 <div class="metrics"><div class="metric"><span>Покупка</span><b>${money(r.buy)}</b></div><div class="metric"><span>Цена расчёта</span><b>${money(r.sell)}</b></div><div class="metric"><span>Расходы</span><b>${money(r.fee)}</b></div><div class="metric"><span>После расходов</span><b>${money(r.net)}</b></div></div>
 <div class="market"><b>📊 Рынок</b><p>${marketText}</p><p>Диапазон: ${r.analogs.length?money(Math.min(...r.analogs))+' — '+money(Math.max(...r.analogs)):'нет данных'} · Аналогов: ${r.analogs.length}</p></div>
 <div class="checklist"><b>Что проверить перед покупкой</b>${['Цена соответствует рынку','Состояние соответствует описанию','Работоспособность проверена','Комплектация соответствует объявлению','Нет серьёзных повреждений','Продавец вызывает доверие','Нет подозрительных признаков'].map((x,i)=>`<label class="checkItem"><input type="checkbox"><span>${x}</span></label>`).join('')}<div id="checkProgress" class="hint">Проверено: 0 из 7</div></div>
 <div class="market"><b>Почему такой score?</b><p>Учитываются потенциальная маржа, расходы, состояние товара и количество введённых аналогов. Score — расчётный ориентир, не прогноз продажи.</p></div>`;
 el.classList.remove('hidden');
 const checks=$$('.checkItem input');checks.forEach(c=>c.onchange=()=>$('#checkProgress').textContent=`Проверено: ${checks.filter(x=>x.checked).length} из 7`);
 $('#heartResult').onclick=()=>toggleFavorite(record);
 state.history.unshift(record);state.history=state.history.slice(0,100);save();renderHistory();renderFavorites();
}
function sameItem(a,b){return a.url===b.url&&a.buy===b.buy&&a.sell===b.sell&&a.score===b.score}
function toggleFavorite(r){const i=state.favorites.findIndex(x=>sameItem(x,r));if(i>=0){state.favorites.splice(i,1);toast('Убрано из избранного')}else{state.favorites.unshift(r);state.favorites=state.favorites.slice(0,100);toast('❤️ Добавлено в избранное')}save();renderFavorites();const h=$('#heartResult');if(h){const now=state.favorites.some(x=>sameItem(x,r));h.classList.toggle('saved',now);h.textContent=now?'♥':'♡'}}
function card(r,type){const set=type==='history'?selectedHistory:selectedFavorites;return `<div class="cardWrap"><div class="deleteBg">Удалить</div><div class="card" data-id="${r.id}" data-type="${type}"><div class="cardRow">${selectMode[type]?`<input class="selectBox" type="checkbox" data-select="${r.id}" ${set.has(r.id)?'checked':''}>`:''}<div class="cardMain"><div class="cardTop"><div><b>${r.label}</b><br><small>${r.date}</small></div><b>${r.score}/100</b></div><p>Покупка ${money(r.buy)} → рынок/расчёт ${money(r.sell)} → после расходов ${money(r.net)}</p>${r.url?`<p class="urlLine">${r.url}</p>`:''}</div></div></div></div>`}
function renderHistory(){const box=$('#historyList'),empty=$('#emptyHistory');box.innerHTML='';empty.style.display=state.history.length?'none':'block';state.history.slice(0,50).forEach(r=>box.insertAdjacentHTML('beforeend',card(r,'history')));bindList('history');updateTools('history')}
function renderFavorites(){const box=$('#favoritesList'),empty=$('#emptyFavorites');box.innerHTML='';empty.style.display=state.favorites.length?'none':'block';state.favorites.forEach(r=>box.insertAdjacentHTML('beforeend',card(r,'favorites')));bindList('favorites');updateTools('favorites')}
function bindList(type){const box=$(type==='history'?'#historyList':'#favoritesList');$$('.card',box).forEach(c=>{let sx=0,dx=0;c.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;c.classList.add('swiping')},{passive:true});c.addEventListener('touchmove',e=>{dx=e.touches[0].clientX-sx;if(dx<0&&dx>-90)c.style.transform=`translateX(${dx}px)`},{passive:true});c.addEventListener('touchend',()=>{c.classList.remove('swiping');if(dx<-45){c.classList.add('swiped');setTimeout(()=>removeOne(type,+c.dataset.id),150)}else c.style.transform='';dx=0})});$$('[data-select]',box).forEach(x=>x.onchange=()=>{const set=type==='history'?selectedHistory:selectedFavorites;x.checked?set.add(+x.dataset.select):set.delete(+x.dataset.select);updateTools(type)})}
function removeOne(type,id){const arr=type==='history'?state.history:state.favorites,i=arr.findIndex(x=>x.id===id);if(i>=0)arr.splice(i,1);save();toast('Удалено');type==='history'?renderHistory():renderFavorites()}
function updateTools(type){const set=type==='history'?selectedHistory:selectedFavorites,tools=$(type==='history'?'#historyTools':'#favTools');tools.classList.toggle('hidden',!selectMode[type]);if(selectMode[type]){const btn=tools.querySelector('.danger');btn.textContent=`Удалить выбранное${set.size?` (${set.size})`:''}`}}
function enterSelect(type){selectMode[type]=true;(type==='history'?selectedHistory:selectedFavorites).clear();type==='history'?renderHistory():renderFavorites()}
function cancelSelect(type){selectMode[type]=false;(type==='history'?selectedHistory:selectedFavorites).clear();type==='history'?renderHistory():renderFavorites()}
function selectAll(type){const arr=type==='history'?state.history:state.favorites,set=type==='history'?selectedHistory:selectedFavorites;set.clear();arr.forEach(x=>set.add(x.id));type==='history'?renderHistory():renderFavorites()}
function deleteSelected(type){const set=type==='history'?selectedHistory:selectedFavorites;if(!set.size){toast('Сначала выбери элементы');return}if(type==='history')state.history=state.history.filter(x=>!set.has(x.id));else state.favorites=state.favorites.filter(x=>!set.has(x.id));cancelSelect(type);save();toast('Выбранное удалено')}
function renderStats(){$('#statChecks').textContent=state.history.length;$('#statFav').textContent=state.favorites.length;$('#statAvg').textContent=state.history.length?Math.round(state.history.reduce((s,r)=>s+r.score,0)/state.history.length):0}
$$('.navItem').forEach(b=>b.onclick=()=>{$$('.navItem').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.screen').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.screen).classList.add('active');renderHistory();renderFavorites();renderStats()});
$('#toggleAdvanced').onclick=()=>{const a=$('#advanced');a.style.display=a.style.display==='none'?'block':'none';$('#chevron').textContent=a.style.display==='none'?'›':'⌄'};$('#analyzeBtn').onclick=renderResult;
$('#historySelect').onclick=()=>enterSelect('history');$('#historyCancel').onclick=()=>cancelSelect('history');$('#historyAll').onclick=()=>selectAll('history');$('#historyDelete').onclick=()=>deleteSelected('history');
$('#favSelect').onclick=()=>enterSelect('favorites');$('#favCancel').onclick=()=>cancelSelect('favorites');$('#favAll').onclick=()=>selectAll('favorites');$('#favDelete').onclick=()=>deleteSelected('favorites');
if(window.Telegram?.WebApp){Telegram.WebApp.ready();Telegram.WebApp.expand()}renderHistory();renderFavorites();renderStats();
