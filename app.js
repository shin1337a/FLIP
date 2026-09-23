const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const KEY='flip_121_state';
let state=JSON.parse(localStorage.getItem(KEY)||'{"history":[],"favorites":[]}');

function save(){localStorage.setItem(KEY,JSON.stringify(state));renderStats();}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window._toast);window._toast=setTimeout(()=>t.classList.remove('show'),2200)}
function money(n){return Number(n||0).toLocaleString('ru-RU',{maximumFractionDigits:2})+' BYN'}
function vals(){return $$('.analog').map(x=>parseFloat(x.value)).filter(x=>Number.isFinite(x)&&x>0)}
function median(a){a=[...a].sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function calc(){
  const buy=parseFloat($('#buyPrice').value);
  const manual=parseFloat($('#sellPrice').value);
  const analogs=vals(), market=median(analogs);
  const sell=Number.isFinite(manual)&&manual>0?manual:market;
  const feePct=clamp(parseFloat($('#fee').value)||0,0,100);
  const condition=$('#condition').value;
  if(!Number.isFinite(buy)||buy<=0)return {error:'Укажи цену покупки.'};
  if(!Number.isFinite(sell)||sell<=0)return {error:'Укажи цену продажи или хотя бы 3 цены аналогов.'};
  if(!Number.isFinite(manual)&&analogs.length<3)return {error:'Для оценки рынка добавь минимум 3 цены аналогов.'};
  const fee=sell*feePct/100, net=sell-buy-fee, margin=net/buy*100;
  let score=50+margin*0.45;
  if(condition==='used')score-=8;
  if(condition==='bad')score-=20;
  if(!manual&&analogs.length>=3)score+=Math.min(10,analogs.length*2);
  score=clamp(Math.round(score),0,100);
  const risk=score>=75?'Низкий':score>=50?'Средний':'Высокий';
  const label=score>=75?'Интересная возможность':score>=50?'Есть что проверить':'Осторожно';
  return {buy,sell,manual:Number.isFinite(manual)&&manual>0,analogs,market,feePct,fee,net,margin,score,risk,label,condition};
}
function renderResult(){
  const r=calc(), el=$('#result');
  if(r.error){toast(r.error);return}
  const marketText=r.manual
    ? `Рыночная медиана по введённым аналогам: ${money(r.market)}. Для расчёта использована указанная цена продажи.`
    : `FLIP взял медиану из ${r.analogs.length} аналогов: ${r.analogs.map(money).join(' · ')}. Это ориентир, а не гарантия фактической цены продажи.`;
  el.innerHTML=`
    <div class="resultTop"><div><div class="resultTitle">${r.label}</div><div class="risk">Риск: ${r.risk}</div></div><div class="score">${r.score}<small>/100</small></div></div>
    <div class="metrics">
      <div class="metric"><span>Покупка</span><b>${money(r.buy)}</b></div>
      <div class="metric"><span>Цена расчёта</span><b>${money(r.sell)}</b></div>
      <div class="metric"><span>Расходы</span><b>${money(r.fee)}</b></div>
      <div class="metric"><span>После расходов</span><b>${money(r.net)}</b></div>
    </div>
    <div class="market"><b>📊 Рынок</b><p>${marketText}</p><p>Диапазон: ${r.analogs.length?money(Math.min(...r.analogs))+' — '+money(Math.max(...r.analogs)):'нет данных'} · Аналогов: ${r.analogs.length}</p></div>
    <div class="market"><b>Почему такой score?</b><p>Учитываются потенциальная маржа, расходы, состояние товара и количество введённых аналогов. Score — расчётный ориентир, не прогноз продажи.</p></div>
    <div class="actions"><button class="smallBtn" id="favBtn">☆ В избранное</button><button class="smallBtn" id="saveBtn">Сохранить</button></div>`;
  el.classList.remove('hidden');
  const record={...r,id:Date.now(),url:$('#url').value.trim(),date:new Date().toLocaleString('ru-RU')};
  $('#saveBtn').onclick=()=>{state.history.unshift(record);state.history=state.history.slice(0,30);save();toast('Расчёт сохранён')};
  $('#favBtn').onclick=()=>{state.favorites.unshift(record);state.favorites=state.favorites.slice(0,30);save();toast('Добавлено в избранное')};
  state.history.unshift(record);state.history=state.history.slice(0,30);save();
  renderHistory();renderFavorites();
}
function renderHistory(){
  const box=$('#historyList'),empty=$('#emptyHistory');box.innerHTML='';
  empty.style.display=state.history.length?'none':'block';
  state.history.slice(0,20).forEach((r,i)=>box.insertAdjacentHTML('beforeend',`<div class="card"><div class="cardHead"><div><b>${r.label}</b><br><small>${r.date}</small></div><b>${r.score}/100</b></div><p>Покупка ${money(r.buy)} → расчёт ${money(r.sell)} → после расходов ${money(r.net)}</p></div>`));
}
function renderFavorites(){
  const box=$('#favoritesList'),empty=$('#emptyFavorites');box.innerHTML='';
  empty.style.display=state.favorites.length?'none':'block';
  state.favorites.forEach((r,i)=>box.insertAdjacentHTML('beforeend',`<div class="card"><div class="cardHead"><div><b>${r.label}</b><br><small>${r.date}</small></div><button class="delete" data-del="${i}">×</button></div><p>${money(r.buy)} → ${money(r.sell)} · ${r.score}/100</p></div>`));
  $$('#favoritesList [data-del]').forEach(b=>b.onclick=()=>{state.favorites.splice(+b.dataset.del,1);save();renderFavorites()});
}
function renderStats(){
  $('#statChecks').textContent=state.history.length;
  $('#statFav').textContent=state.favorites.length;
  $('#statAvg').textContent=state.history.length?Math.round(state.history.reduce((s,r)=>s+r.score,0)/state.history.length):0;
}
$$('.navItem').forEach(b=>b.onclick=()=>{$$('.navItem').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.screen').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.screen).classList.add('active');renderHistory();renderFavorites();renderStats()});
$('#toggleAdvanced').onclick=()=>{const a=$('#advanced');a.style.display=a.style.display==='none'?'block':'none';$('#chevron').textContent=a.style.display==='none'?'›':'⌄'};
$('#analyzeBtn').onclick=renderResult;
if(window.Telegram?.WebApp){Telegram.WebApp.ready();Telegram.WebApp.expand()}
renderHistory();renderFavorites();renderStats();
