const STORAGE_KEY = "financeTracker.v1";

const CURRENCIES = [
  { code: "SEK", symbol: "kr" },
  { code: "EUR", symbol: "€" },
  { code: "PHP", symbol: "₱" },
  { code: "USD", symbol: "$" },
  { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" },
  { code: "AUD", symbol: "A$" },
  { code: "CAD", symbol: "C$" },
];

function defaultState() {
  return {
    settings: {
      userName: "",
      defaultCurrency: "SEK",
      accentColor: "#2563eb",
      darkMode: false,
      netWorthCurrencies: ["SEK", "PHP"],
    },
    categories: {
      expense: ["Housing", "Utilities", "Groceries", "Transportation", "Dining Out", "Health", "Entertainment", "Shopping", "Subscriptions", "Insurance", "Education", "Family remittance", "Other"],
      income: ["Salary", "Allowance", "Freelance", "Business", "Gift", "Other"],
    },
    accounts: [
      { id: "acc-wise", name: "Wise", balances: {} },
      { id: "acc-revolut", name: "Revolut", balances: {} },
      { id: "acc-maribank", name: "Maribank", balances: {} },
    ],
    exchangeRates: [],
    debts: [],
    goals: [],
    transactions: [],
    transfers: [],
    recurringIncomes: [
      { id: "rec-salary", name: "Salary", amount: 0, currency: "SEK", category: "Salary", accountId: "acc-wise", dayOfMonth: 25 },
      { id: "rec-allowance", name: "Allowance", amount: 0, currency: "EUR", category: "Allowance", accountId: "acc-revolut", dayOfMonth: 15 },
    ],
    planning: {
      currency: "",
      monthlyIncome: 0,
      age: 25,
      retirementAge: 60,
      returnRatePct: 5,
      savingsRatePct: 15,
      needsPct: 50,
      wantsPct: 30,
      savingsPct: 20,
      efShortMonths: 3,
      efLongMonths: 6,
      inflationRatePct: 4,
    },
    remittances: [],
    investments: [],
    contributionPrograms: [
      { id: "prog-sss", name: "SSS", monthlyAmount: 0, currency: "PHP", dueDay: 30 },
      { id: "prog-philhealth", name: "PhilHealth", monthlyAmount: 0, currency: "PHP", dueDay: 30 },
      { id: "prog-pagibig", name: "Pag-IBIG", monthlyAmount: 0, currency: "PHP", dueDay: 10 },
      { id: "prog-pagibig-mp2", name: "Pag-IBIG MP2", monthlyAmount: 0, currency: "PHP", dueDay: 10 },
    ],
    contributionPayments: [],
    appearance: {
      appIcon: null,
      navIcons: {
        dashboard: "◆", debts: "◇", goals: "◈", expenses: "◉",
        remittances: "⇄", networth: "▦", contributions: "▣", planning: "◎", settings: "⚙",
      },
      debtCategoryIcons: {
        agency_fee: "🏢", five_six: "🤝", family_obligation: "❤️", personal_loan: "🏦", credit_card: "💳", other: "📄",
      },
      categoryIcons: {},
    },
  };
}

const ICON_CHOICES = [
  "◆", "◇", "◈", "◉", "◎", "⚙", "⇄", "▦", "▣", "●", "○", "■", "□", "▲", "▼", "★", "☆", "✦", "✚", "☰",
  "🏠", "🏢", "🏦", "💰", "💳", "💸", "📈", "📉", "📊", "🎯", "🎓", "✈️", "🚗", "🏥", "❤️", "👶", "🐾", "🎉",
  "🛒", "🍽️", "⚡", "📱", "🎁", "🤝", "📄", "🧳", "🏖️", "💍", "🔧", "📚",
];

const REMITTANCE_SERVICES = ["Wise", "Revolut", "Remitly", "Western Union", "InstaRemit", "PayPal", "Bank transfer", "Other"];
const OFW_DEBT_CATEGORIES = [
  { value: "agency_fee", label: "Agency / placement fee" },
  { value: "five_six", label: "“5-6” informal lending" },
  { value: "family_obligation", label: "Family obligation / support loan" },
  { value: "personal_loan", label: "Personal loan" },
  { value: "credit_card", label: "Credit card debt" },
  { value: "other", label: "Other" },
];

const Store = {
  state: null,

  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      this.state = defaultState();
      this.save();
      return this.state;
    }
    try {
      const parsed = JSON.parse(raw);
      this.state = Object.assign(defaultState(), parsed);
      this.state.settings = Object.assign(defaultState().settings, parsed.settings || {});
      this.state.categories = Object.assign(defaultState().categories, parsed.categories || {});
      this.migrate();
    } catch (e) {
      this.state = defaultState();
    }
    return this.state;
  },

  migrate() {
    const s = this.state;
    if (!Array.isArray(s.accounts) || s.accounts.length === 0) s.accounts = defaultState().accounts;
    s.accounts.forEach((a) => { if (!a.balances) a.balances = {}; });
    if (!Array.isArray(s.recurringIncomes)) s.recurringIncomes = [];
    if (!Array.isArray(s.exchangeRates)) s.exchangeRates = [];
    s.planning = Object.assign(defaultState().planning, s.planning || {});
    const fallbackCurrency = s.settings.defaultCurrency || "SEK";
    [...s.debts, ...s.goals, ...s.transactions].forEach((item) => {
      if (!item.currency) item.currency = fallbackCurrency;
      if (item.accountId === undefined) item.accountId = "";
    });
    s.debts.forEach((d) => {
      if (!d.debtType) d.debtType = "installment";
      if (d.creditLimit === undefined) d.creditLimit = 0;
      if (d.madPercent === undefined) d.madPercent = 5;
      if (!d.ofwCategory) d.ofwCategory = d.debtType === "revolving" ? "credit_card" : "personal_loan";
    });
    if (!Array.isArray(s.remittances)) s.remittances = [];
    if (!Array.isArray(s.transfers)) s.transfers = [];
    if (!Array.isArray(s.investments)) s.investments = [];
    if (!Array.isArray(s.contributionPrograms) || s.contributionPrograms.length === 0) s.contributionPrograms = defaultState().contributionPrograms;
    if (!Array.isArray(s.contributionPayments)) s.contributionPayments = [];
    const defaultAppearance = defaultState().appearance;
    s.appearance = Object.assign({}, defaultAppearance, s.appearance || {});
    s.appearance.navIcons = Object.assign({}, defaultAppearance.navIcons, s.appearance.navIcons || {});
    s.appearance.debtCategoryIcons = Object.assign({}, defaultAppearance.debtCategoryIcons, s.appearance.debtCategoryIcons || {});
    s.appearance.categoryIcons = s.appearance.categoryIcons || {};
    s.goals.forEach((g) => { if (g.icon === undefined) g.icon = ""; });
    this.save();
  },

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  },

  currencySymbol(code) {
    const found = CURRENCIES.find((c) => c.code === code);
    return found ? found.symbol : code || "";
  },

  accountName(id) {
    const acc = this.state.accounts.find((a) => a.id === id);
    return acc ? acc.name : "";
  },

  getRate(from, to) {
    if (from === to) return 1;
    const direct = this.state.exchangeRates.find((r) => r.from === from && r.to === to);
    if (direct) return direct.rate;
    const inverse = this.state.exchangeRates.find((r) => r.from === to && r.to === from);
    if (inverse && inverse.rate) return 1 / inverse.rate;
    return null;
  },

  setRate(from, to, rate) {
    if (from === to || !rate) return;
    const existing = this.state.exchangeRates.find((r) => r.from === from && r.to === to);
    if (existing) existing.rate = rate;
    else this.state.exchangeRates.push({ id: crypto.randomUUID(), from, to, rate });
    this.save();
  },

  removeRate(id) {
    this.state.exchangeRates = this.state.exchangeRates.filter((r) => r.id !== id);
    this.save();
  },

  convert(amount, from, to) {
    const rate = this.getRate(from, to);
    return rate === null ? null : +(amount * rate).toFixed(2);
  },

  addDebt(debt) {
    debt.id = crypto.randomUUID();
    debt.history = [];
    debt.createdAt = new Date().toISOString();
    this.state.debts.push(debt);
    this.save();
    return debt;
  },

  updateDebt(id, patch) {
    const debt = this.state.debts.find((d) => d.id === id);
    if (debt) Object.assign(debt, patch);
    this.save();
  },

  deleteDebt(id) {
    this.state.debts = this.state.debts.filter((d) => d.id !== id);
    this.save();
  },

  recordDebtPayment(id, amount, date, note, fromAccountId) {
    const debt = this.state.debts.find((d) => d.id === id);
    if (!debt) return;
    debt.history.push({ id: crypto.randomUUID(), amount, date, note: note || "", fromAccountId: fromAccountId || "" });
    debt.balance = Math.max(0, +(debt.balance - amount).toFixed(2));
    if (fromAccountId) this.adjustAccountBalance(fromAccountId, debt.currency, -amount);
    this.save();
  },

  addGoal(goal) {
    goal.id = crypto.randomUUID();
    goal.history = [];
    goal.createdAt = new Date().toISOString();
    this.state.goals.push(goal);
    this.save();
    return goal;
  },

  updateGoal(id, patch) {
    const goal = this.state.goals.find((g) => g.id === id);
    if (goal) Object.assign(goal, patch);
    this.save();
  },

  deleteGoal(id) {
    this.state.goals = this.state.goals.filter((g) => g.id !== id);
    this.save();
  },

  recordGoalContribution(id, amount, date, note, origin, fromAccountId) {
    const goal = this.state.goals.find((g) => g.id === id);
    if (!goal) return;
    const entry = { id: crypto.randomUUID(), amount, date, note: note || "" };
    if (origin && origin.currency && origin.currency !== goal.currency) {
      entry.originalAmount = origin.amount;
      entry.originalCurrency = origin.currency;
      entry.rate = origin.rate;
    }
    goal.history.push(entry);
    goal.currentAmount = +(goal.currentAmount + amount).toFixed(2);
    if (fromAccountId) {
      const sourceCurrency = (origin && origin.currency) || goal.currency;
      const sourceAmount = (origin && origin.amount) || amount;
      this.adjustAccountBalance(fromAccountId, sourceCurrency, -sourceAmount);
    }
    this.save();
  },

  recordGoalWithdrawal(id, amount, date, note, toAccountId) {
    const goal = this.state.goals.find((g) => g.id === id);
    if (!goal) return;
    const withdrawAmount = Math.min(amount, goal.currentAmount);
    goal.history.push({ id: crypto.randomUUID(), amount: -withdrawAmount, date, note: note || "" });
    goal.currentAmount = +(goal.currentAmount - withdrawAmount).toFixed(2);
    if (toAccountId) this.adjustAccountBalance(toAccountId, goal.currency, withdrawAmount);
    this.save();
  },

  addTransaction(txn) {
    txn.id = crypto.randomUUID();
    this.state.transactions.push(txn);
    this.applyTransactionToBalance(txn, 1);
    this.save();
    return txn;
  },

  updateTransaction(id, patch) {
    const txn = this.state.transactions.find((t) => t.id === id);
    if (!txn) return;
    this.applyTransactionToBalance(txn, -1);
    Object.assign(txn, patch);
    this.applyTransactionToBalance(txn, 1);
    this.save();
  },

  deleteTransaction(id) {
    const txn = this.state.transactions.find((t) => t.id === id);
    if (txn) this.applyTransactionToBalance(txn, -1);
    this.state.transactions = this.state.transactions.filter((t) => t.id !== id);
    this.save();
  },

  addTransfer(t) {
    t.id = crypto.randomUUID();
    this.state.transfers.push(t);
    this.adjustAccountBalance(t.fromAccountId, t.currency, -t.amount);
    this.adjustAccountBalance(t.toAccountId, t.currency, t.amount);
    this.save();
    return t;
  },

  deleteTransfer(id) {
    const t = this.state.transfers.find((x) => x.id === id);
    if (t) {
      this.adjustAccountBalance(t.fromAccountId, t.currency, t.amount);
      this.adjustAccountBalance(t.toAccountId, t.currency, -t.amount);
    }
    this.state.transfers = this.state.transfers.filter((x) => x.id !== id);
    this.save();
  },

  updatePlanning(patch) {
    Object.assign(this.state.planning, patch);
    this.save();
  },

  setAppIcon(dataUrl) {
    this.state.appearance.appIcon = dataUrl;
    this.save();
  },

  setNavIcon(view, icon) {
    this.state.appearance.navIcons[view] = icon;
    this.save();
  },

  setDebtCategoryIcon(category, icon) {
    this.state.appearance.debtCategoryIcons[category] = icon;
    this.save();
  },

  setCategoryIcon(categoryName, icon) {
    this.state.appearance.categoryIcons[categoryName] = icon;
    this.save();
  },

  applyRemittanceToBalance(r, sign) {
    if (!r.accountId) return;
    this.adjustAccountBalance(r.accountId, r.currency, -(r.amountSent + r.feePaid) * sign);
  },

  addRemittance(r) {
    r.id = crypto.randomUUID();
    this.state.remittances.push(r);
    this.applyRemittanceToBalance(r, 1);
    this.save();
    return r;
  },

  updateRemittance(id, patch) {
    const r = this.state.remittances.find((x) => x.id === id);
    if (!r) return;
    this.applyRemittanceToBalance(r, -1);
    Object.assign(r, patch);
    this.applyRemittanceToBalance(r, 1);
    this.save();
  },

  deleteRemittance(id) {
    const r = this.state.remittances.find((x) => x.id === id);
    if (r) this.applyRemittanceToBalance(r, -1);
    this.state.remittances = this.state.remittances.filter((x) => x.id !== id);
    this.save();
  },

  addInvestment(inv) {
    inv.id = crypto.randomUUID();
    this.state.investments.push(inv);
    this.save();
    return inv;
  },

  updateInvestment(id, patch) {
    const inv = this.state.investments.find((i) => i.id === id);
    if (inv) Object.assign(inv, patch);
    this.save();
  },

  deleteInvestment(id) {
    this.state.investments = this.state.investments.filter((i) => i.id !== id);
    this.save();
  },

  updateContributionProgram(id, patch) {
    const prog = this.state.contributionPrograms.find((p) => p.id === id);
    if (prog) Object.assign(prog, patch);
    this.save();
  },

  addContributionPayment(payment) {
    payment.id = crypto.randomUUID();
    this.state.contributionPayments.push(payment);
    this.save();
    return payment;
  },

  deleteContributionPayment(id) {
    this.state.contributionPayments = this.state.contributionPayments.filter((p) => p.id !== id);
    this.save();
  },

  addCategory(kind, name) {
    name = name.trim();
    if (!name) return;
    if (!this.state.categories[kind].includes(name)) {
      this.state.categories[kind].push(name);
      this.save();
    }
  },

  removeCategory(kind, name) {
    this.state.categories[kind] = this.state.categories[kind].filter((c) => c !== name);
    this.save();
  },

  addAccount(name) {
    name = name.trim();
    if (!name) return;
    if (this.state.accounts.some((a) => a.name.toLowerCase() === name.toLowerCase())) return;
    this.state.accounts.push({ id: crypto.randomUUID(), name, balances: {} });
    this.save();
  },

  removeAccount(id) {
    this.state.accounts = this.state.accounts.filter((a) => a.id !== id);
    [...this.state.debts, ...this.state.goals, ...this.state.transactions, ...this.state.recurringIncomes].forEach((item) => {
      if (item.accountId === id) item.accountId = "";
    });
    this.save();
  },

  updateAccountBalances(id, balances) {
    const acc = this.state.accounts.find((a) => a.id === id);
    if (acc) acc.balances = balances;
    this.save();
  },

  adjustAccountBalance(accountId, currency, delta) {
    if (!accountId || !delta) return;
    const acc = this.state.accounts.find((a) => a.id === accountId);
    if (!acc) return;
    if (!acc.balances) acc.balances = {};
    acc.balances[currency] = +((acc.balances[currency] || 0) + delta).toFixed(2);
  },

  applyTransactionToBalance(txn, sign) {
    if (!txn.accountId) return;
    const delta = (txn.type === "income" ? txn.amount : -txn.amount) * sign;
    this.adjustAccountBalance(txn.accountId, txn.currency, delta);
  },

  addRecurringIncome(entry) {
    entry.id = crypto.randomUUID();
    this.state.recurringIncomes.push(entry);
    this.save();
    return entry;
  },

  updateRecurringIncome(id, patch) {
    const entry = this.state.recurringIncomes.find((r) => r.id === id);
    if (entry) Object.assign(entry, patch);
    this.save();
  },

  deleteRecurringIncome(id) {
    this.state.recurringIncomes = this.state.recurringIncomes.filter((r) => r.id !== id);
    this.save();
  },

  exportBackup() {
    const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `money-tracker-backup-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importBackup(file, onDone) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        this.state = Object.assign(defaultState(), parsed);
        this.state.settings = Object.assign(defaultState().settings, parsed.settings || {});
        this.state.categories = Object.assign(defaultState().categories, parsed.categories || {});
        this.migrate();
        onDone(true);
      } catch (e) {
        onDone(false);
      }
    };
    reader.readAsText(file);
  },

  resetAll() {
    this.state = defaultState();
    this.save();
  },
};
