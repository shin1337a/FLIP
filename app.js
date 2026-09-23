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
        <span>${escapeHtml(item.domain)} · ${escapeHtml(item.time)} · ${item.net >= 0 ? "+" : ""}${item.net} BYN</span>
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
  const domain = domainFromUrl(url);
  const buy = Number($("buyInput").value || 1250);
  const manualSell = Number($("sellInput").value || 0);
  const analogs = getAnalogPrices();
  const defaultAnalogs = [1450,1490,1550,1590,1620];
  const marketSamples = analogs.length ? analogs : defaultAnalogs;
  const marketFromAnalogs = median(marketSamples);
  const market = manualSell > 0 ? manualSell : marketFromAnalogs;
  const feePercent = Math.max(0, Math.min(100, Number($("feeInput").value || 5)));
  const condition = document.querySelector(".condition.active")?.dataset.condition || "good";

  if(buy <= 0 || market <= 0){
    toast("Укажи цену покупки больше 0");
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
  const spread = marketSamples.length > 1 ? Math.max(...marketSamples) - Math.min(...marketSamples) : 0;
  let confidence = "Низкая", confidenceClass = "high";
  if(count >= 5 && spread / market < 0.18){ confidence = "Высокая"; confidenceClass = "low"; }
  else if(count >= 3){ confidence = "Средняя"; confidenceClass = "medium"; }

  const confidenceText = count === 0
    ? "Использованы примерные цены. Добавь свои аналоги для реальной оценки."
    : count < 3
      ? `Сейчас учтено ${count} аналог${count === 1 ? '' : 'а'}. Добавь ещё, чтобы уменьшить погрешность.`
      : `Учтено ${count} аналогов. Медиана снижает влияние слишком дорогих и дешёвых объявлений.`;

  return {
    product:"Товар из объявления", domain, buy, market, gross, fee, net, feePercent,
    score, risk, riskClass, condition, label, manualSell: manualSell > 0, analogs: marketSamples, analogCount: count,
    confidence, confidenceClass, confidenceText,
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
  state.current = makeAnalysis(value);
  if(!state.current) return;
  $("saveResult").textContent = "♡ Сохранить в избранное";
  const r = state.current;

  $("resultSource").textContent = `${r.domain} · демонстрационный расчёт`;
  $("resultProduct").textContent = r.product;
  $("buyPrice").textContent = `${r.buy.toLocaleString("ru-RU")} BYN`;
  $("marketPrice").textContent = `${r.market.toLocaleString("ru-RU")} BYN`;
  $("marketMeta").textContent = r.manualSell ? "введено вручную" : `по ${r.analogCount || 5} аналогам`;
  $("gross").textContent = `+${r.gross.toLocaleString("ru-RU")} BYN`;
  $("net").textContent = `${r.net >= 0 ? "+" : ""}${r.net.toLocaleString("ru-RU")} BYN`;
  $("riskText").textContent = `${r.riskText} Расходы: ${r.feePercent}% (${r.fee.toLocaleString("ru-RU")} BYN).`;
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

updateStats();
renderSaved();
renderHistory();

// Если приложение открыто внутри Telegram Mini App, просим Telegram развернуть его.
if(window.Telegram && window.Telegram.WebApp){
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}
