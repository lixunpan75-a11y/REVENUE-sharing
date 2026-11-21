(() => {
  'use strict';

  // Preserve custom split amounts while the main app rebuilds participant controls.
  const splitValues = new Map();
  const expenseDialog = document.querySelector('#expenseDialog');
  const rememberSplitValues = () => document.querySelectorAll('#customSplitFields .custom-amount').forEach(input => {
    if (input.value !== '') splitValues.set(input.dataset.member, input.value);
  });
  expenseDialog?.addEventListener('close', () => splitValues.clear());
  expenseDialog?.addEventListener('click', event => {
    if (!event.target.closest('#splitMembers input[type="checkbox"]')) return;
    rememberSplitValues();
    queueMicrotask(() => document.querySelectorAll('#customSplitFields .custom-amount').forEach(input => {
      if (!splitValues.has(input.dataset.member)) return;
      input.value = splitValues.get(input.dataset.member);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }));
  });
  expenseDialog?.addEventListener('input', event => {
    const input = event.target.closest('#customSplitFields .custom-amount');
    if (input) splitValues.set(input.dataset.member, input.value);
  });

  // Personal monthly ledger is intentionally separate from shared group balances.
  const STORAGE_KEY = 'fen-zhang-personal-v1';
  const categories = ['餐飲', '交通', '居家', '購物', '娛樂', '醫療', '學習', '其他'];
  const money = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 2 });
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const currentMonth = () => new Date().toISOString().slice(0, 7);
  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const toCents = value => {
    if (value === '' || value === null) return NaN;
    const number = Number(value);
    return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) : NaN;
  };
  const format = cents => money.format((cents || 0) / 100);
  const readLedger = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (value && Array.isArray(value.expenses) && value.budgets && typeof value.budgets === 'object') return value;
    } catch (error) { console.warn('無法讀取個人帳目，將以空白帳本開始。', error); }
    return { expenses: [], budgets: {} };
  };
  let ledger = readLedger();
  let month = currentMonth();
  const saveLedger = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger)); }
    catch (error) { showMessage('個人帳目無法儲存，請確認瀏覽器儲存空間。'); }
  };
  const showMessage = message => {
    const toast = document.querySelector('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showMessage.timer);
    showMessage.timer = setTimeout(() => toast.classList.remove('show'), 2600);
  };
  const getMonthExpenses = () => ledger.expenses.filter(expense => expense.date?.slice(0, 7) === month).sort((a, b) => b.date.localeCompare(a.date));

  function installStyles() {
    if (document.querySelector('#personalLedgerStyles')) return;
    const link = document.createElement('link');
    link.id = 'personalLedgerStyles';
    link.rel = 'stylesheet';
    link.href = 'personal.css';
    document.head.append(link);
  }
  function installUI() {
    const nav = document.querySelector('.tabs');
    const main = document.querySelector('.main-panel');
    if (!nav || !main || document.querySelector('#personalLedgerView')) return;
    const tab = document.createElement('button');
    tab.className = 'tab personal-tab';
    tab.type = 'button';
    tab.id = 'personalLedgerTab';
    tab.textContent = '個人帳目';
    nav.append(tab);

    const section = document.createElement('section');
    section.id = 'personalLedgerView';
    section.className = 'view-section hidden';
    section.setAttribute('aria-labelledby', 'personalLedgerTitle');
    section.innerHTML = `
      <div class="personal-intro"><div><span class="section-kicker">YOUR MONTHLY MONEY</span><h2 id="personalLedgerTitle">個人帳目管理</h2><p>記下自己的日常支出，掌握每月花費與預算。</p></div><span class="personal-intro-icon" aria-hidden="true">＄</span></div>
      <section class="surface personal-toolbar"><label for="personalMonth">查看月份</label><input id="personalMonth" type="month"><button id="addPersonalExpense" class="button button-primary" type="button">＋ 記錄支出</button></section>
      <form id="personalBudgetForm" class="surface personal-budget"><div><span class="section-kicker">MONTHLY BUDGET</span><h3>設定本月支出預算</h3><p>預算只作為個人追蹤，不影響分帳群組結算。</p></div><label class="budget-input-label" for="personalBudgetInput">每月預算（NT$）<span><input id="personalBudgetInput" type="number" min="0" step="0.01" inputmode="decimal" placeholder="例如 30000"></span></label><button class="button button-secondary" type="submit">儲存預算</button></section>
      <div id="personalStats" class="personal-stats"></div>
      <section class="surface personal-expenses"><div class="section-heading"><div><span class="section-kicker">MONTHLY RECORDS</span><h3 id="personalMonthHeading">本月支出明細</h3></div><span id="personalExpenseCount" class="personal-count"></span></div><div id="personalExpenseList"></div></section>
      <dialog id="personalExpenseDialog" class="app-dialog"><form id="personalExpenseForm" method="dialog"><div class="dialog-heading"><div><span class="section-kicker">PERSONAL EXPENSE</span><h2 id="personalExpenseDialogTitle">記錄個人支出</h2></div><button class="dialog-close" type="button" data-personal-close aria-label="關閉">×</button></div><input id="personalExpenseId" type="hidden"><label class="field-label" for="personalTitle">支出項目</label><input id="personalTitle" class="text-input" maxlength="70" placeholder="例如：午餐" required><div class="personal-form-grid"><div><label class="field-label" for="personalAmount">金額（NT$）</label><input id="personalAmount" class="text-input" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0" required></div><div><label class="field-label" for="personalDate">日期</label><input id="personalDate" class="text-input" type="date" required></div></div><label class="field-label" for="personalCategory">支出分類</label><select id="personalCategory" class="text-input">${categories.map(item => `<option>${item}</option>`).join('')}</select><label class="field-label" for="personalNote">備註 <span class="field-hint">選填</span></label><input id="personalNote" class="text-input" maxlength="160" placeholder="補充說明"><div id="personalExpenseError" class="error-message" role="alert"></div><div class="dialog-actions"><button class="button button-secondary" type="button" data-personal-close>取消</button><button class="button button-primary" type="submit">儲存支出</button></div></form></dialog>`;
    const footer = main.querySelector('.app-footer');
    footer ? main.insertBefore(section, footer) : main.append(section);
    installStyles();
    bindPersonalEvents();
    renderPersonal();
  }
  function renderPersonal() {
    const monthInput = document.querySelector('#personalMonth');
    if (!monthInput) return;
    monthInput.value = month;
    const expenses = getMonthExpenses();
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const budget = ledger.budgets[month] || 0;
    const remaining = budget - total;
    document.querySelector('#personalBudgetInput').value = budget ? (budget / 100).toFixed(2) : '';
    document.querySelector('#personalMonthHeading').textContent = `${Number(month.slice(5, 7))} 月支出明細`;
    document.querySelector('#personalExpenseCount').textContent = `${expenses.length} 筆紀錄`;
    const percent = budget > 0 ? Math.min(100, Math.round(total / budget * 100)) : 0;
    document.querySelector('#personalStats').innerHTML = `<article class="personal-stat"><span>本月支出</span><strong>${escapeHTML(format(total))}</strong><small>${expenses.length} 筆個人支出</small></article><article class="personal-stat"><span>每月預算</span><strong>${budget ? escapeHTML(format(budget)) : '尚未設定'}</strong><small>${budget ? `已使用 ${percent}%` : '設定預算掌握花費'}</small>${budget ? `<div class="budget-progress"><i style="width:${percent}%;${percent >= 100 ? 'background:#df7f68' : ''}"></i></div>` : ''}</article><article class="personal-stat ${budget && remaining < 0 ? 'over-budget' : ''}"><span>${budget ? (remaining >= 0 ? '預算剩餘' : '超出預算') : '本月紀錄'}</span><strong>${budget ? escapeHTML(format(Math.abs(remaining))) : `${expenses.length} 筆`}</strong><small>${budget ? (remaining >= 0 ? '可以繼續安心安排' : '本月支出已超出預算') : '每筆支出都會整理在這裡'}</small></article>`;
    const list = document.querySelector('#personalExpenseList');
    list.innerHTML = expenses.length ? expenses.map(expense => `<article class="personal-expense-row"><span class="personal-category-icon" aria-hidden="true">${categoryIcon(expense.category)}</span><div class="personal-expense-name"><strong>${escapeHTML(expense.title)}</strong><small>${escapeHTML(expense.date)}・${escapeHTML(expense.category)}${expense.note ? `・${escapeHTML(expense.note)}` : ''}</small></div><strong class="personal-expense-amount">${escapeHTML(format(expense.amount))}</strong><div class="personal-row-actions"><button class="small-action" type="button" data-personal-edit="${escapeHTML(expense.id)}">編輯</button><button class="small-action danger" type="button" data-personal-delete="${escapeHTML(expense.id)}">刪除</button></div></article>`).join('') : '<div class="empty-state"><span class="empty-icon">☘</span>這個月還沒有個人支出紀錄，新增一筆開始追蹤吧！</div>';
  }
  function categoryIcon(category) {
    return ({ '餐飲': '🍜', '交通': '🚌', '居家': '🏠', '購物': '🛍️', '娛樂': '🎟️', '醫療': '💊', '學習': '📚', '其他': '🧾' })[category] || '🧾';
  }
  function openPersonalDialog(expense = null) {
    const form = document.querySelector('#personalExpenseForm');
    form.reset();
    document.querySelector('#personalExpenseError').textContent = '';
    document.querySelector('#personalExpenseId').value = expense?.id || '';
    document.querySelector('#personalExpenseDialogTitle').textContent = expense ? '編輯個人支出' : '記錄個人支出';
    document.querySelector('#personalTitle').value = expense?.title || '';
    document.querySelector('#personalAmount').value = expense ? (expense.amount / 100).toFixed(2) : '';
    document.querySelector('#personalDate').value = expense?.date || `${month}-${today().slice(-2)}`;
    document.querySelector('#personalCategory').value = expense?.category || '其他';
    document.querySelector('#personalNote').value = expense?.note || '';
    document.querySelector('#personalExpenseDialog').showModal();
  }
  function savePersonalExpense(event) {
    event.preventDefault();
    const title = document.querySelector('#personalTitle').value.trim();
    const amount = toCents(document.querySelector('#personalAmount').value);
    const date = document.querySelector('#personalDate').value;
    const error = document.querySelector('#personalExpenseError');
    if (!title) { error.textContent = '請輸入支出項目。'; return; }
    if (!Number.isSafeInteger(amount) || amount <= 0) { error.textContent = '金額必須大於 0，最多可輸入到小數點後兩位。'; return; }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { error.textContent = '請選擇有效日期。'; return; }
    const id = document.querySelector('#personalExpenseId').value;
    const value = { id: id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, title, amount, date, category: document.querySelector('#personalCategory').value, note: document.querySelector('#personalNote').value.trim() };
    if (id) {
      const index = ledger.expenses.findIndex(expense => expense.id === id);
      if (index >= 0) ledger.expenses[index] = value;
    } else ledger.expenses.push(value);
    month = date.slice(0, 7);
    saveLedger(); renderPersonal(); document.querySelector('#personalExpenseDialog').close(); showMessage(id ? '個人支出已更新。' : '已新增個人支出。');
  }
  function bindPersonalEvents() {
    const tab = document.querySelector('#personalLedgerTab');
    const view = document.querySelector('#personalLedgerView');
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tabs .tab').forEach(item => item.classList.toggle('active', item === tab));
      document.querySelectorAll('.main-panel > .view-section').forEach(item => item.classList.toggle('hidden', item !== view));
      renderPersonal();
    });
    document.querySelectorAll('.tabs .tab:not(#personalLedgerTab)').forEach(item => item.addEventListener('click', () => {
      tab.classList.remove('active');
      view.classList.add('hidden');
    }, true));
    document.querySelector('#personalMonth').addEventListener('change', event => { if (event.target.value) { month = event.target.value; renderPersonal(); } });
    document.querySelector('#addPersonalExpense').addEventListener('click', () => openPersonalDialog());
    document.querySelector('#personalExpenseForm').addEventListener('submit', savePersonalExpense);
    document.querySelector('#personalBudgetForm').addEventListener('submit', event => {
      event.preventDefault();
      const raw = document.querySelector('#personalBudgetInput').value;
      const amount = raw === '' ? 0 : toCents(raw);
      if (!Number.isSafeInteger(amount) || amount < 0) return showMessage('請輸入有效的非負預算金額。');
      if (amount) ledger.budgets[month] = amount;
      else delete ledger.budgets[month];
      saveLedger(); renderPersonal(); showMessage(amount ? '本月預算已儲存。' : '已移除本月預算。');
    });
    document.querySelector('#personalExpenseList').addEventListener('click', event => {
      const edit = event.target.closest('[data-personal-edit]');
      const remove = event.target.closest('[data-personal-delete]');
      if (edit) openPersonalDialog(ledger.expenses.find(expense => expense.id === edit.dataset.personalEdit));
      if (remove) {
        const expense = ledger.expenses.find(item => item.id === remove.dataset.personalDelete);
        if (!expense || !confirm(`確定刪除「${expense.title}」這筆個人支出嗎？`)) return;
        ledger.expenses = ledger.expenses.filter(item => item.id !== expense.id);
        saveLedger(); renderPersonal(); showMessage('個人支出已刪除。');
      }
    });
    document.querySelectorAll('[data-personal-close]').forEach(button => button.addEventListener('click', () => document.querySelector('#personalExpenseDialog').close()));
    document.querySelector('#personalExpenseDialog').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installUI, { once: true });
  else installUI();
})();
