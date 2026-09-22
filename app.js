const state = {
  checks: Number(localStorage.getItem("flipChecks") || 0),
  saved: JSON.parse(localStorage.getItem("flipSaved") || "[]"),
  history: JSON.parse(localStorage.getItem("flipHistory") || "[]"),
  current: null
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
    return;
  }

  box.innerHTML = state.saved.map((name, i) => `
    <div class="saved-item card">
      <div class="item-icon">📱</div>
      <div class="item-main"><b>${escapeHtml(name)}</b><span>Сохранено в FLIP</span></div>
      <button class="delete-btn" data-delete-save="${i}">×</button>
    </div>
  `).join("");
}

function renderHistory(){
  const box = $("historyList");
  if(!state.history.length){
    box.innerHTML = `<div class="card empty">↺<br><br>История пока пустая.<br>Сделай первую проверку.</div>`;
    return;
  }

  box.innerHTML = state.history.map((item, i) => `
    <div class="history-item card">
      <div class="item-icon">🔎</div>
      <div class="item-main">
        <b>${escapeHtml(item.product)}</b>
        <span>${escapeHtml(item.domain)} · ${escapeHtml(item.time)} · +${item.gross} BYN</span>
      </div>
      <button class="delete-btn" data-delete-history="${i}">×</button>
    </div>
  `).join("");
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

function makeDemoAnalysis(url){
  // Демо-логика: позже этот блок будет заменён реальным backend/API.
  const domain = domainFromUrl(url);
  const buy = 1250;
  const market = 1500;
  const gross = market - buy;
  const expenses = Math.round(market * 0.05);
  const net = gross - expenses;
  const score = 74;

  return {
    product:"iPhone 13 128GB",
    domain,
    buy, market, gross, net, score,
    risk:"Средний",
    riskClass:"medium",
    riskText:"Главный риск — состояние товара, комплект и реальная цена, по которой аналог действительно продаётся.",
    label:"Есть что проверить"
  };
}

function runCheck(){
  const input = $("url");
  const value = input.value.trim();

  if(!value){
    toast("Вставь ссылку на объявление");
    input.focus();
    return;
  }

  try{
    new URL(value);
  }catch{
    toast("Похоже, это не ссылка");
    return;
  }

  state.checks++;
  state.current = makeDemoAnalysis(value);
  const r = state.current;

  $("resultSource").textContent = `${r.domain} · демонстрационный расчёт`;
  $("resultProduct").textContent = r.product;
  $("buyPrice").textContent = `${r.buy.toLocaleString("ru-RU")} BYN`;
  $("marketPrice").textContent = `${r.market.toLocaleString("ru-RU")} BYN`;
  $("gross").textContent = `+${r.gross.toLocaleString("ru-RU")} BYN`;
  $("net").textContent = `+${r.net.toLocaleString("ru-RU")} BYN`;
  $("score").textContent = r.score;
  $("scoreLabel").textContent = r.label;
  $("riskBadge").textContent = r.risk;
  $("riskBadge").className = `risk ${r.riskClass}`;
  $("riskText").textContent = r.riskText;

  const historyItem = {
    product:r.product,
    domain:r.domain,
    gross:r.gross,
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
    toast("Уже в избранном");
    return;
  }
  state.saved.unshift(name);
  persist();
  renderSaved();
  toast("Добавлено в избранное ❤️");
  $("saveResult").textContent = "✓ Сохранено в избранном";
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

$("saveResult").addEventListener("click", saveCurrent);
$("clearHistory").addEventListener("click", () => {
  if(!state.history.length){ toast("История уже пустая"); return; }
  state.history = [];
  persist(); renderHistory(); toast("История очищена");
});

updateStats();
renderSaved();
renderHistory();

// Если приложение открыто внутри Telegram Mini App, просим Telegram развернуть его.
if(window.Telegram && window.Telegram.WebApp){
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}
