// 需求表欄位的畫面產生、取值、帶入與比對；客戶填寫頁與後台編輯共用。
// 所有查找都限定在傳入的 root 容器內，不依賴全域 id。

function leadFieldHtml(f) {
  const req = f.required ? '<span class="req">*</span>' : '';
  const label = `<span class="field-label">${leadEscape(f.label)}${req}</span>`;
  const hint = f.hint ? `<div class="hint">${leadEscape(f.hint)}</div>` : '';
  let control = '';
  switch (f.type) {
    case 'select':
      control = `<select data-input="${f.key}"><option value="">請選擇</option>${f.options.map(o => `<option>${leadEscape(o)}</option>`).join('')}</select>`;
      break;
    case 'radio':
    case 'checks': {
      const t = f.type === 'radio' ? 'radio' : 'checkbox';
      control = `<div class="pill-group">${f.options.map(o => `<label class="pill"><input type="${t}" data-choice="${f.key}" value="${leadEscape(o)}">${leadEscape(o)}</label>`).join('')}</div>`;
      if (f.other) {
        control += `<input type="text" class="other-input" data-input="${f.other.key}" data-other-of="${f.key}" maxlength="${f.other.max}" placeholder="${leadEscape(f.other.label)}" hidden>`;
      }
      break;
    }
    case 'textarea':
      control = `<textarea data-input="${f.key}" maxlength="${f.max || 2000}" placeholder="${leadEscape(f.placeholder || '')}"></textarea>`;
      break;
    case 'budget':
      control = `<div class="budget-wrap"><span class="budget-label">${f.min}萬</span><input type="range" data-budget="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${f.initial}"><span class="budget-label">${f.max}萬</span><span class="budget-val">${f.initial} 萬</span></div>
        <label class="pill" style="align-self:flex-start;margin-top:6px"><input type="checkbox" data-budget-unsure="${f.key}">預算尚未確定</label>`;
      break;
    default: {
      const attrs = [`type="${f.type}"`, `data-input="${f.key}"`];
      if (f.placeholder) attrs.push(`placeholder="${leadEscape(f.placeholder)}"`);
      if (f.max && f.type !== 'number') attrs.push(`maxlength="${f.max}"`);
      if (f.type === 'number') attrs.push(`min="${f.min}"`, `max="${f.max}"`, 'inputmode="numeric"');
      if (f.type === 'tel') attrs.push('autocomplete="tel"');
      if (f.key === 'name') attrs.push('autocomplete="name"');
      if (f.type === 'email') attrs.push('autocomplete="email"');
      control = `<input ${attrs.join(' ')}>`;
    }
  }
  return `<div class="field-group" data-key="${f.key}">${label}${control}${hint}</div>`;
}

function renderLeadForm(root) {
  root.innerHTML = LEAD_SECTIONS.map(section => {
    const rows = [];
    section.fields.forEach(f => {
      const last = rows[rows.length - 1];
      if (f.row && last && last.row === f.row) last.fields.push(f);
      else rows.push({ row: f.row, fields: [f] });
    });
    const body = rows.map(r => `<div class="field-row" style="--cols:${r.fields.length}">${r.fields.map(leadFieldHtml).join('')}</div>`).join('');
    return `<div class="form-section"><div class="section-title">${leadEscape(section.title)}</div>${body}</div>`;
  }).join('');

  root.querySelectorAll('[data-budget]').forEach(range => {
    const wrap = range.closest('.field-group');
    const val = wrap.querySelector('.budget-val');
    const unsure = wrap.querySelector('[data-budget-unsure]');
    range.addEventListener('input', () => { range.dataset.touched = '1'; unsure.checked = false; val.textContent = range.value + ' 萬'; });
    unsure.addEventListener('change', () => { range.disabled = unsure.checked; val.textContent = unsure.checked ? '未定' : range.value + ' 萬'; });
  });
  root.addEventListener('change', e => {
    if (e.target.dataset.choice) leadSyncOther(root, e.target.dataset.choice);
  });
}

function leadSyncOther(root, key) {
  const f = LEAD_SECTIONS.flatMap(s => s.fields).find(x => x.key === key);
  if (!f?.other) return;
  const checked = [...root.querySelectorAll(`[data-choice="${key}"]:checked`)].some(c => c.value === f.other.option);
  const input = root.querySelector(`[data-other-of="${key}"]`);
  input.hidden = !checked;
}

function collectLeadValues(root) {
  const out = {};
  const put = (key, v, max) => {
    v = String(v ?? '').trim().slice(0, max || 2000);
    if (v) out[key] = v;
  };
  LEAD_SECTIONS.forEach(section => section.fields.forEach(f => {
    if (f.type === 'radio' || f.type === 'checks') {
      const picked = [...root.querySelectorAll(`[data-choice="${f.key}"]:checked`)].map(c => c.value);
      put(f.key, picked.join('、'));
      if (f.other && picked.includes(f.other.option)) put(f.other.key, root.querySelector(`[data-input="${f.other.key}"]`).value, f.other.max);
    } else if (f.type === 'budget') {
      const range = root.querySelector(`[data-budget="${f.key}"]`);
      if (root.querySelector(`[data-budget-unsure="${f.key}"]`).checked) put(f.key, '尚未確定');
      else if (range.dataset.touched) put(f.key, range.value + ' 萬');
    } else {
      put(f.key, root.querySelector(`[data-input="${f.key}"]`).value, f.max);
    }
  }));
  return out;
}

function setLeadValues(root, form) {
  form = form || {};
  LEAD_SECTIONS.forEach(section => section.fields.forEach(f => {
    const v = form[f.key] || '';
    if (f.type === 'radio' || f.type === 'checks') {
      const picked = v ? v.split('、') : [];
      root.querySelectorAll(`[data-choice="${f.key}"]`).forEach(c => { c.checked = picked.includes(c.value); });
      if (f.other) {
        root.querySelector(`[data-input="${f.other.key}"]`).value = form[f.other.key] || '';
        leadSyncOther(root, f.key);
      }
    } else if (f.type === 'budget') {
      const range = root.querySelector(`[data-budget="${f.key}"]`);
      const unsure = root.querySelector(`[data-budget-unsure="${f.key}"]`);
      const val = range.closest('.field-group').querySelector('.budget-val');
      const n = parseInt(v, 10);
      unsure.checked = v === '尚未確定';
      range.disabled = unsure.checked;
      if (Number.isFinite(n)) { range.value = n; range.dataset.touched = '1'; }
      else { range.value = f.initial; delete range.dataset.touched; }
      val.textContent = unsure.checked ? '未定' : range.value + ' 萬';
    } else {
      root.querySelector(`[data-input="${f.key}"]`).value = v;
    }
  }));
}

// 回傳「欄位：舊 → 新」逐行文字；沒有差異時回傳空字串
function diffLeadForms(before, after) {
  before = before || {}; after = after || {};
  const keys = Object.keys(LEAD_FIELD_LABELS).filter(k => (before[k] || '') !== (after[k] || ''));
  return keys.map(k => `${LEAD_FIELD_LABELS[k]}：${before[k] || '（空白）'} → ${after[k] || '（空白）'}`).join('\n').slice(0, 4000);
}

function leadRandomToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map(b => chars[b % chars.length]).join('');
}

function leadEditUrl(token) {
  return new URL(`./?edit=${token}`, location.href.replace(/admin\.html.*$/, '')).href;
}
