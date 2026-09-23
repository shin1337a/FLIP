const state = {
  checks: Number(localStorage.getItem("flipChecks") || 0),
  saved: JSON.parse(localStorage.getItem("flipSaved") || "[]"),
  history: JSON.parse(localStorage.getItem("flipHistory") || "[]"),
  current: null,
  selectMode: {saved:false, history:false},
  selectedSaved: new Set(),
  selectedHistory: new Set()
};

const $ = id => document.getElementById(id);

function persist(){
  localStorage.setItem("flipChecks", state.checks);
  localStorage.setItem("flipSaved", JSON.stringify(state.saved));
  localStorage.setItem("flipHistory", JSON.stringify(state.history));
  updateStats();
}

function toast(message){
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => el.classList.remove("show"), 1800);
}

function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const screen = $(id);
  if(screen) screen.classList.add("active");

  document.querySelectorAll(".nav").forEach(n => {
    n.classList.toggle("active", n.dataset.nav === id);
  });

  window.scrollTo({top:0, behavior:"smooth"});
}

function updateStats(){
  $("checks").textContent = state.checks;
  $("savedCount").textContent = state.saved.length;
  $("historyCount").textContent = state.history.length;
}

function renderSaved(){
  const box = $("savedList");
  if(!state.saved.length){
    box.innerHTML = `<div class="card empty">♡<br><br>Здесь пока пусто.<br>Сохраняй интересные товары из результатов.</div>`;
    updateSelectionUI(); return;
  }
  box.innerHTML = state.saved.map((name, i) => `
    <div class="saved-item card selectable-item swipe-delete ${state.selectedSaved.has(i) ? "selected" : ""}">
      <div class="swipe-content">
        ${state.selectMode.saved ? `<input class="selection-check" type="checkbox" data-select-save="${i}" ${state.selectedSaved.has(i) ? "checked" : ""}>` : ""}
        <div class="item-icon">📱</div><div class="item-main"><b>${escapeHtml(name)}</b><span>Сохранено в FLIP</span></div>
        ${state.selectMode.saved ? "" : `<button class="delete-btn" data-delete-save="${i}">×</button>`}
      </div>
      <button class="swipe-action" data-swipe-delete-save="${i}">Удалить</button>
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
    <div class="history-item card selectable-item swipe-delete ${state.selectedHistory.has(i) ? "selected" : ""}">
      <div class="swipe-content">
        ${state.selectMode.history ? `<input class="selection-check" type="checkbox" data-select-history="${i}" ${state.selectedHistory.has(i) ? "checked" : ""}>` : ""}
        <div class="item-icon">🔎</div><div class="item-main"><b>${escapeHtml(item.product)}</b><span>${escapeHtml(item.domain)} · ${escapeHtml(item.time)} · ${item.net >= 0 ? "+" : ""}${item.net} BYN</span></div>
        ${state.selectMode.history ? "" : `<button class="delete-btn" data-delete-history="${i}">×</button>`}
      </div>
      <button class="swipe-action" data-swipe-delete-history="${i}">Удалить</button>
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
  [...set].sort((a,b)=>b-a).forEach(i=>type==="saved"?state.saved.splice(i,1):state.history.splice(i,1));
  set.clear(); state.selectMode[type]=false; persist(); type==="saved"?renderSaved():renderHistory(); toast("Выбранное удалено");
}
function bindSwipe(box,type){
  box.querySelectorAll(".swipe-delete").forEach(card=>{
    let sx=0,sy=0,moved=false;
    card.addEventListener("touchstart",e=>{if(state.selectMode[type])return;const t=e.touches[0];sx=t.clientX;sy=t.clientY;moved=false},{passive:true});
    card.addEventListener("touchmove",e=>{if(state.selectMode[type])return;const t=e.touches[0],dx=t.clientX-sx,dy=t.clientY-sy;if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy))moved=true},{passive:true});
    card.addEventListener("touchend",e=>{if(state.selectMode[type]||!moved)return;const ex=e.changedTouches[0].clientX;if(sx-ex>45)card.classList.add("swiped");else if(ex-sx>25)card.classList.remove("swiped")},{passive:true});
  });
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
    try{
      new URL(value);
    }catch{
      toast("Похоже, это не ссылка");
      return;
    }
  }

  const analysis = makeAnalysis(value);
  if(!analysis) return;

  state.checks++;
  state.current = analysis;
  $("saveResult").textContent = "♡ Сохранить в избранное";

  const r = state.current;
  $("resultSource").textContent = value
    ? `${r.domain} · предварительный расчёт`
    : "Ручной расчёт · без ссылки";
  $("resultProduct").textContent = r.product;
  $("buyPrice").textContent = `${r.buy.toLocaleString("ru-RU")} BYN`;
  $("marketPrice").textContent = `${r.market.toLocaleString("ru-RU")} BYN`;
  $("marketMeta").textContent = r.manualSell ? "введено вручную" : `по ${r.analogCount} аналогам`;
  $("gross").textContent = `${r.gross >= 0 ? "+" : ""}${r.gross.toLocaleString("ru-RU")} BYN`;
  $("net").textContent = `${r.net >= 0 ? "+" : ""}${r.net.toLocaleString("ru-RU")} BYN`;
  $("score").textContent = r.score;
  $("scoreLabel").textContent = r.label;
  $("riskBadge").textContent = r.risk;
  $("riskBadge").className = `risk ${r.riskClass}`;
  $("riskText").textContent = r.riskText;
  $("confidenceBadge").textContent = r.confidence;
  $("confidenceBadge").className = `risk ${r.confidenceClass}`;
  $("confidenceText").textContent = r.confidenceText;

  const historyItem = {
    product:r.product,
    domain:r.domain,
    gross:r.gross,
    net:r.net,
    time:new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})
  };
  state.history.unshift(historyItem);
  state.history = state.history.slice(0,20);
  persist();
  renderHistory();

  $("loading").classList.remove("hidden");
  $("resultContent").classList.add("hidden");
  showScreen("result");

  setTimeout(() => {
    $("loading").classList.add("hidden");
    $("resultContent").classList.remove("hidden");
    requestAnimationFrame(() => $("scoreBar").style.width = `${r.score}%`);
  }, 650);
}

function saveCurrent(){
  if(!state.current) return;
  const name = state.current.product;
  if(state.saved.includes(name)){
    state.saved = state.saved.filter(x => x !== name);
    $("saveResult").textContent = "♡ Сохранить в избранное";
    $("resultHeart").classList.remove("saved");
    $("resultHeart").textContent = "♡";
    persist();
    renderSaved();
    toast("Удалено из избранного");
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
    state.saved = state.saved.filter(x => x !== name);
    button.classList.remove("saved");
    button.textContent = "♡";
    toast("Удалено из избранного");
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
  const swipeSave=e.target.closest("[data-swipe-delete-save]");
  if(swipeSave){state.saved.splice(Number(swipeSave.dataset.swipeDeleteSave),1);persist();renderSaved();toast("Удалено");return;}
  const swipeHistory=e.target.closest("[data-swipe-delete-history]");
  if(swipeHistory){state.history.splice(Number(swipeHistory.dataset.swipeDeleteHistory),1);persist();renderHistory();toast("Удалено");return;}
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

document.querySelectorAll(".check-item input").forEach((box,i)=>{const key=`flipCheck_${i}`;box.checked=localStorage.getItem(key)==="1";box.addEventListener("change",()=>localStorage.setItem(key,box.checked?"1":"0"));});

updateStats();
renderSaved();
renderHistory();

// Если приложение открыто внутри Telegram Mini App, просим Telegram развернуть его.
if(window.Telegram && window.Telegram.WebApp){
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}
