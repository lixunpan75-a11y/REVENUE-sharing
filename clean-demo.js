// Initialize an empty workspace instead of injecting demo groups, expenses, or members.
(() => {
  'use strict';
  const KEY = 'fen-zhang-helper-v1';
  const EMPTY_ID = '__empty_workspace__';
  const emptyWorkspace = () => ({
    id: EMPTY_ID,
    name: '尚未建立群組',
    emoji: '🌿',
    members: [],
    expenses: [],
    settlements: []
  });

  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (value && Array.isArray(value.groups)) return value;
    } catch (error) {
      console.warn('無法讀取分帳資料，將開啟空白工作區。', error);
    }
    return { groups: [], activeGroupId: null };
  }
  function writeState(value) {
    try { localStorage.setItem(KEY, JSON.stringify(value)); }
    catch (error) { console.warn('無法儲存空白工作區。', error); }
  }

  const state = readState();
  // Remove only the bundled example group. Preserve groups that users created.
  state.groups = state.groups.filter(group => group.id !== 'g-demo');
  if (!state.groups.length) {
    state.groups = [emptyWorkspace()];
    state.activeGroupId = EMPTY_ID;
  } else if (!state.groups.some(group => group.id === state.activeGroupId)) {
    state.activeGroupId = state.groups[0].id;
  }
  writeState(state);

  // Do not keep the empty onboarding placeholder after the first real group is made.
  document.addEventListener('submit', event => {
    if (event.target.id !== 'groupForm' || event.target.querySelector('#groupNameInput')?.dataset.edit === 'true') return;
    setTimeout(() => {
      const updated = readState();
      const hadPlaceholder = updated.groups.some(group => group.id === EMPTY_ID);
      const hasRealGroup = updated.groups.some(group => group.id !== EMPTY_ID);
      if (!hadPlaceholder || !hasRealGroup) return;
      updated.groups = updated.groups.filter(group => group.id !== EMPTY_ID);
      if (updated.activeGroupId === EMPTY_ID) updated.activeGroupId = updated.groups[0]?.id || null;
      writeState(updated);
      location.reload();
    }, 0);
  });

  // The reset action now restores a clean, empty workspace instead of demo data.
  document.addEventListener('click', event => {
    const button = event.target.closest('#resetDemo');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!confirm('清空目前瀏覽器保存的分帳資料，回到空白狀態嗎？')) return;
    writeState({ groups: [emptyWorkspace()], activeGroupId: EMPTY_ID });
    location.reload();
  }, true);
})();
