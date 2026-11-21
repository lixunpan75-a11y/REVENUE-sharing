(() => {
  'use strict';

  // Delegated wheel/keyboard adjustments keep the native number input, while each
  // arrow step changes the monthly budget by NT$100 instead of NT$0.01.
  document.addEventListener('DOMContentLoaded', () => {
    const budget = document.querySelector('#personalBudgetInput');
    if (!budget) return;
    budget.step = '100';
    budget.min = '0';
    budget.setAttribute('aria-describedby', 'personalBudgetStepHint');
    const hint = document.createElement('small');
    hint.id = 'personalBudgetStepHint';
    hint.className = 'budget-step-hint';
    hint.textContent = '使用上下鍵以 NT$100 為單位調整';
    budget.closest('.budget-input-label')?.append(hint);
  });
})();
