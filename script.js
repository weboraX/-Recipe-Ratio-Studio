(function () {
  'use strict';

  const STORAGE_KEY = 'recipe_ratio_saved_state_v1';
  const NOTES_STORAGE_KEY = 'recipe_ratio_kitchen_notes_v1';
  const THEME_STORAGE_KEY = 'recipe_ratio_theme_preference_v1';

  // Common Unit Options
  const UNIT_OPTIONS = [
    { value: 'g', label: 'grams (g)' },
    { value: 'ml', label: 'ml' },
    { value: 'cups', label: 'cups' },
    { value: 'tbsp', label: 'tbsp' },
    { value: 'tsp', label: 'tsp' },
    { value: 'oz', label: 'oz' },
    { value: 'lbs', label: 'lbs' },
    { value: 'pcs', label: 'pieces' },
    { value: 'cloves', label: 'cloves' }
  ];

  // Culinary Tips Catalog
  const CULINARY_TIPS = [
    "When scaling garlic and intense spices, scale up by 75% first and taste before adding the full scaled proportion.",
    "Baking leaveners (baking powder/soda) often scale slightly sub-linearly in very large batches. Test a small batch first.",
    "Always measure flour by weight rather than cups for foolproof consistency across scaled baked goods.",
    "Liquid evaporation depends on pan surface area, not recipe volume. Keep pan surface in mind when scaling braises and reductions.",
    "Season gradually: salt perception increases as food cools, so salt incrementally throughout cooking."
  ];
  let currentTipIndex = 0;

  const sunIconSvg = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>`;

  const moonIconSvg = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>`;

  let rowCounter = 0;
  let lastCalculatedInputs = null;
  let activeCalculatedResult = null;

  // -------------------------------------------------------------
  // THEME MANAGEMENT (PERSISTENT & ERROR-FREE)
  // -------------------------------------------------------------
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('themeToggleIcon');
    const label = document.getElementById('themeToggleLabel');
    if (icon) {
      icon.innerHTML = theme === 'dark' ? sunIconSvg : moonIconSvg;
    }
    if (label) {
      label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    }
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {}
  }

  function initTheme() {
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    } catch (e) {}

    if (savedTheme === 'dark' || savedTheme === 'light') {
      applyTheme(savedTheme);
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    }

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.removeEventListener('click', toggleTheme);
      themeToggleBtn.addEventListener('click', toggleTheme);
    }
  }

  // -------------------------------------------------------------
  // HELPER FORMATTERS & ESCAPERS
  // -------------------------------------------------------------
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatNumber(num) {
    if (!Number.isFinite(num)) return '';
    const factor = 10000;
    const rounded = Math.round(num * factor) / factor;
    return rounded.toLocaleString('en-US', {
      maximumFractionDigits: 4,
      useGrouping: false
    });
  }

  function parseStrictPositiveNumber(val) {
    if (typeof val !== 'string' && typeof val !== 'number') return null;
    const trimmed = String(val).trim();
    if (trimmed === '') return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num;
  }

  function showToast(msg) {
    const toastPill = document.getElementById('toastPill');
    const toastMessage = document.getElementById('toastMessage');
    if (!toastPill || !toastMessage) return;
    toastMessage.textContent = msg;
    toastPill.classList.add('visible');
    setTimeout(() => {
      toastPill.classList.remove('visible');
    }, 2800);
  }

  function setFieldError(input, errorEl, message) {
    if (input) {
      input.classList.add('input-error');
      input.setAttribute('aria-invalid', 'true');
    }
    if (errorEl) {
      if (message) errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
  }

  function clearFieldError(input, errorEl) {
    if (input) {
      input.classList.remove('input-error');
      input.removeAttribute('aria-invalid');
    }
    if (errorEl) {
      errorEl.classList.remove('visible');
    }
  }

  function clearAllErrors() {
    const banner = document.getElementById('globalErrorBanner');
    if (banner) banner.classList.remove('visible');

    clearFieldError(document.getElementById('dishName'), document.getElementById('dishNameError'));
    clearFieldError(document.getElementById('originalServings'), document.getElementById('originalServingsError'));
    clearFieldError(document.getElementById('desiredServings'), document.getElementById('desiredServingsError'));

    const container = document.getElementById('ingredientsContainer');
    if (container) {
      const allIngRows = container.querySelectorAll('.ingredient-card-item');
      allIngRows.forEach(row => {
        clearFieldError(row.querySelector('.ing-name-input'), row.querySelector('.ing-name-error'));
        clearFieldError(row.querySelector('.ing-amount-input'), row.querySelector('.ing-amount-error'));
      });
    }
  }

  function updateLiveMultiplierPreview() {
    const origInput = document.getElementById('originalServings');
    const desInput = document.getElementById('desiredServings');
    const badge = document.getElementById('liveMultiplierBadge');
    if (!badge || !origInput || !desInput) return;

    const orig = parseStrictPositiveNumber(origInput.value);
    const des = parseStrictPositiveNumber(desInput.value);
    if (orig !== null && des !== null && orig > 0) {
      const ratio = des / orig;
      badge.textContent = `${formatNumber(ratio)}× Recipe`;
    } else {
      badge.textContent = "— Ratio";
    }
  }

  function updateIngredientRowLabels() {
    const container = document.getElementById('ingredientsContainer');
    if (!container) return;
    const rows = container.querySelectorAll('.ingredient-card-item');
    rows.forEach((row, index) => {
      const label = row.querySelector('.ingredient-pill-label');
      if (label) {
        label.textContent = `Ingredient ${index + 1}`;
      }
      const removeBtn = row.querySelector('.btn-remove-ing');
      if (removeBtn) {
        removeBtn.disabled = (rows.length <= 1);
      }
    });
  }

  // -------------------------------------------------------------
  // DYNAMIC INGREDIENT ROW MANAGEMENT
  // -------------------------------------------------------------
  function createIngredientRow(data = {}) {
    rowCounter++;
    const id = `ing_row_${rowCounter}`;
    const nameVal = data.name !== undefined ? data.name : '';
    const amountVal = data.amount !== undefined ? data.amount : '';
    const unitVal = data.unit || 'g';

    const card = document.createElement('div');
    card.className = 'ingredient-card-item';
    card.id = id;

    const unitOptionsHtml = UNIT_OPTIONS.map(opt => {
      const selected = opt.value === unitVal ? 'selected' : '';
      return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
    }).join('');

    card.innerHTML = `
      <div class="ingredient-card-header">
        <div class="ingredient-pill-label">Ingredient</div>
        <button type="button" class="btn-remove-ing" aria-label="Remove this ingredient">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          <span>Remove</span>
        </button>
      </div>
      <div class="ingredient-input-triad">
        <div>
          <label for="${id}_name">Item Name <span class="required-star" aria-hidden="true">*</span></label>
          <input type="text" id="${id}_name" class="ing-name-input" placeholder="e.g. Semolina Flour" value="${escapeHtml(nameVal)}" required autocomplete="off" />
          <div class="field-error-msg ing-name-error" role="alert">Name required.</div>
        </div>
        <div>
          <label for="${id}_amount">Original Qty <span class="required-star" aria-hidden="true">*</span></label>
          <input type="number" id="${id}_amount" class="ing-amount-input" step="any" min="0.0001" placeholder="e.g. 300" value="${amountVal !== '' ? escapeHtml(String(amountVal)) : ''}" required />
          <div class="field-error-msg ing-amount-error" role="alert">Qty > 0.</div>
        </div>
        <div>
          <label for="${id}_unit">Unit</label>
          <div class="custom-select-wrap">
            <select id="${id}_unit" class="ing-unit-select">
              ${unitOptionsHtml}
            </select>
          </div>
        </div>
      </div>
    `;

    const nameInput = card.querySelector('.ing-name-input');
    const amtInput = card.querySelector('.ing-amount-input');
    const unitSelect = card.querySelector('.ing-unit-select');
    const removeBtn = card.querySelector('.btn-remove-ing');
    const nameError = card.querySelector('.ing-name-error');
    const amtError = card.querySelector('.ing-amount-error');

    if (nameInput) {
      nameInput.addEventListener('input', () => {
        clearFieldError(nameInput, nameError);
        checkInputsDrift();
      });
    }

    if (amtInput) {
      amtInput.addEventListener('input', () => {
        clearFieldError(amtInput, amtError);
        checkInputsDrift();
      });
    }

    if (unitSelect) {
      unitSelect.addEventListener('change', () => {
        checkInputsDrift();
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        const container = document.getElementById('ingredientsContainer');
        if (!container) return;
        const totalRows = container.querySelectorAll('.ingredient-card-item').length;
        if (totalRows <= 1) {
          showToast('At least one ingredient is required.');
          return;
        }
        card.remove();
        updateIngredientRowLabels();
        checkInputsDrift();
      });
    }

    return card;
  }

  function addIngredientRow(data) {
    const container = document.getElementById('ingredientsContainer');
    if (!container) return null;
    const card = createIngredientRow(data);
    container.appendChild(card);
    updateIngredientRowLabels();
    return card;
  }

  function getIngredientsFormData() {
    const container = document.getElementById('ingredientsContainer');
    if (!container) return [];
    const rows = container.querySelectorAll('.ingredient-card-item');
    const list = [];
    rows.forEach(row => {
      const nameInput = row.querySelector('.ing-name-input');
      const amtInput = row.querySelector('.ing-amount-input');
      const unitSelect = row.querySelector('.ing-unit-select');
      list.push({
        name: nameInput ? nameInput.value.trim() : '',
        amount: amtInput ? amtInput.value.trim() : '',
        unit: unitSelect ? unitSelect.value : 'g',
        nameElement: nameInput,
        amountElement: amtInput,
        nameError: row.querySelector('.ing-name-error'),
        amountError: row.querySelector('.ing-amount-error')
      });
    });
    return list;
  }

  // -------------------------------------------------------------
  // VALIDATION & DRIFT DETECTION
  // -------------------------------------------------------------
  function validateForm() {
    clearAllErrors();
    let isValid = true;
    let firstErrorField = null;

    const dishNameInput = document.getElementById('dishName');
    const origServInput = document.getElementById('originalServings');
    const desServInput = document.getElementById('desiredServings');
    const globalBanner = document.getElementById('globalErrorBanner');

    function markFieldInvalid(input, errorEl, msg) {
      isValid = false;
      setFieldError(input, errorEl, msg);
      if (!firstErrorField && input) firstErrorField = input;
    }

    const dishNameVal = dishNameInput ? dishNameInput.value.trim() : '';
    if (dishNameVal.length === 0) {
      markFieldInvalid(dishNameInput, document.getElementById('dishNameError'), 'Dish name is required.');
    }

    const origServVal = origServInput ? parseStrictPositiveNumber(origServInput.value) : null;
    if (origServVal === null) {
      markFieldInvalid(origServInput, document.getElementById('originalServingsError'), 'Enter a positive serving (> 0).');
    }

    const desServVal = desServInput ? parseStrictPositiveNumber(desServInput.value) : null;
    if (desServVal === null) {
      markFieldInvalid(desServInput, document.getElementById('desiredServingsError'), 'Enter a positive serving (> 0).');
    }

    const ingRows = getIngredientsFormData();
    if (ingRows.length === 0) {
      isValid = false;
      if (globalBanner) {
        globalBanner.textContent = 'Please add at least one ingredient to scale.';
        globalBanner.classList.add('visible');
      }
      return { isValid: false, values: null, firstErrorField: null };
    }

    const validatedIngredients = [];

    ingRows.forEach((row) => {
      let rowValid = true;
      if (row.name.length === 0) {
        markFieldInvalid(row.nameElement, row.nameError, 'Name required.');
        rowValid = false;
      }

      const amtNum = parseStrictPositiveNumber(row.amount);
      if (amtNum === null) {
        markFieldInvalid(row.amountElement, row.amountError, 'Qty > 0.');
        rowValid = false;
      }

      if (rowValid) {
        validatedIngredients.push({
          name: row.name,
          amount: amtNum,
          unit: row.unit
        });
      }
    });

    if (!isValid) {
      if (globalBanner) {
        globalBanner.textContent = 'Please check the highlighted fields below. All servings and ingredients must be positive values.';
        globalBanner.classList.add('visible');
      }
      return { isValid: false, values: null, firstErrorField };
    }

    return {
      isValid: true,
      firstErrorField: null,
      values: {
        dishName: dishNameVal,
        origServings: origServVal,
        desiredServings: desServVal,
        ingredients: validatedIngredients
      }
    };
  }

  function checkInputsDrift() {
    if (!lastCalculatedInputs) return;

    const dishNameInput = document.getElementById('dishName');
    const origServInput = document.getElementById('originalServings');
    const desServInput = document.getElementById('desiredServings');

    const currentIngs = getIngredientsFormData();
    const currentSnapshot = {
      dishName: dishNameInput ? dishNameInput.value.trim() : '',
      origServings: origServInput ? origServInput.value.trim() : '',
      desiredServings: desServInput ? desServInput.value.trim() : '',
      ingredients: currentIngs.map(i => ({ name: i.name, amount: i.amount, unit: i.unit }))
    };

    let changed = false;
    if (
      currentSnapshot.dishName !== lastCalculatedInputs.dishName ||
      currentSnapshot.origServings !== lastCalculatedInputs.origServings ||
      currentSnapshot.desiredServings !== lastCalculatedInputs.desiredServings ||
      !Array.isArray(lastCalculatedInputs.ingredients) ||
      currentSnapshot.ingredients.length !== lastCalculatedInputs.ingredients.length
    ) {
      changed = true;
    } else {
      for (let i = 0; i < currentSnapshot.ingredients.length; i++) {
        const c = currentSnapshot.ingredients[i];
        const l = lastCalculatedInputs.ingredients[i];
        if (!l || c.name !== l.name || c.amount !== l.amount || c.unit !== l.unit) {
          changed = true;
          break;
        }
      }
    }

    setResultStaleState(changed);
  }

  function setResultStaleState(stale) {
    const outdatedNotice = document.getElementById('outdatedNotice');
    const resultContent = document.getElementById('resultContent');
    const resultBadge = document.getElementById('resultBadge');

    if (stale) {
      if (outdatedNotice) outdatedNotice.classList.add('visible');
      if (resultContent) resultContent.classList.add('stale');
      if (resultBadge) {
        resultBadge.textContent = 'Outdated';
        resultBadge.className = 'card-chip';
        resultBadge.style.background = 'var(--warning-bg)';
        resultBadge.style.color = 'var(--warning-ochre)';
      }
    } else {
      if (outdatedNotice) outdatedNotice.classList.remove('visible');
      if (resultContent) resultContent.classList.remove('stale');
      if (resultBadge) {
        resultBadge.textContent = 'Target Yield';
        resultBadge.className = 'card-chip';
        resultBadge.style.background = 'var(--surface-accent)';
        resultBadge.style.color = 'var(--sage-primary)';
      }
    }
  }

  // -------------------------------------------------------------
  // RESULTS DISPLAY & LOCAL STORAGE
  // -------------------------------------------------------------
  function displayResults(data, animate) {
    if (!data) return;
    activeCalculatedResult = data;

    const origServ = Number(data.origServings) || 1;
    const desServ = Number(data.desiredServings) || 1;
    const multiplier = desServ / origServ;

    const dishNameEl = document.getElementById('resultDishName');
    const multTagEl = document.getElementById('resultMultiplierTag');
    const servTextEl = document.getElementById('resultServingsText');
    const listEl = document.getElementById('scaledItemsList');
    const emptyState = document.getElementById('emptyState');
    const resultContent = document.getElementById('resultContent');

    if (dishNameEl) dishNameEl.textContent = data.dishName || '';
    if (multTagEl) multTagEl.textContent = `${formatNumber(multiplier)}× recipe`;
    if (servTextEl) servTextEl.textContent = `Scaled from ${formatNumber(origServ)} to ${formatNumber(desServ)} servings`;

    if (listEl) {
      listEl.innerHTML = '';
      const ingredients = Array.isArray(data.ingredients) ? data.ingredients : [];

      ingredients.forEach((ing, index) => {
        const li = document.createElement('li');
        li.className = 'scaled-item-card';
        li.id = `scaledItem_${index + 1}`;

        li.innerHTML = `
          <input type="checkbox" id="checkIng_${index + 1}" class="cook-checkbox" aria-label="Mark ${escapeHtml(ing.name)} as prepped" />
          <div class="scaled-item-details">
            <div class="scaled-ing-name">${escapeHtml(ing.name)}</div>
            <div class="scaled-ing-orig">Original: ${formatNumber(ing.originalAmount)} ${escapeHtml(ing.unit || '')}</div>
          </div>
          <div class="scaled-yield-value">
            <div class="scaled-amount-number">${formatNumber(ing.scaledAmount)}</div>
            <div class="scaled-unit-label">${escapeHtml(ing.unit || '')}</div>
          </div>
        `;

        const checkbox = li.querySelector('.cook-checkbox');
        if (checkbox) {
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
              li.classList.add('is-checked');
            } else {
              li.classList.remove('is-checked');
            }
          });
        }

        listEl.appendChild(li);
      });
    }

    if (emptyState) emptyState.style.display = 'none';
    if (resultContent) {
      resultContent.classList.add('visible');
      if (animate) {
        resultContent.classList.remove('just-calculated');
        void resultContent.offsetWidth;
        resultContent.classList.add('just-calculated');
      }
    }

    setResultStaleState(false);
  }

  function saveToLocalStorage(record) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  function restoreFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          const dishInput = document.getElementById('dishName');
          const origInput = document.getElementById('originalServings');
          const desInput = document.getElementById('desiredServings');
          const container = document.getElementById('ingredientsContainer');

          if (saved.formInputs) {
            if (dishInput) dishInput.value = saved.formInputs.dishName ?? '';
            if (origInput) origInput.value = saved.formInputs.origServings ?? '';
            if (desInput) desInput.value = saved.formInputs.desiredServings ?? '';

            if (container) {
              container.innerHTML = '';
              if (Array.isArray(saved.formInputs.ingredients) && saved.formInputs.ingredients.length > 0) {
                saved.formInputs.ingredients.forEach(item => addIngredientRow(item));
              } else if (saved.formInputs.ing1Name !== undefined) {
                const legacy = [
                  { name: saved.formInputs.ing1Name, amount: saved.formInputs.ing1Amount, unit: saved.formInputs.ing1Unit || 'g' },
                  { name: saved.formInputs.ing2Name, amount: saved.formInputs.ing2Amount, unit: saved.formInputs.ing2Unit || 'pcs' },
                  { name: saved.formInputs.ing3Name, amount: saved.formInputs.ing3Amount, unit: saved.formInputs.ing3Unit || 'ml' }
                ];
                legacy.forEach(item => {
                  if (item.name || item.amount) addIngredientRow(item);
                });
              }
            }
          }

          if (saved.calculatedResult && saved.formInputs) {
            const rawIngredients = Array.isArray(saved.formInputs.ingredients)
              ? saved.formInputs.ingredients.map(i => ({ name: String(i.name || '').trim(), amount: String(i.amount || '').trim(), unit: i.unit || 'g' }))
              : [];

            lastCalculatedInputs = {
              dishName: String(saved.formInputs.dishName ?? '').trim(),
              origServings: String(saved.formInputs.origServings ?? '').trim(),
              desiredServings: String(saved.formInputs.desiredServings ?? '').trim(),
              ingredients: rawIngredients
            };

            let resultData = saved.calculatedResult;
            if (!Array.isArray(resultData.ingredients)) {
              const ingList = [];
              if (resultData.ing1Name || resultData.ing1Calculated !== undefined) {
                ingList.push({ name: resultData.ing1Name || 'Ingredient 1', originalAmount: resultData.ing1Amount || 0, unit: resultData.ing1Unit || '', scaledAmount: resultData.ing1Calculated || 0 });
              }
              if (resultData.ing2Name || resultData.ing2Calculated !== undefined) {
                ingList.push({ name: resultData.ing2Name || 'Ingredient 2', originalAmount: resultData.ing2Amount || 0, unit: resultData.ing2Unit || '', scaledAmount: resultData.ing2Calculated || 0 });
              }
              if (resultData.ing3Name || resultData.ing3Calculated !== undefined) {
                ingList.push({ name: resultData.ing3Name || 'Ingredient 3', originalAmount: resultData.ing3Amount || 0, unit: resultData.ing3Unit || '', scaledAmount: resultData.ing3Calculated || 0 });
              }
              resultData = {
                dishName: resultData.dishName || (dishInput ? dishInput.value : ''),
                origServings: resultData.origServings || 1,
                desiredServings: resultData.desiredServings || 1,
                ingredients: ingList
              };
            }
            displayResults(resultData, false);
          }
        }
      }

      const notesInput = document.getElementById('kitchenNotesInput');
      const savedNotes = localStorage.getItem(NOTES_STORAGE_KEY);
      if (savedNotes !== null && notesInput) {
        notesInput.value = savedNotes;
      }
    } catch (e) {
      console.warn('LocalStorage restore error:', e);
    }

    const container = document.getElementById('ingredientsContainer');
    if (container && container.children.length === 0) {
      addIngredientRow({ name: '', amount: '', unit: 'g' });
      addIngredientRow({ name: '', amount: '', unit: 'pcs' });
      addIngredientRow({ name: '', amount: '', unit: 'ml' });
    }

    updateLiveMultiplierPreview();
  }

  // -------------------------------------------------------------
  // CALCULATION ACTION
  // -------------------------------------------------------------
  function handleScale(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    const validation = validateForm();

    if (!validation.isValid) {
      if (lastCalculatedInputs) {
        setResultStaleState(true);
      }
      if (validation.firstErrorField) {
        validation.firstErrorField.focus();
      }
      return;
    }

    const vals = validation.values;

    const scaledIngredients = vals.ingredients.map(ing => {
      const scaledAmount = (ing.amount * vals.desiredServings) / vals.origServings;
      return {
        name: ing.name,
        originalAmount: ing.amount,
        unit: ing.unit,
        scaledAmount: scaledAmount
      };
    });

    const calculatedResult = {
      dishName: vals.dishName,
      origServings: vals.origServings,
      desiredServings: vals.desiredServings,
      ingredients: scaledIngredients
    };

    const dishNameInput = document.getElementById('dishName');
    const origServInput = document.getElementById('originalServings');
    const desServInput = document.getElementById('desiredServings');
    const rawIngs = getIngredientsFormData();

    lastCalculatedInputs = {
      dishName: dishNameInput ? dishNameInput.value.trim() : '',
      origServings: origServInput ? origServInput.value.trim() : '',
      desiredServings: desServInput ? desServInput.value.trim() : '',
      ingredients: rawIngs.map(i => ({ name: i.name, amount: i.amount, unit: i.unit }))
    };

    displayResults(calculatedResult, true);

    saveToLocalStorage({
      formInputs: {
        dishName: dishNameInput ? dishNameInput.value : '',
        origServings: origServInput ? origServInput.value : '',
        desiredServings: desServInput ? desServInput.value : '',
        ingredients: rawIngs.map(i => ({ name: i.name, amount: i.amount, unit: i.unit }))
      },
      calculatedResult
    });
  }

  function fallbackCopyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('Scaled recipe copied to clipboard!');
    } catch (e) {
      alert('Could not copy automatically. Please copy manually:\n\n' + text);
    }
    document.body.removeChild(ta);
  }

  // -------------------------------------------------------------
  // INITIALIZATION & ATTACHING EVENT LISTENERS
  // -------------------------------------------------------------
  function setupApp() {
    const form = document.getElementById('recipeForm');
    const scaleBtn = document.getElementById('scaleBtn');
    const btnAddIngredient = document.getElementById('btnAddIngredient');
    const btnStepDown = document.getElementById('btnStepDown');
    const btnStepUp = document.getElementById('btnStepUp');
    const btnCopyRecipe = document.getElementById('btnCopyRecipe');
    const btnResetForm = document.getElementById('btnResetForm');
    const btnSaveNotes = document.getElementById('btnSaveNotes');
    const kitchenNotesInput = document.getElementById('kitchenNotesInput');
    const btnNextTip = document.getElementById('btnNextTip');

    // Form submit & primary scale button
    if (form) {
      form.removeEventListener('submit', handleScale);
      form.addEventListener('submit', handleScale);
    }
    if (scaleBtn) {
      scaleBtn.removeEventListener('click', handleScale);
      scaleBtn.addEventListener('click', handleScale);
    }

    // Add Ingredient Button
    if (btnAddIngredient) {
      btnAddIngredient.addEventListener('click', () => {
        const newCard = addIngredientRow({ name: '', amount: '', unit: 'g' });
        if (newCard) {
          const nameInput = newCard.querySelector('.ing-name-input');
          if (nameInput) nameInput.focus();
        }
        checkInputsDrift();
        showToast('Ingredient row added');
      });
    }

    // Serving Steppers (+ / -)
    if (btnStepDown) {
      btnStepDown.addEventListener('click', () => {
        const desInput = document.getElementById('desiredServings');
        if (!desInput) return;
        let current = parseFloat(desInput.value) || 1;
        if (current > 1) {
          desInput.value = Math.max(1, current - 1);
        } else if (current > 0.5) {
          desInput.value = (current - 0.5).toFixed(1);
        }
        clearFieldError(desInput, document.getElementById('desiredServingsError'));
        updateLiveMultiplierPreview();
        checkInputsDrift();
      });
    }

    if (btnStepUp) {
      btnStepUp.addEventListener('click', () => {
        const desInput = document.getElementById('desiredServings');
        if (!desInput) return;
        let current = parseFloat(desInput.value) || 0;
        desInput.value = current + 1;
        clearFieldError(desInput, document.getElementById('desiredServingsError'));
        updateLiveMultiplierPreview();
        checkInputsDrift();
      });
    }

    // Quick Serving Preset buttons
    document.querySelectorAll('.quick-serve-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const desInput = document.getElementById('desiredServings');
        const targetServ = btn.getAttribute('data-servings');
        if (desInput && targetServ) {
          desInput.value = targetServ;
          clearFieldError(desInput, document.getElementById('desiredServingsError'));
          updateLiveMultiplierPreview();
          checkInputsDrift();
          showToast(`Target servings set to ${targetServ}! Click 'Scale My Recipe' to apply.`);
        }
      });
    });

    // Copy Recipe
    if (btnCopyRecipe) {
      btnCopyRecipe.addEventListener('click', () => {
        if (!activeCalculatedResult) return;
        const res = activeCalculatedResult;
        const multiplier = (Number(res.desiredServings) || 1) / (Number(res.origServings) || 1);

        const ingredientLines = Array.isArray(res.ingredients)
          ? res.ingredients.map(i => `• ${i.name}: ${formatNumber(i.scaledAmount)} ${i.unit || ''}`.trim()).join('\n')
          : '';

        const text = 
`🍴 ${res.dishName} (Scaled Recipe)
Yield: ${formatNumber(res.desiredServings)} servings (${formatNumber(multiplier)}× original recipe)

Ingredients:
${ingredientLines}

Scaled with RecipeRatio Studio`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => {
            showToast('Scaled recipe copied to clipboard!');
          }).catch(() => {
            fallbackCopyText(text);
          });
        } else {
          fallbackCopyText(text);
        }
      });
    }

    // Reset All Form
    if (btnResetForm) {
      btnResetForm.addEventListener('click', () => {
        const confirmed = window.confirm('Reset all recipe fields and clear current calculations?');
        if (!confirmed) return;

        if (form) form.reset();
        clearAllErrors();
        lastCalculatedInputs = null;
        activeCalculatedResult = null;

        const container = document.getElementById('ingredientsContainer');
        if (container) {
          container.innerHTML = '';
          addIngredientRow({ name: '', amount: '', unit: 'g' });
          addIngredientRow({ name: '', amount: '', unit: 'pcs' });
          addIngredientRow({ name: '', amount: '', unit: 'ml' });
        }

        const emptyState = document.getElementById('emptyState');
        const resultContent = document.getElementById('resultContent');
        const outdatedNotice = document.getElementById('outdatedNotice');

        if (emptyState) emptyState.style.display = 'block';
        if (resultContent) resultContent.classList.remove('visible');
        if (outdatedNotice) outdatedNotice.classList.remove('visible');

        updateLiveMultiplierPreview();

        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}

        showToast('Recipe canvas reset.');
      });
    }

    // Kitchen Notes
    function persistNotes() {
      const notesInput = document.getElementById('kitchenNotesInput');
      const status = document.getElementById('notesSavedStatus');
      if (!notesInput) return;
      const notes = notesInput.value;
      try {
        localStorage.setItem(NOTES_STORAGE_KEY, notes);
        if (status) {
          status.textContent = 'Saved just now';
          setTimeout(() => {
            status.textContent = 'Autosaved to browser';
          }, 3000);
        }
      } catch (e) {}
    }

    if (btnSaveNotes) {
      btnSaveNotes.addEventListener('click', () => {
        persistNotes();
        showToast('Kitchen note saved!');
      });
    }

    if (kitchenNotesInput) {
      kitchenNotesInput.addEventListener('input', () => {
        const status = document.getElementById('notesSavedStatus');
        if (status) status.textContent = 'Saving...';
        persistNotes();
      });
    }

    // Next Tip button
    if (btnNextTip) {
      btnNextTip.addEventListener('click', () => {
        const tipBox = document.getElementById('tipContentBox');
        currentTipIndex = (currentTipIndex + 1) % CULINARY_TIPS.length;
        if (tipBox) {
          tipBox.textContent = CULINARY_TIPS[currentTipIndex];
        }
      });
    }

    // Core inputs live clearing & drift detection
    const coreInputIds = [
      { id: 'dishName', errId: 'dishNameError' },
      { id: 'originalServings', errId: 'originalServingsError' },
      { id: 'desiredServings', errId: 'desiredServingsError' }
    ];

    coreInputIds.forEach(item => {
      const el = document.getElementById(item.id);
      const errEl = document.getElementById(item.errId);
      if (el) {
        el.addEventListener('input', () => {
          clearFieldError(el, errEl);
          updateLiveMultiplierPreview();
          checkInputsDrift();
        });
      }
    });

    // Initialize Theme and Saved State
    initTheme();
    restoreFromLocalStorage();
  }

  // Safe Lifecycle Execution
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupApp);
  } else {
    setupApp();
  }
})();