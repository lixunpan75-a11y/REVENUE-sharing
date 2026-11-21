(() => {
  'use strict';

  const STORAGE_KEY = 'fen-zhang-helper-v1';
  const currency = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 2 });
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const formatMoney = cents => currency.format((cents || 0) / 100);
  const formatCompactMoney = cents => currency.format((cents || 0) / 100);
  const firstCharacter = name => [...String(name || '?')][0];
  let toastTimer;
  let activeView = 'overview';

  function demoData() {
    const members = [
      { id: 'm1', name: '小安' }, { id: 'm2', name: '阿哲' },
      { id: 'm3', name: '小美' }, { id: 'm4', name: '阿凱' }
    ];
    const group = { id: 'g-demo', name: '墾丁慢旅行', emoji: '🏝️', members, expenses: [], settlements: [] };
    const earlier = offsetDate(-1);
    group.expenses = [
      { id: 'e1', title: '海景民宿', amount: 720000, payerId: 'm1', date: offsetDate(-2), note: '兩晚住宿，大家一起平分', splitMode: 'equal', splits: { m1: 180000, m2: 180000, m3: 180000, m4: 180000 } },
      { id: 'e2', title: '海鮮晚餐', amount: 248000, payerId: 'm2', date: earlier, note: '墾丁大街的晚餐', splitMode: 'equal', splits: { m1: 62000, m2: 62000, m3: 62000, m4: 62000 } },
      { id: 'e3', title: '沿途補給飲料', amount: 76000, payerId: 'm3', date: earlier, note: '小安和小美買的飲料', splitMode: 'equal', splits: { m1: 38000, m3: 38000 } },
      { id: 'e4', title: '租車加油', amount: 120000, payerId: 'm4', date: today(), note: '回程加滿油', splitMode: 'equal', splits: { m1: 30000, m2: 30000, m3: 30000, m4: 30000 } }
    ];
    return { groups: [group], activeGroupId: group.id };
  }
  function offsetDate(offset) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored && Array.isArray(stored.groups) && stored.groups.every(group =>
        group && Array.isArray(group.members) && Array.isArray(group.expenses) && Array.isArray(group.settlements || []))) return stored;
    } catch (error) {
      console.warn('無法讀取本機資料，改用示範資料。', error);
    }
    return demoData();
  }
  let state = loadState();
  const group = () => state.groups.find(item => item.id === state.activeGroupId) || state.groups[0];
  const memberById = (id, current = group()) => current?.members.find(member => member.id === id);
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { notify('無法儲存資料，請確認瀏覽器的本機儲存空間。'); }
  }
  function notify(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }
  function centsFromInput(value) {
    if (value === '' || value === null) return NaN;
    const number = Number(value);
    return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) : NaN;
  }
  function balancesFor(current = group()) {
    const result = new Map(current.members.map(member => [member.id, { member, paid: 0, share: 0, net: 0 }]));
    current.expenses.forEach(expense => {
      if (result.has(expense.payerId)) result.get(expense.payerId).paid += expense.amount;
      Object.entries(expense.splits || {}).forEach(([id, amount]) => {
        if (result.has(id)) result.get(id).share += amount;
      });
    });
    result.forEach(balance => { balance.net = balance.paid - balance.share; });
    return [...result.values()];
  }
  function suggestionsFor(current = group()) {
    const balances = balancesFor(current).map(item => ({ id: item.member.id, name: item.member.name, net: item.net }));
    (current.settlements || []).filter(item => item.completed).forEach(item => {
      const debtor = balances.find(balance => balance.id === item.fromId);
      const creditor = balances.find(balance => balance.id === item.toId);
      if (debtor && creditor) { debtor.net += item.amount; creditor.net -= item.amount; }
    });
    const debtors = balances.filter(item => item.net < 0).map(item => ({ ...item, net: -item.net })).sort((a, b) => b.net - a.net);
    const creditors = balances.filter(item => item.net > 0).map(item => ({ ...item })).sort((a, b) => b.net - a.net);
    const result = [];
    let debtorIndex = 0;
    let creditorIndex = 0;
    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amount = Math.min(debtor.net, creditor.net);
      if (amount > 0) result.push({ id: `${debtor.id}-${creditor.id}`, fromId: debtor.id, toId: creditor.id, fromName: debtor.name, toName: creditor.name, amount });
      debtor.net -= amount;
      creditor.net -= amount;
      if (debtor.net === 0) debtorIndex++;
      if (creditor.net === 0) creditorIndex++;
    }
    return result;
  }
  function transferRows() {
    const completed = (group().settlements || []).filter(item => item.completed).map(item => ({
      ...item, completed: true,
      fromName: memberById(item.fromId)?.name || '已移除成員',
      toName: memberById(item.toId)?.name || '已移除成員'
    }));
    return [...completed, ...suggestionsFor().map(item => ({ ...item, completed: false }))];
  }
  function totalSpent(current = group()) { return current.expenses.reduce((sum, expense) => sum + expense.amount, 0); }

  function render() {
    if (!state.groups.length) state = demoData();
    if (!state.groups.some(item => item.id === state.activeGroupId)) state.activeGroupId = state.groups[0].id;
    renderGroups();
    renderGroup();
    renderView();
  }
  function renderGroups() {
    const root = $('#groupList');
    root.innerHTML = state.groups.map(item => `<button class="group-item ${item.id === group().id ? 'active' : ''}" data-group="${escapeHTML(item.id)}" type="button"><span class="group-mini-emoji">${item.emoji || '🌿'}</span><span><strong>${escapeHTML(item.name)}</strong><small>${item.members.length} 位成員・${item.expenses.length} 筆費用</small></span></button>`).join('');
    $$('[data-group]', root).forEach(button => button.addEventListener('click', () => {
      state.activeGroupId = button.dataset.group;
      save(); render();
    }));
  }
  function renderGroup() {
    const current = group();
    $('#groupName').textContent = current.name;
    $('#groupEmoji').textContent = current.emoji || '🌿';
    $('#groupMeta').textContent = `${current.members.length} 位成員・${current.expenses.length} 筆費用・建立你的美好回憶`;
    $('#heroTotal').textContent = formatCompactMoney(totalSpent(current));
    $('#expenseTabCount').textContent = current.expenses.length;
    const suggestions = suggestionsFor(current);
    $('#summaryCards').innerHTML = `<article class="summary-card highlight"><span class="summary-icon">✿</span><span class="summary-label">群組總花費</span><strong class="summary-value">${escapeHTML(formatCompactMoney(totalSpent(current)))}</strong><span class="summary-sub">共 ${current.expenses.length} 筆費用</span></article><article class="summary-card"><span class="summary-icon">♧</span><span class="summary-label">群組成員</span><strong class="summary-value">${current.members.length}<small style="font-size:12px;font-weight:500"> 位</small></strong><span class="summary-sub">一起分帳的好夥伴</span></article><article class="summary-card"><span class="summary-icon">♡</span><span class="summary-label">尚未結清</span><strong class="summary-value">${escapeHTML(formatCompactMoney(suggestions.reduce((sum, item) => sum + item.amount, 0)))}</strong><span class="summary-sub">${suggestions.length} 筆待還款</span></article>`;
    $('#balanceList').innerHTML = current.members.length ? balancesFor(current).map((balance, index) => `<div class="balance-row"><div class="balance-member"><span class="member-avatar color-${index % 4}">${escapeHTML(firstCharacter(balance.member.name))}</span>${escapeHTML(balance.member.name)}</div><span class="balance-number">${escapeHTML(formatCompactMoney(balance.paid))}</span><span class="balance-number">${escapeHTML(formatCompactMoney(balance.share))}</span><span class="balance-net ${balance.net > 0 ? 'net-positive' : balance.net < 0 ? 'net-negative' : 'net-zero'}">${balance.net > 0 ? '+' : ''}${escapeHTML(formatCompactMoney(balance.net))}</span></div>`).join('') : '<div class="empty-state">先新增成員與費用，這裡就會出現每個人的分帳狀況。</div>';
    $('#settlementPreview').innerHTML = renderSettlementPreview();
    const recent = [...current.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    $('#recentExpenses').innerHTML = renderExpenseRows(recent, false);
    $('#expenseList').innerHTML = renderExpenseRows([...current.expenses].sort((a, b) => b.date.localeCompare(a.date)), true);
  }
  function renderSettlementPreview() {
    const rows = transferRows();
    if (!rows.length) return '<div class="empty-state"><span class="empty-icon">♡</span>目前大家的帳都結清了！</div>';
    return rows.slice(0, 4).map(item => `<div class="settlement-item"><div class="settlement-route"><span class="route-person">${escapeHTML(item.fromName)}</span><span class="route-arrow">→</span><span class="route-person">${escapeHTML(item.toName)}</span><strong class="route-amount">${escapeHTML(formatCompactMoney(item.amount))}</strong></div><span class="settlement-state ${item.completed ? 'state-complete' : 'state-pending'}">${item.completed ? '已完成' : '待還款'}</span></div>`).join('');
  }
  function expenseIcon(title) {
    if (/餐|飯|咖啡|飲|食|早餐|晚餐|午餐/.test(title)) return '🍜';
    if (/住|民宿|飯店/.test(title)) return '🛏️';
    if (/車|油|交通|租/.test(title)) return '🚗';
    if (/票|門票|活動/.test(title)) return '🎟️';
    if (/買|補給|用品/.test(title)) return '🛍️';
    return '🧾';
  }
  function dateLabel(value) {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  function renderExpenseRows(expenses, actions) {
    if (!expenses.length) return '<div class="empty-state"><span class="empty-icon">🧾</span>還沒有費用紀錄。新增第一筆，開始一起分帳吧！</div>';
    return expenses.map(expense => {
      const payer = memberById(expense.payerId)?.name || '已移除成員';
      const names = Object.keys(expense.splits || {}).map(id => memberById(id)?.name).filter(Boolean);
      return `<article class="expense-row"><div class="expense-main"><span class="expense-icon">${expenseIcon(expense.title)}</span><span><strong>${escapeHTML(expense.title)}</strong><small>${escapeHTML(dateLabel(expense.date))}・${escapeHTML(payer)} 付款</small></span></div><div class="expense-meta"><strong>分攤對象</strong><br>${escapeHTML(names.join('、') || '—')}</div><div class="expense-meta"><strong>分攤方式</strong><br>${expense.splitMode === 'custom' ? '自訂金額' : '平均分攤'}${expense.note ? `・${escapeHTML(expense.note)}` : ''}</div><strong class="expense-amount">${escapeHTML(formatMoney(expense.amount))}</strong>${actions ? `<div class="expense-actions"><button class="small-action" data-edit-expense="${escapeHTML(expense.id)}" type="button">編輯</button><button class="small-action danger" data-delete-expense="${escapeHTML(expense.id)}" type="button">刪除</button></div>` : ''}</article>`;
    }).join('');
  }
  function renderView() {
    const views = { overview: '#overviewView', expenses: '#expensesView', settlements: '#settlementsView' };
    Object.entries(views).forEach(([name, selector]) => $(selector).classList.toggle('hidden', activeView !== name));
    $$('.tab').forEach(button => button.classList.toggle('active', button.dataset.view === activeView));
    if (activeView === 'settlements') renderSettlementList();
  }
  function renderSettlementList() {
    const rows = transferRows();
    const pending = rows.filter(item => !item.completed).length;
    const badge = $('#settlementStatus');
    badge.textContent = pending ? `${pending} 筆待還款` : '全部結清';
    badge.classList.toggle('all-done', !pending);
    $('#settlementList').innerHTML = rows.length ? rows.map(item => `<div class="settlement-large"><div class="settlement-route"><span class="member-avatar">${escapeHTML(firstCharacter(item.fromName))}</span><span class="route-person">${escapeHTML(item.fromName)}</span><span class="route-arrow">→</span><span class="member-avatar">${escapeHTML(firstCharacter(item.toName))}</span><span class="route-person">${escapeHTML(item.toName)}</span></div><div class="settlement-large-right"><strong class="route-amount">${escapeHTML(formatMoney(item.amount))}</strong><span class="settlement-state ${item.completed ? 'state-complete' : 'state-pending'}">${item.completed ? '已完成' : '待還款'}</span>${!item.completed ? `<button class="small-action" data-settle="${escapeHTML(item.id)}" type="button">✓ 標記完成</button>` : ''}</div></div>`).join('') : '<div class="empty-state"><span class="empty-icon">♡</span>目前大家的帳都結清了！新增費用後，還款建議會自動出現在這裡。</div>';
  }
  function switchView(view) {
    activeView = view;
    renderView();
    if (innerWidth < 680) $(`#${{ overview: 'overviewView', expenses: 'expensesView', settlements: 'settlementsView' }[view]}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function openDialog(id) { const dialog = $(`#${id}`); if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', ''); }
  function closeDialog(id) { const dialog = $(`#${id}`); if (dialog.close) dialog.close(); else dialog.removeAttribute('open'); }

  // Keep the member label, textarea, and hint together so edit mode hides the complete field.
  function setupGroupMemberField() {
    const input = $('#groupMembersInput');
    const label = $('label[for="groupMembersInput"]');
    const hint = input.nextElementSibling;
    const wrapper = document.createElement('div');
    wrapper.id = 'groupMembersField';
    label.before(wrapper);
    wrapper.append(label, input);
    if (hint?.classList.contains('form-hint')) wrapper.append(hint);
  }
  function openGroupDialog(edit = false) {
    const current = group();
    $('#groupDialogTitle').textContent = edit ? '編輯群組名稱' : '建立分帳群組';
    $('#groupNameInput').value = edit ? current.name : '';
    $('#groupNameInput').dataset.edit = String(edit);
    $('#groupMembersField').classList.toggle('hidden', edit);
    $('#groupMembersInput').value = edit ? current.members.map(member => member.name).join('\n') : '';
    openDialog('groupDialog');
  }
  function submitGroup(event) {
    event.preventDefault();
    const name = $('#groupNameInput').value.trim();
    const editing = $('#groupNameInput').dataset.edit === 'true';
    if (!name) return notify('請輸入活動名稱。');
    if (editing) {
      group().name = name;
      save(); render(); closeDialog('groupDialog'); notify('群組名稱已更新！');
      return;
    }
    const names = $('#groupMembersInput').value.split(/[\n,，、]/).map(value => value.trim()).filter(Boolean);
    const uniqueNames = [...new Set(names)];
    if (uniqueNames.length < 2) return notify('請至少輸入兩位不同的成員，才能開始分帳。');
    const created = { id: uid(), name, emoji: ['🌿', '🏕️', '🍲', '🎉'][state.groups.length % 4], members: uniqueNames.map(memberName => ({ id: uid(), name: memberName })), expenses: [], settlements: [] };
    state.groups.push(created);
    state.activeGroupId = created.id;
    activeView = 'overview';
    save(); render(); closeDialog('groupDialog'); notify('新群組建立完成！');
  }
  function openMembersDialog() {
    $('#memberManagementList').innerHTML = group().members.map((member, index) => `<div class="manage-member"><span><span class="member-avatar color-${index % 4}" style="display:inline-grid;vertical-align:middle;margin-right:7px">${escapeHTML(firstCharacter(member.name))}</span>${escapeHTML(member.name)}</span><button type="button" data-remove-member="${escapeHTML(member.id)}">移除</button></div>`).join('');
    $$('[data-remove-member]').forEach(button => button.addEventListener('click', () => removeMember(button.dataset.removeMember)));
    $('#newMemberInput').value = '';
    openDialog('membersDialog');
  }
  function removeMember(id) {
    const current = group();
    if (current.members.length <= 2) return notify('群組至少需要保留兩位成員。');
    if (current.expenses.some(expense => expense.payerId === id || Object.hasOwn(expense.splits || {}, id))) return notify('這位成員參與了現有費用，請先編輯或刪除相關費用。');
    current.members = current.members.filter(member => member.id !== id);
    save(); render(); openMembersDialog(); notify('成員已移除。');
  }
  function addMember() {
    const input = $('#newMemberInput');
    const name = input.value.trim();
    if (!name) { notify('請輸入成員名稱。'); input.focus(); return; }
    if (group().members.some(member => member.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return notify('這位成員已在群組中。');
    group().members.push({ id: uid(), name });
    save(); render(); openMembersDialog(); notify('已新增成員！');
  }
  function selectedIds() { return $$('#splitMembers input:checked').map(input => input.value); }
  function mode() { return $('input[name="splitMode"]:checked')?.value || 'equal'; }
  function splitEqually(amount, ids) {
    if (!ids.length) return {};
    const base = Math.floor(amount / ids.length);
    const remainder = amount % ids.length;
    return Object.fromEntries(ids.map((id, index) => [id, base + (index < remainder ? 1 : 0)]));
  }
  function customValues() {
    const result = {};
    for (const input of $$('.custom-amount')) {
      const cents = centsFromInput(input.value);
      if (!Number.isFinite(cents) || cents < 0) return null;
      result[input.dataset.member] = cents;
    }
    return result;
  }
  function renderCustomFields(previous = {}) {
    $('#customSplitFields').innerHTML = selectedIds().map(id => `<label class="custom-split-row"><span>${escapeHTML(memberById(id)?.name || '成員')}</span><input class="text-input custom-amount" type="number" min="0" step="0.01" inputmode="decimal" data-member="${escapeHTML(id)}" value="${previous[id] !== undefined ? (previous[id] / 100).toFixed(2) : ''}" placeholder="0.00" aria-label="${escapeHTML(memberById(id)?.name || '成員')}分攤金額"></label>`).join('');
    $$('.custom-amount').forEach(input => input.addEventListener('input', validateSplit));
  }
  function validateSplit() {
    const amount = centsFromInput($('#expenseAmount').value);
    const ids = selectedIds();
    let message = '';
    let valid = true;
    if (!Number.isFinite(amount) || amount <= 0) { message = '請輸入大於 0 的費用金額。'; valid = false; }
    else if (!group().members.length) { message = '請先新增群組成員。'; valid = false; }
    else if (!ids.length) { message = '至少選擇一位分攤成員。'; valid = false; }
    else if (mode() === 'custom') {
      const values = customValues();
      if (!values || Object.keys(values).length !== ids.length) { message = '請為每位分攤成員輸入有效金額（可填 0）。'; valid = false; }
      else {
        const sum = Object.values(values).reduce((total, cents) => total + cents, 0);
        message = sum === amount ? `分攤合計 ${formatMoney(sum)}，金額相符。` : `目前分攤合計 ${formatMoney(sum)}，需等於費用 ${formatMoney(amount)}。`;
        valid = sum === amount;
      }
    } else message = `${ids.length} 位成員平均分攤${amount % ids.length ? '，零頭依序分配到每人 1 分' : '。'}`;
    const status = $('#splitValidation');
    status.textContent = message;
    status.classList.toggle('invalid', !valid);
    $('#saveExpenseButton').disabled = !valid;
    $('#saveExpenseButton').style.opacity = valid ? '1' : '.65';
    return valid;
  }
  function setSplitControls(selected, values = {}) {
    $('#splitMembers').innerHTML = group().members.map((member, index) => `<label class="split-member"><input type="checkbox" value="${escapeHTML(member.id)}" ${selected.includes(member.id) ? 'checked' : ''}><span class="member-avatar color-${index % 4}" style="width:20px;height:20px;font-size:9px">${escapeHTML(firstCharacter(member.name))}</span>${escapeHTML(member.name)}</label>`).join('');
    $$('#splitMembers input').forEach(input => input.addEventListener('change', () => { renderCustomFields(values); validateSplit(); }));
    renderCustomFields(values);
  }
  function toggleCustomMode() {
    const custom = mode() === 'custom';
    $('#customSplitFields').classList.toggle('hidden', !custom);
    $('#customSplitHint').classList.toggle('hidden', !custom);
    validateSplit();
  }
  function openExpenseDialog(expense = null) {
    if (group().members.length < 2) { notify('請先在群組中新增至少兩位成員。'); openMembersDialog(); return; }
    $('#expenseForm').reset();
    $('#expenseError').textContent = '';
    $('#expenseId').value = expense?.id || '';
    $('#expenseDialogTitle').textContent = expense ? '編輯費用' : '新增費用';
    $('#expenseTitle').value = expense?.title || '';
    $('#expenseAmount').value = expense ? (expense.amount / 100).toFixed(2) : '';
    $('#expenseDate').value = expense?.date || today();
    $('#expenseNote').value = expense?.note || '';
    $('#expensePayer').innerHTML = group().members.map(member => `<option value="${escapeHTML(member.id)}">${escapeHTML(member.name)}</option>`).join('');
    $('#expensePayer').value = expense?.payerId || group().members[0]?.id || '';
    const splits = expense?.splits || {};
    setSplitControls(expense ? Object.keys(splits) : group().members.map(member => member.id), splits);
    $(`input[name="splitMode"][value="${expense?.splitMode || 'equal'}"]`).checked = true;
    toggleCustomMode();
    openDialog('expenseDialog');
  }
  function submitExpense(event) {
    event.preventDefault();
    const title = $('#expenseTitle').value.trim();
    const amount = centsFromInput($('#expenseAmount').value);
    const payerId = $('#expensePayer').value;
    const ids = selectedIds();
    const selectedMode = mode();
    const error = $('#expenseError');
    error.textContent = '';
    if (!title) { error.textContent = '請填寫項目名稱。'; return; }
    if (!Number.isFinite(amount) || amount <= 0) { error.textContent = '金額需大於 0，請確認輸入。'; return; }
    if (!payerId || !memberById(payerId)) { error.textContent = '請選擇有效的付款人。'; return; }
    if (!ids.length) { error.textContent = '請至少選擇一位分攤成員。'; return; }
    const splits = selectedMode === 'equal' ? splitEqually(amount, ids) : customValues();
    if (!splits || Object.keys(splits).length !== ids.length || Object.keys(splits).some(id => !ids.includes(id))) { error.textContent = '分攤金額無效，請檢查每位成員的金額。'; return; }
    if (Object.values(splits).reduce((sum, cents) => sum + cents, 0) !== amount) { error.textContent = '自訂分攤總額需等於費用金額，請調整後再儲存。'; return; }
    const id = $('#expenseId').value;
    const value = { id: id || uid(), title, amount, payerId, date: $('#expenseDate').value || today(), note: $('#expenseNote').value.trim(), splitMode: selectedMode, splits };
    if (id) {
      const index = group().expenses.findIndex(item => item.id === id);
      if (index >= 0) group().expenses[index] = value;
    } else group().expenses.push(value);
    save(); render(); closeDialog('expenseDialog'); notify(id ? '費用已更新！' : '費用已新增！');
  }
  function deleteExpense(id) {
    const expense = group().expenses.find(item => item.id === id);
    if (!expense || !confirm(`確定刪除「${expense.title}」這筆費用嗎？`)) return;
    group().expenses = group().expenses.filter(item => item.id !== id);
    save(); render(); notify('費用已刪除。');
  }
  function completeSettlement(id) {
    const transfer = suggestionsFor().find(item => item.id === id);
    if (!transfer) return;
    group().settlements.push({ id: uid(), fromId: transfer.fromId, toId: transfer.toId, amount: transfer.amount, completed: true, completedAt: new Date().toISOString() });
    save(); render(); notify(`${transfer.fromName} 已付給 ${transfer.toName} ${formatCompactMoney(transfer.amount)}，已標記完成。`);
  }

  function bind() {
    ['heroAddExpense', 'addExpenseTop', 'addExpenseList'].forEach(id => $('#' + id).addEventListener('click', () => openExpenseDialog()));
    ['heroNewGroup', 'newGroupSmall', 'newGroupSidebar'].forEach(id => $('#' + id).addEventListener('click', () => openGroupDialog()));
    $('#manageGroupTop').addEventListener('click', openMembersDialog);
    $('#manageMembers').addEventListener('click', openMembersDialog);
    $('#editGroupButton').addEventListener('click', () => openGroupDialog(true));
    $('#groupForm').addEventListener('submit', submitGroup);
    $('#membersForm').addEventListener('submit', event => { event.preventDefault(); closeDialog('membersDialog'); });
    $('#addMemberButton').addEventListener('click', addMember);
    $('#newMemberInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addMember(); } });
    $('#expenseForm').addEventListener('submit', submitExpense);
    $('#expenseAmount').addEventListener('input', validateSplit);
    $$('input[name="splitMode"]').forEach(input => input.addEventListener('change', toggleCustomMode));
    $$('.tab').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
    $$('[data-goto]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.goto)));
    document.body.addEventListener('click', event => {
      const edit = event.target.closest('[data-edit-expense]');
      const remove = event.target.closest('[data-delete-expense]');
      const settle = event.target.closest('[data-settle]');
      if (edit) openExpenseDialog(group().expenses.find(item => item.id === edit.dataset.editExpense));
      if (remove) deleteExpense(remove.dataset.deleteExpense);
      if (settle) completeSettlement(settle.dataset.settle);
    });
    $$('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(button.dataset.close)));
    $$('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(dialog.id); }));
    $('#resetDemo').addEventListener('click', () => {
      if (!confirm('重設後會以示範群組取代目前所有本機資料，確定嗎？')) return;
      state = demoData(); activeView = 'overview'; save(); render(); notify('已重設示範資料。');
    });
  }

  setupGroupMemberField();
  bind();
  render();
})();
