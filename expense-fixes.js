(() => {
  'use strict';

  // Keep custom amounts when a participant checkbox rebuilds the split controls.
  // The main app recreates those inputs on each change; without this small
  // adapter, values already entered by the user would disappear.
  const valuesByMember = new Map();
  const dialog = document.querySelector('#expenseDialog');
  const rememberVisibleValues = () => {
    document.querySelectorAll('#customSplitFields .custom-amount').forEach(input => {
      if (input.value !== '') valuesByMember.set(input.dataset.member, input.value);
    });
  };

  dialog?.addEventListener('close', () => valuesByMember.clear());
  dialog?.addEventListener('click', event => {
    if (event.target.closest('#splitMembers input[type="checkbox"]')) {
      rememberVisibleValues();
      queueMicrotask(() => {
        document.querySelectorAll('#customSplitFields .custom-amount').forEach(input => {
          if (valuesByMember.has(input.dataset.member)) {
            input.value = valuesByMember.get(input.dataset.member);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      });
    }
  });
  dialog?.addEventListener('input', event => {
    const input = event.target.closest('#customSplitFields .custom-amount');
    if (input) valuesByMember.set(input.dataset.member, input.value);
  });
})();
