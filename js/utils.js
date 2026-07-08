function fmtMoney(amount, currencyCode) {
  const symbol = Store.currencySymbol(currencyCode || Store.state.settings.defaultCurrency);
  const n = Number(amount) || 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}${symbol}${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function groupSumByCurrency(items, amountFn) {
  const totals = {};
  items.forEach((item) => {
    const cur = item.currency || "SEK";
    totals[cur] = (totals[cur] || 0) + amountFn(item);
  });
  return totals;
}

function allCurrenciesInUse() {
  const set = new Set([Store.state.settings.defaultCurrency]);
  [...Store.state.debts, ...Store.state.goals, ...Store.state.transactions, ...Store.state.recurringIncomes].forEach((item) => {
    if (item.currency) set.add(item.currency);
  });
  Store.state.accounts.forEach((a) => {
    Object.keys(a.balances || {}).forEach((cur) => set.add(cur));
  });
  return Array.from(set);
}

function sumAccountBalances(currency) {
  return Store.state.accounts.reduce((sum, a) => sum + ((a.balances && a.balances[currency]) || 0), 0);
}

function nextOccurrence(dayOfMonth) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const clampDay = (year, month) => Math.min(dayOfMonth, new Date(year, month + 1, 0).getDate());
  let year = now.getFullYear();
  let month = now.getMonth();
  let day = clampDay(year, month);
  let candidate = new Date(year, month, day);
  if (candidate < now) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
    day = clampDay(year, month);
    candidate = new Date(year, month, day);
  }
  return `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(candidate.getDate()).padStart(2, "0")}`;
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function lastNMonthKeys(n) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function futureValueAnnuity(monthlyContribution, annualRatePct, months) {
  if (months <= 0 || monthlyContribution <= 0) return 0;
  const r = (annualRatePct || 0) / 100 / 12;
  if (r === 0) return monthlyContribution * months;
  return monthlyContribution * ((Math.pow(1 + r, months) - 1) / r);
}

function monthsToPayoff(balance, annualRatePct, monthlyPayment) {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return Infinity;
  const r = (annualRatePct || 0) / 100 / 12;
  if (r === 0) return Math.ceil(balance / monthlyPayment);
  if (monthlyPayment <= balance * r) return Infinity;
  const n = -Math.log(1 - (r * balance) / monthlyPayment) / Math.log(1 + r);
  return Math.ceil(n);
}

function addMonths(dateISO, months) {
  const d = new Date(dateISO + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d;
}

function monthsBetween(dateISOa, dateISOb) {
  const a = new Date(dateISOa.slice(0, 10) + "T00:00:00");
  const b = new Date(dateISOb.slice(0, 10) + "T00:00:00");
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function daysUntil(dateISO) {
  const target = new Date(dateISO + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2400);
}

function uid() {
  return crypto.randomUUID();
}

async function fetchMidMarketRate(date, from, to) {
  if (from === to) return 1;
  const tryUrl = async (url) => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const data = await resp.json();
      return (data.rates && data.rates[to]) || null;
    } catch (e) {
      return null;
    }
  };
  const historical = await tryUrl(`https://api.frankfurter.dev/v1/${date}?from=${from}&to=${to}`);
  if (historical) return historical;
  return tryUrl(`https://api.frankfurter.dev/v1/latest?from=${from}&to=${to}`);
}

function categoryIconLabel(name) {
  const icon = Store.state.appearance.categoryIcons[name];
  if (icon && !isImageIcon(icon)) return `${icon} ${escapeHtml(name)}`;
  return escapeHtml(name);
}

function categoryIconLabelHtml(name) {
  const icon = Store.state.appearance.categoryIcons[name];
  return icon ? `${iconDisplayHtml(icon, 16)} ${escapeHtml(name)}` : escapeHtml(name);
}

function currencyOptionsHtml(selected) {
  return CURRENCIES.map((c) => `<option value="${c.code}" ${c.code === selected ? "selected" : ""}>${c.code} (${c.symbol})</option>`).join("");
}

function accountOptionsHtml(selected) {
  const opts = Store.state.accounts.map((a) => `<option value="${a.id}" ${a.id === selected ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("");
  return `<option value="" ${!selected ? "selected" : ""}>No account</option>${opts}`;
}

function accountBadgeHtml(accountId) {
  const name = Store.accountName(accountId);
  return name ? `<span class="badge account">${escapeHtml(name)}</span>` : "";
}

function donutChartSvg({ percent, size = 72, stroke = 9, color = "var(--accent)", label = "" }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * clamp(percent, 0, 1);
  const center = size / 2;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="var(--donut-track)" stroke-width="${stroke}"></circle>
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="${filled} ${circumference - filled}" stroke-linecap="round"
        transform="rotate(-90 ${center} ${center})"></circle>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" class="donut-label">${escapeHtml(label)}</text>
    </svg>
  `;
}

const CHART_PALETTE = ["#5b7fa6", "#c1584f", "#5f8f6a", "#b8873f", "#8a6fa0", "#4f9a94", "#b06a91", "#7a9b57", "#4f80a6", "#a68a4f"];

function multiDonutSvg(slices, size = 160, stroke = 26) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="var(--donut-track)" stroke-width="${stroke}"></circle>
    </svg>`;
  }
  let offset = 0;
  const arcs = slices.map((s) => {
    const dash = circumference * (s.value / total);
    const circle = `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${s.color}" stroke-width="${stroke}"
      stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}"
      transform="rotate(-90 ${center} ${center})"></circle>`;
    offset += dash;
    return circle;
  }).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut">${arcs}</svg>`;
}
