const state = {
  checks: Number(localStorage.getItem("flipChecks") || 0),
  saved: JSON.parse(localStorage.getItem("flipSaved") || "[]"),
  history: JSON.parse(localStorage.getItem("flipHistory") || "[]"),
  current: null,
  selectMode: {saved:false, history:false},
  selectedSaved: new Set(),
  selectedHistory: new Set(),
  pendingFavoriteUndo: null
};

const $ = id => document.getElementById(id);

// Set this after creating the separate FLIP support Telegram account.
// Example: "FLIP_support" (without the @). Until then, the share flow remains available.
const SUPPORT_USERNAME = "flip_support1";
// Leave empty until a real FLIP backend is connected. Never put a Telegram bot token here.
const SUPPORT_ENDPOINT = "";

function persist(){
  localStorage.setItem("flipChecks", state.checks);
  localStorage.setItem("flipSaved", JSON.stringify(state.saved));
  localStorage.setItem("flipHistory", JSON.stringify(state.history));
  updateStats();
}

function toast(message, actionText = "", actionFn = null, duration = 1800){
  const el = $("toast");
  const messageEl = $("toastMessage");
  const actionEl = $("toastAction");
  if(!el || !messageEl) return;
  messageEl.textContent = message;
  clearTimeout(window.__toast);
  if(actionEl){
    actionEl.classList.toggle("hidden", !actionText);
    actionEl.textContent = actionText || "";
    actionEl.onclick = null;
    if(actionText && actionFn) actionEl.onclick = () => { el.classList.remove("show"); actionFn(); };
  }
  el.classList.add("show");
  window.__toast = setTimeout(() => {
    el.classList.remove("show");
    if(actionEl){ actionEl.classList.add("hidden"); actionEl.onclick = null; }
  }, duration);
}

function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const screen = $(id);
  if(screen) screen.classList.add("active");
  const footer = $("homeFooter");
  if(footer) footer.classList.toggle("hidden", id !== "home");

  document.querySelectorAll(".nav").forEach(n => {
    n.classList.toggle("active", n.dataset.nav === id);
  });

  if(id === "home") updateRecentCheck();
  window.scrollTo({top:0, behavior:"smooth"});
}

function updateProfileWelcome(){
  const box=$("profileWelcome"), title=$("profileWelcomeTitle"), text=$("profileWelcomeText");
  if(!box||!title||!text) return;
  const isNew=state.checks===0 && state.saved.length===0 && state.history.length===0;
  box.classList.toggle("hidden",!isNew);
  if(isNew){ title.textContent="Добро пожаловать в FLIP"; text.textContent="Здесь будут твои проверки, избранное и история."; }
}

function applyTheme(mode){
  const resolved=mode==="system" ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
  document.documentElement.dataset.theme=resolved;
  localStorage.setItem("flipTheme",mode);
  const select=$("themeSelect"); if(select) select.value=mode;
}

function updateStats(){
  $("checks").textContent = state.checks;
  $("savedCount").textContent = state.saved.length;
  $("historyCount").textContent = state.history.length;
  updateRecentCheck();
  updateProfileWelcome();
}

function updateRecentCheck(){
  const box=$("recentCheck");
  if(!box) return;
  const item=state.history[0];
  if(!item){ box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  $("recentProduct").textContent=item.product || "Последняя проверка";
  $("recentMeta").textContent=`${item.domain || "FLIP"} · ${item.time || "сейчас"}`;
  $("recentScore").textContent=item.score ? `${item.score}` : "—";
}

function updateResultChecklist(){
  const boxes=[...document.querySelectorAll('[data-check-group="result"]')].filter(el=>el.matches('input[type="checkbox"]'));
  if(!boxes.length) return;
  const done=boxes.filter(b=>b.checked).length;
  const pct=Math.round(done/boxes.length*100);
  $("resultCheckText").textContent=`${done} из ${boxes.length} выполнено`;
  $("resultCheckPercent").textContent=`${pct}%`;
  $("resultCheckBar").style.width=`${pct}%`;
  $("resultCheckDone").classList.toggle("hidden",done!==boxes.length);
}

function setScanStep(index){
  document.querySelectorAll(".scan-step").forEach((el,i)=>{
    el.classList.toggle("active",i<=index);
    el.classList.toggle("current",i===index);
  });
}

function playScan(hasManualData, done){
  const status=$("scanStatus");
  const messages=hasManualData
    ? ["Ссылка получена", "Проверяем введённые данные…", "Считаем показатели…", "Готово"]
    : ["Ссылка получена", "Проверяем формат ссылки…", "Готовим экран проверки…", "Готово — данных для расчёта пока нет"];
  let step=0;
  setScanStep(0);
  status.textContent=messages[0];
  const timer=setInterval(()=>{
    step++;
    setScanStep(Math.min(step,3));
    status.textContent=messages[Math.min(step,3)];
    if(step>=3){ clearInterval(timer); setTimeout(done,180); }
  },220);
}

function renderSaved(){
  const box = $("savedList");
  if(!state.saved.length){
    box.innerHTML = `<div class="card empty">♡<br><br>Здесь пока пусто.<br>Сохраняй интересные товары из результатов.</div>`;
    updateSelectionUI(); return;
  }
  box.innerHTML = state.saved.map((name, i) => `
    <div class="saved-item card selectable-item swipe-delete ${state.selectedSaved.has(i) ? "selected" : ""}" data-index="${i}">
      <div class="swipe-content">
        ${state.selectMode.saved ? `<input class="selection-check" type="checkbox" data-select-save="${i}" ${state.selectedSaved.has(i) ? "checked" : ""}>` : ""}
        <div class="item-icon">📱</div><div class="item-main"><b>${escapeHtml(name)}</b><span>Сохранено в FLIP</span></div>
      </div>
    </div>`).join("");
  bindSwipe(box,"saved"); updateSelectionUI();
}

function renderHistory(){
  const box = $("historyList");
  if(!state.history.length){
    box.innerHTML = `<div class="card empty">↺<br><br>История пока пустая.<br>Сделай первую проверку.</div>`;
    updateSelectionUI(); return;
  }
  box.innerHTML = state.history.map((item, i) => `
    <div class="history-item card selectable-item swipe-delete ${state.selectedHistory.has(i) ? "selected" : ""}" data-index="${i}">
      <div class="swipe-content">
        ${state.selectMode.history ? `<input class="selection-check" type="checkbox" data-select-history="${i}" ${state.selectedHistory.has(i) ? "checked" : ""}>` : ""}
        <div class="item-icon">🔎</div><div class="item-main"><b>${escapeHtml(item.product)}</b><span>${escapeHtml(item.domain)} · ${escapeHtml(item.time)} · ${item.score ? item.score + "/100" : (item.net >= 0 ? "+" : "") + item.net + " BYN"}</span></div>
      </div>
    </div>`).join("");
  bindSwipe(box,"history"); updateSelectionUI();
}

function updateSelectionUI(){
  $("savedToolbar")?.classList.toggle("hidden",!state.selectMode.saved);
  $("historyToolbar")?.classList.toggle("hidden",!state.selectMode.history);
  if($("savedSelectAll")) $("savedSelectAll").textContent = state.saved.length && state.selectedSaved.size===state.saved.length ? "Снять всё" : "Выбрать все";
  if($("historySelectAll")) $("historySelectAll").textContent = state.history.length && state.selectedHistory.size===state.history.length ? "Снять всё" : "Выбрать все";
}
function enterSelectMode(type){ state.selectMode[type]=true; type==="saved"?renderSaved():renderHistory(); }
function exitSelectMode(type){ state.selectMode[type]=false; type==="saved"?(state.selectedSaved.clear(),renderSaved()):(state.selectedHistory.clear(),renderHistory()); }
function toggleSelectAll(type){
  const set=type==="saved"?state.selectedSaved:state.selectedHistory, len=type==="saved"?state.saved.length:state.history.length;
  if(set.size===len)set.clear(); else {set.clear();for(let i=0;i<len;i++)set.add(i);}
  type==="saved"?renderSaved():renderHistory();
}
function deleteSelected(type){
  const set=type==="saved"?state.selectedSaved:state.selectedHistory;
  if(!set.size){toast("Сначала выбери элементы");return;}
  const indices=[...set].sort((a,b)=>a-b);
  if(type === "saved") {
    const removed=indices.map(i=>({index:i,value:state.saved[i]})).filter(x=>x.value!==undefined);
    removed.slice().sort((a,b)=>b.index-a.index).forEach(x=>state.saved.splice(x.index,1));
    set.clear(); state.selectMode.saved=false; persist(); renderSaved();
    armFavoriteUndo(removed,"Выбранное удалено из избранного");
    return;
  }
  indices.slice().sort((a,b)=>b-a).forEach(i=>state.history.splice(i,1));
  set.clear(); state.selectMode.history=false; persist(); renderHistory(); toast("Выбранное удалено");
}
function bindSwipe(box,type){
  box.querySelectorAll(".swipe-delete").forEach(card=>{
    let sx=0,sy=0,dx=0,moved=false,horizontal=false;
    card.addEventListener("touchstart",e=>{
      if(state.selectMode[type])return;
      const t=e.touches[0]; sx=t.clientX; sy=t.clientY; dx=0; moved=false; horizontal=false;
      card.classList.remove("swipe-dragging");
    },{passive:true});
    card.addEventListener("touchmove",e=>{
      if(state.selectMode[type])return;
      const t=e.touches[0];
      const rawX=t.clientX-sx, rawY=t.clientY-sy;
      if(!horizontal && Math.abs(rawX)>10 && Math.abs(rawX)>Math.abs(rawY)*1.15) horizontal=true;
      if(!horizontal)return;
      moved=true;
      if(rawX<0){
        dx=Math.max(rawX,-card.offsetWidth*0.92);
        card.classList.add("swipe-dragging");
        card.style.transform=`translateX(${dx}px)`;
        card.style.opacity=String(1-Math.min(Math.abs(dx)/(card.offsetWidth*1.15),.34));
      }
    },{passive:true});
    card.addEventListener("touchend",()=>{
      if(state.selectMode[type]||!moved||!horizontal)return;
      card.classList.remove("swipe-dragging");
      const threshold=Math.max(70,card.offsetWidth*.32);
      if(Math.abs(dx)>=threshold){
        const i=Number(card.dataset.index);
        const list=type==="saved"?state.saved:state.history;
        card.classList.add("swipe-removing");
        card.style.transform="translateX(-115%)";
        card.style.opacity="0";
        setTimeout(()=>{
          const removedValue=list[i];
          list.splice(i,1);
          persist();
          if(type === "saved"){
            renderSaved();
            armFavoriteUndo([{index:i,value:removedValue}],"Удалено из избранного");
          }else{
            renderHistory();
            toast("Удалено");
          }
        },220);
      }else{
        card.style.transform="translateX(0)";
        card.style.opacity="1";
      }
    },{passive:true});
  });
}

function armFavoriteUndo(removedItems, message="Удалено из избранного"){
  if(!removedItems?.length) return;
  if(state.pendingFavoriteUndo?.timer) clearTimeout(state.pendingFavoriteUndo.timer);
  const payload=removedItems.filter(x=>x && x.value!==undefined).map(x=>({index:Number(x.index),value:x.value}));
  if(!payload.length) return;
  const restore=()=>{
    payload.slice().sort((a,b)=>a.index-b.index).forEach(item=>{
      const safeIndex=Math.max(0,Math.min(item.index,state.saved.length));
      state.saved.splice(safeIndex,0,item.value);
    });
    state.pendingFavoriteUndo=null;
    persist(); renderSaved();
    toast("Вернули в избранное ❤️");
  };
  const timer=setTimeout(()=>{state.pendingFavoriteUndo=null;},5000);
  state.pendingFavoriteUndo={timer,payload};
  toast(message,"Вернуть",restore,5000);
}

function removeFavoriteByName(name){
  const index=state.saved.indexOf(name);
  if(index<0) return false;
  const value=state.saved[index];
  state.saved.splice(index,1);
  persist(); renderSaved();
  armFavoriteUndo([{index,value}],"Удалено из избранного");
  return true;
}

function getTelegramUser(){
  return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
}

function hashToHue(value){
  let hash=0; const text=String(value || "flip");
  for(let i=0;i<text.length;i++){ hash=((hash<<5)-hash)+text.charCodeAt(i); hash|=0; }
  return Math.abs(hash)%360;
}

function applyProfileAccent(hue){
  document.documentElement.style.setProperty("--profile-accent",`hsl(${hue} 72% 52%)`);
  document.documentElement.style.setProperty("--profile-accent-soft",`hsl(${hue} 80% 95%)`);
}

function extractAvatarColor(url,fallbackKey){
  applyProfileAccent(hashToHue(fallbackKey));
  if(!url) return;
  const img=new Image(); img.crossOrigin="anonymous";
  img.onload=()=>{
    try{
      const size=32,canvas=document.createElement("canvas"); canvas.width=size; canvas.height=size;
      const ctx=canvas.getContext("2d",{willReadFrequently:true}); ctx.drawImage(img,0,0,size,size);
      const data=ctx.getImageData(0,0,size,size).data; let r=0,g=0,b=0,count=0;
      for(let i=0;i<data.length;i+=4){
        if(data[i+3]<180) continue;
        const rr=data[i],gg=data[i+1],bb=data[i+2],mx=Math.max(rr,gg,bb),mn=Math.min(rr,gg,bb);
        if(mx-mn<18 || mx>245) continue; r+=rr;g+=gg;b+=bb;count++;
      }
      if(!count) return; r/=count;g/=count;b/=count; const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
      let h=0; if(d){ if(mx===r) h=((g-b)/d)%6; else if(mx===g) h=(b-r)/d+2; else h=(r-g)/d+4; h=Math.round(h*60); if(h<0)h+=360; }
      applyProfileAccent(h);
    }catch(_){}
  };
  img.src=url;
}

function updateTelegramProfile(){
  const user=getTelegramUser(),nameEl=$("profileName"),usernameEl=$("profileUsername"),idEl=$("profileId"),avatarEl=$("profileAvatar");
  if(!nameEl||!usernameEl||!idEl||!avatarEl) return;
  if(!user){
    nameEl.textContent="Пользователь Telegram"; usernameEl.textContent="Открой FLIP внутри Telegram"; idEl.textContent="ID будет показан внутри Mini App"; avatarEl.textContent="👤"; applyProfileAccent(215); return;
  }
  const fullName=[user.first_name,user.last_name].filter(Boolean).join(" ").trim() || (user.username?`@${user.username}`:"Пользователь Telegram");
  nameEl.textContent=fullName; usernameEl.textContent=user.username?`@${user.username}`:"Без username"; idEl.textContent=`Telegram ID: ${user.id}`;
  if(user.photo_url){ avatarEl.innerHTML=`<img src="${escapeHtml(user.photo_url)}" alt="Аватар">`; extractAvatarColor(user.photo_url,user.id); }
  else{ avatarEl.textContent=(user.first_name||"U").slice(0,1).toUpperCase(); extractAvatarColor("",user.id); }
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function domainFromUrl(value){
  try{
    const u = new URL(value);
    return u.hostname.replace(/^www\./,"");
  }catch{
    return "ссылка";
  }
}

function median(values){
  const a = values.filter(v => Number.isFinite(v) && v > 0).sort((x,y) => x-y);
  if(!a.length) return 0;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid-1] + a[mid]) / 2);
}

function getAnalogPrices(){
  return [1,2,3,4,5]
    .map(i => Number($(`analog${i}`).value || 0))
    .filter(v => v > 0);
}

function makeAnalysis(url){
  const cleanUrl = url.trim();
  const domain = cleanUrl ? domainFromUrl(cleanUrl) : "ручной расчёт";
  const buy = Number($("buyInput").value || 0);
  const manualSell = Number($("sellInput").value || 0);
  const analogs = getAnalogPrices();
  const marketFromAnalogs = median(analogs);
  const market = manualSell > 0 ? manualSell : marketFromAnalogs;
  const feePercent = Math.max(0, Math.min(100, Number($("feeInput").value || 5)));
  const condition = document.querySelector(".condition.active")?.dataset.condition || "good";

  if(buy <= 0){
    toast("Укажи цену покупки");
    return null;
  }

  if(manualSell <= 0 && analogs.length < 3){
    toast("Укажи цену продажи или минимум 3 аналога");
    return null;
  }

  if(market <= 0){
    toast("Не хватает данных для расчёта");
    return null;
  }

  const fee = Math.round(market * feePercent / 100);
  const gross = Math.round(market - buy);
  const net = Math.round(gross - fee);
  const margin = market ? gross / market : 0;
  const conditionBonus = condition === "good" ? 8 : condition === "used" ? 0 : -14;
  let score = Math.round(50 + margin * 70 + (net > 0 ? 15 : -25) + conditionBonus);
  score = Math.max(5, Math.min(98, score));

  let risk = "Средний", riskClass = "medium";
  if(score >= 78){ risk = "Низкий"; riskClass = "low"; }
  if(score < 50){ risk = "Высокий"; riskClass = "high"; }

  let label = "Есть что проверить";
  if(score >= 78) label = "Интересный потенциал";
  else if(score < 50) label = "Осторожно";

  const count = analogs.length;
  const spread = analogs.length > 1 ? Math.max(...analogs) - Math.min(...analogs) : 0;
  let confidence = "Низкая", confidenceClass = "high";
  if(count >= 5 && market > 0 && spread / market < 0.18){ confidence = "Высокая"; confidenceClass = "low"; }
  else if(count >= 3){ confidence = "Средняя"; confidenceClass = "medium"; }

  const confidenceText = manualSell > 0 && count === 0
    ? "Цена продажи указана вручную. Добавь аналоги, если хочешь сравнить её с рынком."
    : count < 3
      ? "Добавь минимум 3 похожих объявления для оценки рынка."
      : `Учтено ${count} аналогов. Медиана снижает влияние слишком дорогих и дешёвых объявлений.`;

  return {
    product:"Товар из объявления", domain, buy, market, gross, fee, net, feePercent,
    score, risk, riskClass, condition, label, manualSell: manualSell > 0, analogs, analogCount: count,
    confidence, confidenceClass, confidenceText,
    url: cleanUrl,
    riskText: condition === "bad"
      ? "Состояние заметно повышает риск. Сначала проверь дефекты и реальную цену продажи."
      : net > 0
        ? "Расчёт положительный, но перед покупкой нужно проверить товар и спрос."
        : "После расходов расчёт не даёт положительной разницы — проверь цену покупки и продажи."
  };
}

function runCheck(){
  const input = $("url");
  const value = input.value.trim();

  if(value){
    try{ new URL(value); }
    catch{ toast("Проверь ссылку — нужен полный адрес"); return; }
  }

  const hasManualData = Number($("buyInput").value || 0) > 0 || Number($("sellInput").value || 0) > 0 || getAnalogPrices().length > 0;
  let analysis;
  if(value && !hasManualData){
    analysis = {
      product:"Объявление по ссылке", domain:domainFromUrl(value), buy:0, market:0, gross:0, fee:0, net:0, feePercent:0,
      score:0, risk:"Нет данных", riskClass:"medium", condition:"good", label:"Ссылка принята",
      manualSell:false, analogs:[], analogCount:0, confidence:"Нет данных", confidenceClass:"medium",
      confidenceText:"FLIP получил ссылку. Для расчёта цены добавь цену покупки и минимум 3 аналога или укажи цену продажи вручную.",
      url:value, riskText:"Автоматического чтения цены и данных площадки в этой версии нет — FLIP не делает вид, что знает то, чего не получил."
    };
  }else{
    analysis = makeAnalysis(value);
    if(!analysis) return;
  }

  state.checks++;
  state.current = analysis;
  $("saveResult").textContent = "♡ Сохранить в избранное";

  const r = state.current;
  $("resultSource").textContent = value ? `${r.domain} · ссылка принята` : "Ручной расчёт · без ссылки";
  $("resultProduct").textContent = r.product;
  $("buyPrice").textContent = r.buy > 0 ? `${r.buy.toLocaleString("ru-RU")} BYN` : "—";
  $("marketPrice").textContent = r.market > 0 ? `${r.market.toLocaleString("ru-RU")} BYN` : "—";
  $("marketMeta").textContent = r.market > 0 ? (r.manualSell ? "введено вручную" : `по ${r.analogCount} аналогам`) : "данные ещё не указаны";
  $("gross").textContent = r.market > 0 ? `${r.gross >= 0 ? "+" : ""}${r.gross.toLocaleString("ru-RU")} BYN` : "—";
  $("net").textContent = r.market > 0 ? `${r.net >= 0 ? "+" : ""}${r.net.toLocaleString("ru-RU")} BYN` : "—";
  $("score").textContent = r.score > 0 ? r.score : "—";
  $("scoreLabel").textContent = r.label;
  $("scoreBar").style.width = "0%";
  $("riskBadge").textContent = r.risk;
  $("riskBadge").className = `risk ${r.riskClass}`;
  $("riskText").textContent = r.riskText;
  $("confidenceBadge").textContent = r.confidence;
  $("confidenceBadge").className = `risk ${r.confidenceClass}`;
  $("confidenceText").textContent = r.confidenceText;

  // Три понятных подоценки: они визуализируют уже имеющиеся данные, ничего не придумывая.
  const priceScore = r.buy > 0 && r.market > 0 ? Math.max(0,Math.min(100,Math.round((r.market-r.buy)/Math.max(r.market,1)*100+55))) : 0;
  const conditionScore = r.buy > 0 ? ({good:86,used:65,bad:42}[r.condition] || 60) : 0;
  const riskScore = r.market > 0 ? Math.max(0,Math.min(100,100-(r.riskClass==="high"?72:r.riskClass==="medium"?42:18))) : 0;
  $("priceScore").textContent=priceScore||"—"; $("priceScoreBar").style.width=`${priceScore}%`;
  $("conditionScore").textContent=conditionScore||"—"; $("conditionScoreBar").style.width=`${conditionScore}%`;
  $("riskScore").textContent=riskScore||"—"; $("riskScoreBar").style.width=`${riskScore}%`;

  const historyItem = {
    product:r.product, domain:r.domain, gross:r.gross, net:r.net, score:r.score,
    time:new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})
  };
  state.history.unshift(historyItem);
  state.history = state.history.slice(0,20);
  persist();
  renderHistory();

  $("loading").classList.remove("hidden");
  $("resultContent").classList.add("hidden");
  showScreen("result");
  updateResultChecklist();

  playScan(hasManualData,()=>{
    $("loading").classList.add("hidden");
    $("resultContent").classList.remove("hidden");
    requestAnimationFrame(()=>{
      $("scoreBar").style.width = `${r.score}%`;
      ["priceScoreBar","conditionScoreBar","riskScoreBar"].forEach(id=>{
        const el=$(id); if(el) el.style.width=el.style.width;
      });
    });
  });
}

function saveCurrent(){
  if(!state.current) return;
  const name = state.current.product;
  if(state.saved.includes(name)){
    $("saveResult").textContent = "♡ Сохранить в избранное";
    $("resultHeart").classList.remove("saved");
    $("resultHeart").textContent = "♡";
    removeFavoriteByName(name);
    return;
  }
  state.saved.unshift(name);
  $("saveResult").textContent = "✓ Сохранено в избранном";
  $("resultHeart").classList.add("saved");
  $("resultHeart").textContent = "♥";
  persist();
  renderSaved();
  toast("Добавлено в избранное ❤️");
}

function toggleDemoSave(button){
  const name = button.dataset.save;
  if(!state.saved.includes(name)){
    state.saved.unshift(name);
    button.classList.add("saved");
    button.textContent = "♥";
    toast("Добавлено в избранное ❤️");
  }else{
    button.classList.remove("saved");
    button.textContent = "♡";
    removeFavoriteByName(name);
    return;
  }
  persist();
  renderSaved();
}

$("checkBtn").addEventListener("click", runCheck);
$("url").addEventListener("input", () => {
  $("clearUrl").classList.toggle("hidden", !$("url").value);
});
$("url").addEventListener("keydown", e => {
  if(e.key === "Enter") runCheck();
});
$("clearUrl").addEventListener("click", () => {
  $("url").value = "";
  $("clearUrl").classList.add("hidden");
  $("url").focus();
});

const buyPhotoInput=$("buyPhotoInput");
const buyPhotoPreview=$("buyPhotoPreview");
buyPhotoInput?.addEventListener("change",()=>{
  const file=buyPhotoInput.files?.[0];
  if(!file){buyPhotoPreview?.classList.add("hidden");return;}
  const url=URL.createObjectURL(file);
  buyPhotoPreview.innerHTML=`<img src="${url}" alt="Фото объявления"><button type="button" class="mini-remove" id="removeBuyPhoto">×</button>`;
  buyPhotoPreview.classList.remove("hidden");
  $("removeBuyPhoto")?.addEventListener("click",()=>{buyPhotoInput.value="";buyPhotoPreview.classList.add("hidden");buyPhotoPreview.innerHTML="";});
});
$("buyStartCheck")?.addEventListener("click",()=>{
  const value=$("buyUrlInput")?.value.trim() || "";
  if(value){
    $("url").value=value;
    $("clearUrl").classList.remove("hidden");
    showScreen("home");
    setTimeout(runCheck,120);
  }else if(buyPhotoInput?.files?.length){
    toast("Фото добавлено — ссылка нужна для полной проверки");
  }else{
    toast("Добавь ссылку или фото объявления");
  }
});

document.querySelectorAll(".nav").forEach(btn => {
  btn.addEventListener("click", () => {
    showScreen(btn.dataset.nav);
    if(btn.dataset.nav === "saved") renderSaved();
    if(btn.dataset.nav === "history") renderHistory();
  });
});

document.querySelectorAll("[data-show]").forEach(btn => {
  btn.addEventListener("click", () => showScreen(btn.dataset.show));
});

document.addEventListener("click", e => {
  const selectSave=e.target.closest("[data-select-save]");
  if(selectSave){const i=Number(selectSave.dataset.selectSave);selectSave.checked?state.selectedSaved.add(i):state.selectedSaved.delete(i);selectSave.closest(".selectable-item")?.classList.toggle("selected",selectSave.checked);updateSelectionUI();return;}
  const selectHistory=e.target.closest("[data-select-history]");
  if(selectHistory){const i=Number(selectHistory.dataset.selectHistory);selectHistory.checked?state.selectedHistory.add(i):state.selectedHistory.delete(i);selectHistory.closest(".selectable-item")?.classList.toggle("selected",selectHistory.checked);updateSelectionUI();return;}
  const saveBtn = e.target.closest("[data-save]");
  if(saveBtn) toggleDemoSave(saveBtn);

  const delSave = e.target.closest("[data-delete-save]");
  if(delSave){
    state.saved.splice(Number(delSave.dataset.deleteSave),1);
    persist(); renderSaved(); toast("Удалено");
  }

  const delHistory = e.target.closest("[data-delete-history]");
  if(delHistory){
    state.history.splice(Number(delHistory.dataset.deleteHistory),1);
    persist(); renderHistory(); toast("Удалено");
  }
});

$("savedSelectMode").addEventListener("click",()=>state.selectMode.saved?exitSelectMode("saved"):enterSelectMode("saved"));
$("savedSelectAll").addEventListener("click",()=>toggleSelectAll("saved"));
$("savedDeleteSelected").addEventListener("click",()=>deleteSelected("saved"));
$("savedCancelSelect").addEventListener("click",()=>exitSelectMode("saved"));
$("historySelectMode").addEventListener("click",()=>state.selectMode.history?exitSelectMode("history"):enterSelectMode("history"));
$("historySelectAll").addEventListener("click",()=>toggleSelectAll("history"));
$("historyDeleteSelected").addEventListener("click",()=>deleteSelected("history"));
$("historyCancelSelect").addEventListener("click",()=>exitSelectMode("history"));

$("saveResult").addEventListener("click", saveCurrent);
$("resultHeart").addEventListener("click", saveCurrent);
$("clearHistory").addEventListener("click", () => {
  if(!state.history.length){ toast("История уже пустая"); return; }
  state.history = [];
  persist(); renderHistory(); toast("История очищена");
});

$("advancedToggle").addEventListener("click", () => {
  const form = $("advancedForm");
  form.classList.toggle("hidden");
  $("advancedToggle").textContent = form.classList.contains("hidden")
    ? "⚙️ Указать цены вручную"
    : "⌃ Скрыть дополнительные данные";
});

document.querySelectorAll(".condition").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".condition").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
  });
});

["buyInput","sellInput","feeInput"].forEach(id => {
  $(id).addEventListener("input", () => {
    const b = Number($("buyInput").value || 0);
    const s = Number($("sellInput").value || 0);
    if(b > 0 && s > 0 && $("advancedForm").classList.contains("hidden") === false){
      $("checkBtn").textContent = "⚡ Пересчитать";
    }
  });
});

document.querySelectorAll(".check-item input").forEach((box,i)=>{
  const group=box.dataset.checkGroup || (box.closest(".deal-steps")?"deal":box.closest("#buy")?"buy":"misc");
  const groupIndex=[...document.querySelectorAll(`.check-item input`)].filter(x=>(x.dataset.checkGroup || (x.closest(".deal-steps")?"deal":x.closest("#buy")?"buy":"misc"))===group).indexOf(box);
  const key=`flipCheck_${group}_${groupIndex}`;
  box.checked=localStorage.getItem(key)==="1";
  box.addEventListener("change",()=>{localStorage.setItem(key,box.checked?"1":"0"); if(group==="result") updateResultChecklist();});
});
updateResultChecklist();


function openInfo(type){
  const sheet=$( "infoSheet"), content=$( "infoContent" );
  if(!sheet || !content) return;
  if(type === "about"){
    content.innerHTML = `<div class="info-kicker">О FLIP</div><h3>Помощник для б/у покупок и продаж</h3><p>FLIP помогает проверить объявление, подготовиться к встрече, собрать объявление и не забыть важные шаги сделки.</p><div class="info-list"><div>🛒 Покупка — цена, риски и чек-лист.</div><div>📦 Продажа — текст объявления и ответы.</div><div>🛡️ Сделка — пошаговая проверка перед оплатой.</div></div>`;
  }else if(type === "trust"){
    content.innerHTML = `<div class="info-kicker">О БЕЗОПАСНОСТИ FLIP</div><h3>FLIP — сервис, которому можно доверять</h3><p>Мы создаём FLIP как безопасного помощника для покупок и продаж. Сервис не должен просить у тебя пароль Telegram, коды входа или данные банковской карты.</p><div class="info-list"><div>🔒 <b>Без лишних секретных данных.</b> FLIP не просит пароль Telegram или код подтверждения.</div><div>🧠 <b>Честные подсказки.</b> Мы показываем проверяемую информацию и прямо говорим, когда чего-то не можем подтвердить.</div><div>🛡️ <b>Фокус на безопасности.</b> FLIP помогает заметить подозрительные моменты и не забыть важные проверки.</div><div>🤝 <b>Прозрачность.</b> Мы не обещаем невозможного и не выдаём подсказки за гарантию того, что продавец или товар безопасны.</div></div><p class="info-note">Доверие к FLIP строится на понятных правилах: не просить лишние секретные данные, не скрывать ограничения сервиса и помогать пользователю принимать решение осознанно.</p>`;
  }else{
    content.innerHTML = `<div class="info-kicker">ПОДДЕРЖКА</div><h3>Нашёл ошибку или есть идея?</h3><p>Напиши сообщение прямо в FLIP и при необходимости прикрепи фото. Нажми одну кнопку — FLIP подготовит обращение для поддержки.</p><textarea id="supportText" class="support-textarea" placeholder="Напиши здесь ошибку, баг, предложение или идею..." aria-label="Описание проблемы"></textarea><div class="support-photo-row"><input id="supportPhotoInput" type="file" accept="image/*" class="file-input"><label for="supportPhotoInput" class="support-photo-btn"><span>＋</span><div><b>Прикрепить фото</b><small id="supportPhotoName">Скриншот или фото проблемы</small></div></label><div id="supportPhotoPreview" class="support-photo-preview hidden"></div></div><div class="support-actions"><button class="primary-btn" id="supportTelegram" type="button">Отправить в поддержку</button></div><div class="support-meta" id="supportMeta">Текст и фото должны отправляться напрямую через сервер FLIP. Пока серверная отправка не подключена, Telegram откроет чат поддержки с готовым текстом.</div>`;
    const makeReport=()=>{
      const text=$("supportText")?.value?.trim() || "Без описания";
      const screen=document.querySelector(".screen.active")?.id || "home";
      const photo=$("supportPhotoInput")?.files?.[0];
      return { text, screen, photo, report: `FLIP — обращение в поддержку\nВерсия: 1.8\nЭкран: ${screen}\nСсылка: ${location.href}\nФото: ${photo ? photo.name : "нет"}\n\nПроблема/идея: ${text}` };
    };
    const supportPhotoInput=$("supportPhotoInput"), supportPhotoName=$("supportPhotoName"), supportPhotoPreview=$("supportPhotoPreview"), supportBtn=$("supportTelegram"), supportMeta=$("supportMeta");
    supportPhotoInput?.addEventListener("change",()=>{ const f=supportPhotoInput.files?.[0]; if(supportPhotoName) supportPhotoName.textContent=f?f.name:"Скриншот или фото проблемы"; if(supportPhotoPreview){ if(f){ const url=URL.createObjectURL(f); supportPhotoPreview.innerHTML=`<img src="${url}" alt="Прикреплённое фото">`; supportPhotoPreview.classList.remove("hidden"); } else { supportPhotoPreview.innerHTML=""; supportPhotoPreview.classList.add("hidden"); } } });
    supportBtn?.addEventListener("click", async()=>{
      const {text, screen, photo, report}=makeReport();
      supportBtn.disabled=true;
      supportBtn.textContent="Отправляем…";
      try{
        if(SUPPORT_ENDPOINT){
          const fd=new FormData();
          fd.append("text",text); fd.append("screen",screen); fd.append("url",location.href); fd.append("version","1.8");
          if(photo) fd.append("photo",photo,photo.name);
          const res=await fetch(SUPPORT_ENDPOINT,{method:"POST",body:fd});
          if(!res.ok) throw new Error("support endpoint failed");
          supportBtn.textContent="Отправлено ✓";
          if(supportMeta) supportMeta.textContent="Обращение отправлено в поддержку FLIP.";
          return;
        }
        if(SUPPORT_USERNAME){
          const chatUrl=`https://t.me/${SUPPORT_USERNAME}?text=${encodeURIComponent(report)}`;
          if(window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(chatUrl); else window.open(chatUrl,"_blank");
        }else{
          const shareUrl=`https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(report)}`;
          if(window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(shareUrl); else window.open(shareUrl,"_blank");
        }
      }catch(e){
        if(supportMeta) supportMeta.textContent="Не удалось отправить автоматически. Проверь интернет и попробуй ещё раз.";
      }finally{
        if(supportBtn.textContent==="Отправляем…") { supportBtn.disabled=false; supportBtn.textContent="Отправить в поддержку"; }
      }
    });
  }
  sheet.classList.remove("hidden"); sheet.setAttribute("aria-hidden","false");
}

document.querySelectorAll("[data-footer-show]").forEach(btn=>btn.addEventListener("click",()=>showScreen(btn.dataset.footerShow)));
document.querySelectorAll("[data-footer-info]").forEach(btn=>btn.addEventListener("click",()=>openInfo(btn.dataset.footerInfo)));
document.querySelectorAll("[data-close-info]").forEach(btn=>btn.addEventListener("click",()=>{
  $("infoSheet").classList.add("hidden"); $("infoSheet").setAttribute("aria-hidden","true");
}));

const themeSelect=$("themeSelect");
if(themeSelect){
  const savedTheme=localStorage.getItem("flipTheme") || "system";
  applyTheme(savedTheme);
  themeSelect.addEventListener("change",()=>applyTheme(themeSelect.value));
}
const themeToggle=$("themeToggle");
if(themeToggle){
  const syncThemeToggle=()=>{ const current=document.documentElement.dataset.theme || "light"; themeToggle.classList.toggle("is-dark",current==="dark"); };
  syncThemeToggle();
  themeToggle.addEventListener("click",()=>{ const next=(document.documentElement.dataset.theme==="dark")?"light":"dark"; applyTheme(next); syncThemeToggle(); });
}
if(window.matchMedia){
  const media=window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener?.("change",()=>{ if((localStorage.getItem("flipTheme")||"system")==="system") applyTheme("system"); });
}

updateStats();
renderSaved();
renderHistory();

// Если приложение открыто внутри Telegram Mini App, просим Telegram развернуть его.
if(window.Telegram && window.Telegram.WebApp){
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  updateTelegramProfile();
}else{
  updateTelegramProfile();
}

$("recentOpen")?.addEventListener("click",()=>{ if(state.current){showScreen("result");$("loading").classList.add("hidden");$("resultContent").classList.remove("hidden");}else showScreen("history"); });
