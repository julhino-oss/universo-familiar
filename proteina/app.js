'use strict';

/* =========================================================
   Proteína — seguimiento de proteína y calorías
   Todo vive en localStorage bajo una sola clave.
   ========================================================= */

const STORE_KEY = 'proteina.v1';

const MEALS = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'merienda', label: 'Merienda de proteína', short: 'Merienda', hint: 'Yogur o batido' },
  { id: 'almuerzo', label: 'Almuerzo' },
  { id: 'cena', label: 'Cena' },
];

// Rutina: 0 = domingo … 6 = sábado
const ROUTINE = {
  0: 'Descanso',
  1: 'Pesas · pierna',
  2: 'Pesas + cardio 25 min',
  3: 'Pesas + cardio 25 min',
  4: 'Pesas · pierna',
  5: 'Pesas + cardio 25 min',
  6: 'Descanso',
};

const DEFAULT_SETTINGS = {
  protein: 150,
  pMin: 140,
  pMax: 160,
  kcal: 2400,
  fridayKcal: 2900,
  theme: 'dark',
};

function defaultFavorites() {
  return [
    {
      id: 'orgain', name: 'Orgain Organic Protein vainilla', unit: 'porción', per: 1,
      pMin: 21, pMax: 21, kMin: 150, kMax: 150, verified: true, meal: 'merienda',
      info: '1 porción = 2 scoops (46 g) · 3,5 g grasa · 15 g carbohidratos · 4 g fibra',
    },
    {
      id: 'yogur-tj', name: "Yogur griego natural sin grasa (Trader Joe's)", unit: 'envase', per: 1,
      pMin: 15, pMax: 15, kMin: 90, kMax: 90, verified: true, meal: 'merienda',
      info: '1 envase = 150 g · 0 g grasa · 6 g carbohidratos · 4 g azúcares (0 g añadidos)',
    },
    {
      id: 'almendra', name: 'Leche de almendra Almond Breeze sin azúcar', unit: 'taza', per: 1,
      pMin: 1, pMax: 1, kMin: 30, kMax: 40, verified: false,
      info: 'Estimado. Verifica los valores en tu envase y edítalos aquí.',
    },
    {
      id: 'sandwich', name: 'Sándwich masa madre: pollo, pavo y queso', unit: 'sándwich', per: 1,
      pMin: 50, pMax: 60, kMin: 550, kMax: 650, verified: false,
      info: 'Pechuga ~100-120 g cocida, 2 lonchas de pavo, 2 de queso.',
    },
    {
      id: 'lentejas', name: 'Lentejas con arroz y salchicha', unit: 'plato', per: 1,
      pMin: 28, pMax: 35, kMin: 600, kMax: 780, verified: false,
      info: 'Con zanahoria y pimiento.',
    },
    {
      id: 'pollo', name: 'Pechuga de pollo cocida', unit: 'g', per: 100,
      pMin: 31, pMax: 31, kMin: 165, kMax: 165, verified: false,
      info: 'Referencia común por 100 g, sin piel y sin grasa añadida. Varía según la cocción.',
    },
    {
      id: 'sprite', name: 'Sprite (lata)', unit: 'lata', per: 1,
      pMin: 0, pMax: 0, kMin: 140, kMax: 140, verified: true,
      info: 'Valores de etiqueta.',
    },
  ];
}

function defaultState(seed) {
  return {
    settings: { ...DEFAULT_SETTINGS },
    days: {},
    favorites: defaultFavorites(),
    body: seed ? [{ date: '2026-09-30', weight: 86.15, waist: null }] : [],
  };
}

/* ---------------- Persistencia ---------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState(true);
    const s = JSON.parse(raw);
    return {
      settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
      days: s.days && typeof s.days === 'object' ? s.days : {},
      favorites: Array.isArray(s.favorites) ? s.favorites : defaultFavorites(),
      body: Array.isArray(s.body) ? s.body : [],
    };
  } catch (e) {
    return defaultState(true);
  }
}

let state = loadState();

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('No se pudo guardar en este navegador');
  }
}

/* ---------------- Utilidades ---------------- */

const $ = (sel) => document.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Formato español: 2.400 · 10,5
function fmt(n, dec = 0) {
  const f = Math.pow(10, dec);
  const r = Math.round(n * f) / f;
  const [int, frac] = Math.abs(r).toFixed(dec).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const trimmed = frac && /[1-9]/.test(frac) ? ',' + frac.replace(/0+$/, '') : '';
  return (r < 0 ? '−' : '') + grouped + trimmed;
}

// Muestra un valor o un rango: "21 g", "~50-60 g"
function rangeText(min, max, unit, exact, dec = 0) {
  const u = unit ? ' ' + unit : '';
  if (fmt(min, dec) === fmt(max, dec)) return (exact ? '' : '~') + fmt(min, dec) + u;
  return '~' + fmt(min, dec) + '-' + fmt(max, dec) + u;
}

function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(k, n) {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

const todayKey = () => dateKey(new Date());

function shortDate(k) {
  return parseKey(k).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

// Número con coma o punto decimal. Devuelve NaN si no es válido.
function parseNum(s) {
  const t = String(s).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}

// "50-60" | "50" → { min, max } o { error }
function parseRange(s, what) {
  const t = String(s).trim();
  if (!t) return { error: `Falta ${what}.` };
  const parts = t.split(/\s*[-–—]\s*/);
  if (parts.length > 2 || parts.some((p) => p === '')) {
    return { error: `${cap(what)}: «${t}» no es válido. Usa un número (21) o un rango (50-60).` };
  }
  const nums = parts.map(parseNum);
  if (nums.some(isNaN)) {
    return { error: `${cap(what)}: «${t}» no es un número válido. Usa solo cifras, por ejemplo 50-60.` };
  }
  const min = nums[0];
  const max = nums.length === 2 ? nums[1] : nums[0];
  if (min > max) return { error: `${cap(what)}: el mínimo (${fmt(min, 1)}) es mayor que el máximo (${fmt(max, 1)}).` };
  return { min, max };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Comprobaciones de sentido común para no guardar datos erróneos
function sanityCheck(p, k) {
  if (p.max > 300) return 'La proteína parece demasiado alta para una sola comida (más de 300 g). Revisa el dato.';
  if (k.max > 5000) return 'Las calorías parecen demasiado altas para una sola comida (más de 5.000 kcal). Revisa el dato.';
  // 1 g de proteína ≈ 4 kcal: si las kcal son menores, probablemente están invertidos los campos
  if (k.max < p.min * 3.4) {
    return `Revisa los datos: ${fmt(p.min)} g de proteína ya aportan unas ${fmt(p.min * 4)} kcal, pero pusiste ${fmt(k.max)} kcal. ¿Invertiste proteína y calorías?`;
  }
  return null;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------------- Datos del día ---------------- */

function getDay(k) {
  return state.days[k] || { friday: false, items: [] };
}

function ensureDay(k) {
  if (!state.days[k]) state.days[k] = { friday: false, items: [] };
  return state.days[k];
}

function totals(day) {
  const t = { pMin: 0, pMax: 0, kMin: 0, kMax: 0, exact: true, count: 0 };
  for (const it of day.items) {
    t.pMin += it.pMin; t.pMax += it.pMax;
    t.kMin += it.kMin; t.kMax += it.kMax;
    if (!it.exact) t.exact = false;
    t.count++;
  }
  t.p = (t.pMin + t.pMax) / 2;
  t.k = (t.kMin + t.kMax) / 2;
  return t;
}

const kcalGoal = (day) => (day.friday ? state.settings.fridayKcal : state.settings.kcal);

/* ---------------- Estado de la interfaz ---------------- */

let viewDate = todayKey();
let currentView = 'hoy';

/* =========================================================
   Vista: HOY
   ========================================================= */

function renderToday() {
  const k = viewDate;
  const day = getDay(k);
  const t = totals(day);
  const s = state.settings;
  const d = parseKey(k);
  const isToday = k === todayKey();

  // Encabezado
  const long = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#day-label').textContent = isToday ? 'Hoy' : k === addDays(todayKey(), -1) ? 'Ayer' : cap(long);
  $('#day-type').textContent = (isToday || k === addDays(todayKey(), -1) ? cap(long) + ' · ' : '') + ROUTINE[d.getDay()];
  $('#next-day').disabled = isToday;

  // Modo Viernes
  $('#friday-toggle').checked = !!day.friday;
  $('#friday-row').classList.toggle('on', !!day.friday);
  $('#friday-hint').textContent = day.friday
    ? `Meta de ${fmt(s.fridayKcal)} kcal · la barra no se pone en rojo`
    : d.getDay() === 5 ? 'Hoy es viernes 🍦 ¿Activas tu día de antojos?' : 'Día de antojos: sube la meta de calorías';

  // Proteína
  const pScale = Math.max(s.pMax * 1.1, s.protein * 1.1, t.pMax);
  $('#p-total').textContent = t.count ? (t.exact || fmt(t.pMin) === fmt(t.pMax) ? '' : '~') + fmt(t.p) : '0';
  $('#p-goal').textContent = fmt(s.protein);
  $('#p-bar').style.width = pct(t.p, pScale);
  $('#p-range-bar').style.width = pct(t.pMax, pScale);
  $('#p-target').style.left = pct(s.pMin, pScale);
  $('#p-target').style.width = pct(s.pMax - s.pMin, pScale);
  const pMeter = $('#meter-protein');
  pMeter.classList.toggle('done', t.p >= s.pMin);
  let pSub = t.count ? 'Rango del día: ' + rangeText(t.pMin, t.pMax, 'g', t.exact) : 'Aún no hay comidas registradas.';
  if (t.count) {
    if (t.p > s.pMax) pSub += ` · por encima de tu rango (${fmt(s.pMin)}-${fmt(s.pMax)} g)`;
    else if (t.p >= s.pMin) pSub += ' · ✓ dentro de tu rango';
    else pSub += ` · faltan ~${fmt(s.protein - t.p)} g`;
  }
  $('#p-sub').textContent = pSub;

  // Calorías
  const goal = kcalGoal(day);
  const kScale = Math.max(goal, t.kMax);
  $('#k-total').textContent = t.count ? (t.exact || fmt(t.kMin) === fmt(t.kMax) ? '' : '~') + fmt(t.k) : '0';
  $('#k-goal').textContent = fmt(goal);
  $('#k-bar').style.width = pct(t.k, kScale);
  $('#k-range-bar').style.width = pct(t.kMax, kScale);
  const over = t.k > goal;
  $('#meter-kcal').classList.toggle('over', over && !day.friday);
  let kSub = t.count ? 'Rango del día: ' + rangeText(t.kMin, t.kMax, 'kcal', t.exact) : '';
  if (t.count) {
    kSub += over ? ` · ${fmt(t.k - goal)} kcal por encima` : ` · quedan ~${fmt(goal - t.k)} kcal`;
  }
  if (day.friday) kSub = (kSub ? kSub + ' · ' : '') + '🍦 Modo Viernes';
  $('#k-sub').textContent = kSub;

  renderSuggestion(day, t, isToday);
  renderMeals(day);
}

function pct(v, scale) {
  return Math.max(0, Math.min(100, (v / scale) * 100)) + '%';
}

function renderSuggestion(day, t, isToday) {
  const s = state.settings;
  const box = $('#suggest');
  if (t.p >= s.pMin) {
    box.innerHTML = `<strong>✓ Meta de proteína cumplida.</strong> Llevas ~${fmt(t.p)} g de ${fmt(s.protein)} g.`;
    return;
  }
  const missing = s.protein - t.p;
  if (!isToday) {
    box.innerHTML = t.count
      ? `Ese día quedaron <strong>~${fmt(missing)} g</strong> por debajo de la meta de ${fmt(s.protein)} g.`
      : 'No hay registros para este día.';
    return;
  }
  // Comidas restantes: las que siguen a la última comida con registros
  let last = -1;
  MEALS.forEach((m, i) => { if (day.items.some((it) => it.meal === m.id)) last = i; });
  const left = MEALS.slice(last + 1);
  if (left.length) {
    const per = missing / left.length;
    box.innerHTML = `Te faltan <strong>~${fmt(missing)} g</strong> para ${fmt(s.protein)} g. ` +
      `Te ${left.length === 1 ? 'queda 1 comida' : `quedan ${left.length} comidas`} ` +
      `(${left.map((m) => m.short || m.label).join(', ')}) → <strong>~${fmt(per)} g por comida</strong>.`;
  } else {
    box.innerHTML = `Te faltan <strong>~${fmt(missing)} g</strong> y ya registraste todas las comidas. ` +
      'Un batido Orgain (21 g) o un yogur griego (15 g) extra ayudarían.';
  }
}

function renderMeals(day) {
  const html = MEALS.map((m) => {
    const items = day.items.filter((it) => it.meal === m.id);
    const t = totals({ items });
    const sum = items.length
      ? `${rangeText(t.pMin, t.pMax, 'g', t.exact)} · ${rangeText(t.kMin, t.kMax, 'kcal', t.exact)}`
      : m.hint || 'Sin registrar';
    const list = items.map((it) => `
      <li class="item" data-item="${it.id}">
        <span class="item-name">${esc(it.name)}${it.craving ? ' <span class="tag">🍦 antojo</span>' : ''}${it.exact ? ' <span class="tag ok">✔</span>' : ''}</span>
        <span class="item-vals"><strong>${rangeText(it.pMin, it.pMax, 'g', it.exact, 1)}</strong><br><span class="muted">${rangeText(it.kMin, it.kMax, 'kcal', it.exact)}</span></span>
      </li>`).join('');
    return `
      <div class="card meal">
        <div class="meal-head">
          <div><h2>${m.label}</h2><span class="muted meal-sum">${sum}</span></div>
          <button class="meal-add" data-meal="${m.id}" aria-label="Añadir a ${m.label}">+</button>
        </div>
        ${items.length ? `<ul class="items">${list}</ul>` : ''}
      </div>`;
  }).join('');
  $('#meals').innerHTML = html;
}

/* =========================================================
   Hoja: AÑADIR / EDITAR COMIDA
   ========================================================= */

let addMeal = 'desayuno';
let editingItemId = null;

function guessMeal() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10) return 'desayuno';
  if (h < 12) return 'merienda';
  if (h < 17) return 'almuerzo';
  return 'cena';
}

function renderMealSeg() {
  $('#meal-seg').innerHTML = MEALS.map((m) =>
    `<button type="button" data-seg="${m.id}" class="${m.id === addMeal ? 'active' : ''}">${m.short || m.label}</button>`
  ).join('');
}

function renderFavs() {
  $('#fav-list').innerHTML = state.favorites.map((f) => {
    const perTxt = f.unit === 'g' ? `por ${fmt(f.per)} g` : `por ${f.unit || 'porción'}`;
    return `<button type="button" class="fav" data-fav="${f.id}">
      <span>${f.verified ? '✔' : '≈'} ${esc(f.name)}</span>
      <small>${rangeText(f.pMin, f.pMax, 'g', f.verified, 1)} · ${rangeText(f.kMin, f.kMax, 'kcal', f.verified)}<br>${esc(perTxt)}</small>
    </button>`;
  }).join('') || '<p class="muted small">No tienes comidas frecuentes.</p>';
}

function openAdd(meal, itemId) {
  editingItemId = itemId || null;
  const day = getDay(viewDate);
  const item = itemId ? day.items.find((it) => it.id === itemId) : null;
  addMeal = item ? item.meal : meal || guessMeal();

  $('#add-title').textContent = item ? 'Editar comida' : 'Añadir comida';
  $('#add-new-part').hidden = !!item;
  $('#item-delete').hidden = !item;
  $('#item-submit').textContent = item ? 'Guardar cambios' : 'Guardar';
  $('#craving-row').hidden = !(day.friday || (item && item.craving));
  ['#quick-error', '#item-error'].forEach((s) => ($(s).textContent = ''));
  $('#quick-input').value = '';

  $('#f-name').value = item ? item.name : '';
  $('#f-pmin').value = item ? fmtInput(item.pMin) : '';
  $('#f-pmax').value = item && item.pMax !== item.pMin ? fmtInput(item.pMax) : '';
  $('#f-kmin').value = item ? fmtInput(item.kMin) : '';
  $('#f-kmax').value = item && item.kMax !== item.kMin ? fmtInput(item.kMax) : '';
  $('#f-exact').checked = item ? !!item.exact : false;
  $('#f-craving').checked = item ? !!item.craving : false;

  renderMealSeg();
  renderFavs();
  openSheet('#add-sheet');
}

function fmtInput(n) {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

function addItem(item) {
  const day = ensureDay(viewDate);
  day.items.push({ id: uid(), meal: addMeal, craving: false, ...item });
  save();
  renderToday();
}

// Registro rápido: "nombre | proteína | kcal"
function parseQuick(line) {
  const parts = line.split('|').map((p) => p.trim());
  if (!line.trim()) return { error: 'Pega una línea con el formato: nombre | proteína | kcal.' };
  if (parts.length !== 3) {
    return { error: `El formato necesita 3 partes separadas por «|» (nombre | proteína | kcal). Encontré ${parts.length}.` };
  }
  const [name, pStr, kStr] = parts;
  if (!name) return { error: 'Falta el nombre de la comida antes del primer «|».' };
  const p = parseRange(pStr, 'la proteína');
  if (p.error) return p;
  const k = parseRange(kStr, 'las calorías');
  if (k.error) return k;
  const bad = sanityCheck(p, k);
  if (bad) return { error: bad };
  return { name, pMin: p.min, pMax: p.max, kMin: k.min, kMax: k.max, exact: false };
}

function readRangeFields(minSel, maxSel, what) {
  const minS = $(minSel).value.trim();
  const maxS = $(maxSel).value.trim();
  if (!minS && !maxS) return { error: `Falta ${what}.` };
  if (!minS) return { error: `Falta el mínimo de ${what}.` };
  return parseRange(maxS ? `${minS}-${maxS}` : minS, what);
}

/* =========================================================
   Hoja: COMIDA FRECUENTE (usar o editar)
   ========================================================= */

let activeFavId = null;

function favDefaults(f) {
  const big = f.per >= 10;
  return { qty: big ? f.per : 1, step: big ? 10 : 0.5 };
}

function openFav(id, editMode) {
  activeFavId = id;
  const f = state.favorites.find((x) => x.id === id);
  const isNew = !f;
  $('#fav-title').textContent = isNew ? 'Nueva comida frecuente' : f.name;
  $('#fav-use').hidden = isNew || editMode;
  $('#fav-form').hidden = !(isNew || editMode);
  $('#fav-delete').hidden = isNew;
  $('#fav-error').textContent = '';
  $('#qty-error').textContent = '';

  if (f) {
    $('#fav-info').innerHTML = (f.verified ? '<span class="tag ok">✔ etiqueta verificada</span> ' : '<span class="tag">≈ estimado</span> ') +
      esc(f.info || '');
    $('#qty-label').textContent = f.unit === 'g' ? 'Gramos' : `¿Cuántas ${pluralUnit(f.unit)}?`;
    $('#qty-input').value = fmtInput(favDefaults(f).qty);
    $('#fav-craving').checked = false;
    $('#fav-craving-row').hidden = !getDay(viewDate).friday;
    updateQtyPreview();
  }

  $('#fe-name').value = f ? f.name : '';
  $('#fe-unit').value = f ? f.unit : 'porción';
  $('#fe-per').value = f ? fmtInput(f.per) : '1';
  $('#fe-pmin').value = f ? fmtInput(f.pMin) : '';
  $('#fe-pmax').value = f && f.pMax !== f.pMin ? fmtInput(f.pMax) : '';
  $('#fe-kmin').value = f ? fmtInput(f.kMin) : '';
  $('#fe-kmax').value = f && f.kMax !== f.kMin ? fmtInput(f.kMax) : '';
  $('#fe-info').value = f ? f.info || '' : '';
  $('#fe-verified').checked = f ? !!f.verified : false;

  openSheet('#fav-sheet');
}

function pluralUnit(u) {
  if (!u) return 'porciones';
  const map = { 'porción': 'porciones', 'envase': 'envases', 'taza': 'tazas', 'lata': 'latas', 'plato': 'platos', 'sándwich': 'sándwiches' };
  return map[u] || u;
}

function currentQty() {
  return parseNum($('#qty-input').value);
}

function updateQtyPreview() {
  const f = state.favorites.find((x) => x.id === activeFavId);
  if (!f) return;
  const q = currentQty();
  if (isNaN(q) || q <= 0) {
    $('#qty-preview').textContent = '';
    return;
  }
  const m = q / f.per;
  $('#qty-preview').textContent =
    `= ${rangeText(f.pMin * m, f.pMax * m, 'g proteína', f.verified, 1)} · ${rangeText(f.kMin * m, f.kMax * m, 'kcal', f.verified)}`;
}

function stepQty(dir) {
  const f = state.favorites.find((x) => x.id === activeFavId);
  if (!f) return;
  const { step } = favDefaults(f);
  const q = currentQty();
  const next = Math.max(step, (isNaN(q) ? 0 : q) + dir * step);
  $('#qty-input').value = fmtInput(Math.round(next * 10) / 10);
  updateQtyPreview();
}

function addFromFav() {
  const f = state.favorites.find((x) => x.id === activeFavId);
  const q = currentQty();
  if (isNaN(q) || q <= 0) {
    $('#qty-error').textContent = 'Escribe una cantidad válida mayor que 0 (por ejemplo 1 o 1,5).';
    return;
  }
  if (q / f.per > 20) {
    $('#qty-error').textContent = 'La cantidad parece demasiado grande. Revísala.';
    return;
  }
  const m = q / f.per;
  const name = f.unit === 'g'
    ? `${f.name} (${fmt(q, 1)} g)`
    : q === 1 ? f.name : `${f.name} ×${fmt(q, 1)}`;
  addItem({
    name,
    pMin: f.pMin * m, pMax: f.pMax * m,
    kMin: f.kMin * m, kMax: f.kMax * m,
    exact: !!f.verified,
    craving: getDay(viewDate).friday && $('#fav-craving').checked,
    fav: f.id, qty: q,
  });
  closeSheet('#fav-sheet');
  closeSheet('#add-sheet');
  toast(`Añadido a ${MEALS.find((mm) => mm.id === addMeal).label.toLowerCase()}`);
}

function saveFav(e) {
  e.preventDefault();
  const err = (msg) => ($('#fav-error').textContent = msg);
  const name = $('#fe-name').value.trim();
  if (!name) return err('Falta el nombre.');
  const per = parseNum($('#fe-per').value);
  if (isNaN(per) || per <= 0) return err('«Valores por» debe ser un número mayor que 0 (1 para una porción, 100 para 100 g).');
  const p = readRangeFields('#fe-pmin', '#fe-pmax', 'la proteína');
  if (p.error) return err(p.error);
  const k = readRangeFields('#fe-kmin', '#fe-kmax', 'las calorías');
  if (k.error) return err(k.error);
  const verified = $('#fe-verified').checked;
  if (verified && (p.min !== p.max || k.min !== k.max)) {
    return err('Una etiqueta verificada usa valores exactos: deja vacío el campo «máx».');
  }
  const bad = sanityCheck({ min: p.min / per, max: p.max / per }, { min: k.min / per, max: k.max / per });
  if (bad) return err(bad);

  const data = {
    name, unit: $('#fe-unit').value.trim() || 'porción', per,
    pMin: p.min, pMax: p.max, kMin: k.min, kMax: k.max,
    verified, info: $('#fe-info').value.trim(),
  };
  const existing = state.favorites.find((x) => x.id === activeFavId);
  if (existing) Object.assign(existing, data);
  else state.favorites.push({ id: uid(), ...data });
  save();
  renderFavs();
  closeSheet('#fav-sheet');
  toast('Comida frecuente guardada');
}

/* =========================================================
   Vista: HISTORIAL
   ========================================================= */

function renderHistory() {
  const s = state.settings;
  const keys = [];
  for (let i = 6; i >= 0; i--) keys.push(addDays(todayKey(), -i));
  const rows = keys.map((k) => ({ k, day: getDay(k), t: totals(getDay(k)) }));
  const logged = rows.filter((r) => r.t.count > 0);

  if (logged.length) {
    const avgP = logged.reduce((a, r) => a + r.t.p, 0) / logged.length;
    const avgK = logged.reduce((a, r) => a + r.t.k, 0) / logged.length;
    $('#avg-p').textContent = `~${fmt(avgP)} g`;
    $('#avg-k').textContent = `~${fmt(avgK)}`;
    $('#avg-note').textContent = `Promedio de ${logged.length} ${logged.length === 1 ? 'día' : 'días'} con registro (de 7). Meta: ${fmt(s.protein)} g.`;
  } else {
    $('#avg-p').textContent = '–';
    $('#avg-k').textContent = '–';
    $('#avg-note').textContent = 'Aún no hay días con registro esta semana.';
  }

  $('#hist-chart').innerHTML = barChart(rows);

  $('#hist-list').innerHTML = rows.slice().reverse().map((r) => {
    const d = parseKey(r.k);
    const label = cap(d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }));
    const vals = r.t.count
      ? `<strong>${rangeText(r.t.pMin, r.t.pMax, 'g', r.t.exact)}</strong> · <span class="muted">${rangeText(r.t.kMin, r.t.kMax, 'kcal', r.t.exact)}</span>`
      : '<span class="muted">Sin registro</span>';
    return `<li class="clickable" data-goto="${r.k}"><span>${label}${r.day.friday ? ' 🍦' : ''}</span><span>${vals}</span></li>`;
  }).join('');
}

function barChart(rows) {
  const s = state.settings;
  const W = 340, H = 200, top = 22, bottom = 26, left = 6, right = 6;
  const plotH = H - top - bottom;
  const maxV = Math.max(s.pMax * 1.1, ...rows.map((r) => r.t.pMax));
  const y = (v) => top + plotH - (v / maxV) * plotH;
  const slot = (W - left - right) / rows.length;
  const bw = slot * 0.56;
  const letters = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Proteína de los últimos 7 días">`;
  // Banda del rango objetivo y línea de meta
  out += `<rect x="${left}" y="${y(s.pMax)}" width="${W - left - right}" height="${y(s.pMin) - y(s.pMax)}" fill="var(--accent-soft)" opacity="0.5"/>`;
  out += `<line x1="${left}" x2="${W - right}" y1="${y(s.protein)}" y2="${y(s.protein)}" stroke="var(--text)" stroke-dasharray="4 4" opacity="0.5"/>`;
  out += `<text x="${left}" y="${y(s.pMax) - 5}">meta ${fmt(s.protein)} g</text>`;
  rows.forEach((r, i) => {
    const cx = left + slot * i + slot / 2;
    const d = parseKey(r.k);
    if (r.t.count) {
      const hit = r.t.p >= s.pMin;
      out += `<rect x="${cx - bw / 2}" y="${y(r.t.p)}" width="${bw}" height="${top + plotH - y(r.t.p)}" rx="6" fill="var(--accent)" opacity="${hit ? 1 : 0.5}"/>`;
      if (r.t.pMax !== r.t.pMin) {
        out += `<line x1="${cx}" x2="${cx}" y1="${y(r.t.pMax)}" y2="${y(r.t.pMin)}" stroke="var(--text)" stroke-width="2" opacity="0.6"/>`;
      }
      out += `<text class="val" x="${cx}" y="${Math.min(y(r.t.pMax), y(r.t.p)) - 5}" text-anchor="middle">${fmt(r.t.p)}</text>`;
    } else {
      out += `<text x="${cx}" y="${top + plotH - 4}" text-anchor="middle">–</text>`;
    }
    const isToday = r.k === todayKey();
    out += `<text x="${cx}" y="${H - 8}" text-anchor="middle" ${isToday ? 'class="val"' : ''}>${letters[d.getDay()]}${d.getDate()}</text>`;
  });
  out += `<line x1="${left}" x2="${W - right}" y1="${top + plotH}" y2="${top + plotH}" stroke="var(--border)"/>`;
  return out + '</svg>';
}

/* =========================================================
   Vista: CUERPO (peso y cintura)
   ========================================================= */

function sortedBody() {
  return state.body.slice().sort((a, b) => a.date.localeCompare(b.date));
}

function renderBody() {
  const list = sortedBody();
  if (!$('#b-date').value) $('#b-date').value = todayKey();

  const last = list[list.length - 1];
  if (last) {
    const days = Math.round((parseKey(todayKey()) - parseKey(last.date)) / 86400000);
    $('#body-reminder').textContent = days >= 7
      ? `Tu última medición fue hace ${days} días: toca registrar la de esta semana.`
      : days === 0 ? 'Ya registraste una medición hoy. Consejo: mide siempre en las mismas condiciones.'
        : `Última medición hace ${days} ${days === 1 ? 'día' : 'días'}. Consejo: mide siempre en las mismas condiciones.`;
  } else {
    $('#body-reminder').textContent = 'Registra una medición por semana, siempre en las mismas condiciones.';
  }

  const w = list.filter((e) => e.weight != null).map((e) => ({ date: e.date, v: e.weight }));
  const c = list.filter((e) => e.waist != null).map((e) => ({ date: e.date, v: e.waist }));
  $('#weight-chart').innerHTML = lineChart(w, 'kg');
  $('#waist-chart').innerHTML = lineChart(c, 'cm');
  $('#w-delta').textContent = deltaText(w, 'kg');
  $('#c-delta').textContent = deltaText(c, 'cm');

  $('#body-list').innerHTML = list.slice().reverse().map((e) => `
    <li>
      <span>${cap(parseKey(e.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }))}</span>
      <span>${e.weight != null ? `<strong>${fmt(e.weight, 2)} kg</strong>` : ''}${e.weight != null && e.waist != null ? ' · ' : ''}${e.waist != null ? `${fmt(e.waist, 1)} cm` : ''}</span>
      <button class="icon-btn del" data-del-body="${e.date}" aria-label="Eliminar medición">✕</button>
    </li>`).join('');
}

function deltaText(pts, unit) {
  if (pts.length < 2) return '';
  const d = pts[pts.length - 1].v - pts[0].v;
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
  return `${sign}${fmt(Math.abs(d), 2)} ${unit} desde ${shortDate(pts[0].date)}`;
}

function lineChart(pts, unit) {
  if (pts.length === 0) return '<p class="chart-empty">Sin mediciones todavía.</p>';
  if (pts.length === 1) {
    return `<p class="chart-empty">${fmt(pts[0].v, 2)} ${unit} el ${shortDate(pts[0].date)}.<br>Con 2 mediciones o más verás la tendencia.</p>`;
  }
  const W = 340, H = 170, top = 16, bottom = 24, left = 40, right = 14;
  const t0 = parseKey(pts[0].date).getTime();
  const t1 = parseKey(pts[pts.length - 1].date).getTime();
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  const pad = Math.max((hi - lo) * 0.2, 0.5);
  lo -= pad; hi += pad;
  const x = (d) => left + ((parseKey(d).getTime() - t0) / Math.max(t1 - t0, 1)) * (W - left - right);
  const y = (v) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tendencia en ${unit}">`;
  [hi - pad, lo + pad].forEach((v) => {
    out += `<line x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)"/>`;
    out += `<text x="${left - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v, 1)}</text>`;
  });
  out += `<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  pts.forEach((p) => {
    out += `<circle cx="${x(p.date)}" cy="${y(p.v)}" r="4" fill="var(--accent)"/>`;
  });
  const lastP = pts[pts.length - 1];
  out += `<text class="val" x="${x(lastP.date)}" y="${y(lastP.v) - 9}" text-anchor="end">${fmt(lastP.v, 2)}</text>`;
  out += `<text x="${left}" y="${H - 6}">${shortDate(pts[0].date)}</text>`;
  out += `<text x="${W - right}" y="${H - 6}" text-anchor="end">${shortDate(lastP.date)}</text>`;
  return out + '</svg>';
}

function saveBody(e) {
  e.preventDefault();
  const err = (m) => ($('#body-error').textContent = m);
  err('');
  const date = $('#b-date').value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('Elige una fecha.');
  if (date > todayKey()) return err('La fecha no puede ser futura.');
  const wS = $('#b-weight').value.trim();
  const cS = $('#b-waist').value.trim();
  if (!wS && !cS) return err('Escribe el peso, la cintura o ambos.');
  const w = wS ? parseNum(wS) : null;
  const c = cS ? parseNum(cS) : null;
  if (wS && (isNaN(w) || w < 30 || w > 300)) return err('El peso debe ser un número entre 30 y 300 kg (por ejemplo 86,15).');
  if (cS && (isNaN(c) || c < 40 || c > 200)) return err('La cintura debe ser un número entre 40 y 200 cm.');
  let entry = state.body.find((x) => x.date === date);
  if (!entry) {
    entry = { date, weight: null, waist: null };
    state.body.push(entry);
  }
  if (w != null) entry.weight = w;
  if (c != null) entry.waist = c;
  save();
  $('#b-weight').value = '';
  $('#b-waist').value = '';
  renderBody();
  toast('Medición guardada');
}

/* =========================================================
   Vista: AJUSTES
   ========================================================= */

function renderSettings() {
  const s = state.settings;
  $('#s-protein').value = s.protein;
  $('#s-pmin').value = s.pMin;
  $('#s-pmax').value = s.pMax;
  $('#s-kcal').value = s.kcal;
  $('#s-fkcal').value = s.fridayKcal;
  $('#theme-toggle').checked = s.theme === 'light';
  $('#settings-error').textContent = '';
}

function saveSettings(e) {
  e.preventDefault();
  const err = (m) => ($('#settings-error').textContent = m);
  const v = (sel) => parseNum($(sel).value);
  const protein = v('#s-protein'), pMin = v('#s-pmin'), pMax = v('#s-pmax');
  const kcal = v('#s-kcal'), fridayKcal = v('#s-fkcal');
  if ([protein, pMin, pMax, kcal, fridayKcal].some((n) => isNaN(n))) return err('Todos los campos deben ser números.');
  if (protein < 20 || protein > 400) return err('La meta de proteína debe estar entre 20 y 400 g.');
  if (pMin > pMax) return err('El mínimo del rango no puede ser mayor que el máximo.');
  if (protein < pMin || protein > pMax) return err('La meta de proteína debe estar dentro del rango.');
  if (kcal < 800 || kcal > 6000 || fridayKcal < 800 || fridayKcal > 8000) return err('Las metas de calorías deben estar entre 800 y 6.000 kcal (8.000 en Modo Viernes).');
  Object.assign(state.settings, { protein, pMin, pMax, kcal, fridayKcal });
  save();
  err('');
  toast('Metas guardadas');
}

function applyTheme() {
  const light = state.settings.theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', light ? '#f5f6f4' : '#0e0f10');
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `proteina-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const s = JSON.parse(reader.result);
      if (!s || typeof s !== 'object' || !s.settings || typeof s.days !== 'object') throw new Error('formato');
      if (!confirm('Esto reemplazará todos tus datos actuales por los de la copia. ¿Continuar?')) return;
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
      state = loadState();
      applyTheme();
      renderAll();
      toast('Copia importada');
    } catch (e) {
      toast('El archivo no es una copia válida de esta app');
    }
  };
  reader.readAsText(file);
}

/* =========================================================
   Navegación y hojas
   ========================================================= */

function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
  document.querySelectorAll('.tab[data-view]').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  renderAll();
  window.scrollTo(0, 0);
}

function renderAll() {
  if (currentView === 'hoy') renderToday();
  if (currentView === 'historial') renderHistory();
  if (currentView === 'cuerpo') renderBody();
  if (currentView === 'ajustes') renderSettings();
}

function openSheet(sel) {
  $(sel).hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeSheet(sel) {
  $(sel).hidden = true;
  if ([...document.querySelectorAll('.sheet-backdrop')].every((s) => s.hidden)) document.body.style.overflow = '';
}

/* =========================================================
   Eventos
   ========================================================= */

function bind() {
  document.querySelectorAll('.tab[data-view]').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));
  $('#tab-add').addEventListener('click', () => {
    if (currentView !== 'hoy') showView('hoy');
    openAdd();
  });

  $('#prev-day').addEventListener('click', () => { viewDate = addDays(viewDate, -1); renderToday(); });
  $('#next-day').addEventListener('click', () => {
    if (viewDate < todayKey()) { viewDate = addDays(viewDate, 1); renderToday(); }
  });

  $('#friday-toggle').addEventListener('change', (e) => {
    ensureDay(viewDate).friday = e.target.checked;
    save();
    renderToday();
  });

  $('#meals').addEventListener('click', (e) => {
    const add = e.target.closest('[data-meal]');
    if (add) return openAdd(add.dataset.meal);
    const item = e.target.closest('[data-item]');
    if (item) openAdd(null, item.dataset.item);
  });

  // Cierre de hojas
  document.querySelectorAll('.sheet-backdrop').forEach((b) => {
    b.addEventListener('click', (e) => {
      if (e.target === b || e.target.closest('[data-close]')) closeSheet('#' + b.id);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#fav-sheet').hidden) closeSheet('#fav-sheet');
    else if (!$('#add-sheet').hidden) closeSheet('#add-sheet');
  });

  $('#meal-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg]');
    if (!b) return;
    addMeal = b.dataset.seg;
    renderMealSeg();
  });

  // Registro rápido
  $('#quick-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const r = parseQuick($('#quick-input').value);
    if (r.error) {
      $('#quick-error').textContent = r.error;
      return;
    }
    $('#quick-error').textContent = '';
    addItem({ ...r, craving: false });
    closeSheet('#add-sheet');
    toast(`Añadido: ${r.name}`);
  });
  $('#quick-input').addEventListener('input', () => ($('#quick-error').textContent = ''));

  // Formulario manual / edición
  $('#item-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = (m) => ($('#item-error').textContent = m);
    const name = $('#f-name').value.trim();
    if (!name) return err('Falta el nombre.');
    const p = readRangeFields('#f-pmin', '#f-pmax', 'la proteína');
    if (p.error) return err(p.error);
    const k = readRangeFields('#f-kmin', '#f-kmax', 'las calorías');
    if (k.error) return err(k.error);
    const exact = $('#f-exact').checked;
    if (exact && (p.min !== p.max || k.min !== k.max)) return err('Con etiqueta verificada usa valores exactos: deja vacío el campo «máx».');
    const bad = sanityCheck(p, k);
    if (bad) return err(bad);
    const data = {
      name, pMin: p.min, pMax: p.max, kMin: k.min, kMax: k.max, exact,
      craving: !$('#craving-row').hidden && $('#f-craving').checked,
    };
    if (editingItemId) {
      const it = getDay(viewDate).items.find((x) => x.id === editingItemId);
      Object.assign(it, data, { meal: addMeal });
      save();
      renderToday();
      toast('Cambios guardados');
    } else {
      addItem(data);
      toast(`Añadido: ${name}`);
    }
    closeSheet('#add-sheet');
  });

  $('#item-delete').addEventListener('click', () => {
    const day = ensureDay(viewDate);
    day.items = day.items.filter((x) => x.id !== editingItemId);
    save();
    renderToday();
    closeSheet('#add-sheet');
    toast('Comida eliminada');
  });

  // Frecuentes
  $('#fav-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fav]');
    if (b) openFav(b.dataset.fav, false);
  });
  $('#new-fav').addEventListener('click', () => openFav(null, true));
  $('#qty-minus').addEventListener('click', () => stepQty(-1));
  $('#qty-plus').addEventListener('click', () => stepQty(1));
  $('#qty-input').addEventListener('input', () => { $('#qty-error').textContent = ''; updateQtyPreview(); });
  $('#fav-add').addEventListener('click', addFromFav);
  $('#fav-edit-open').addEventListener('click', () => openFav(activeFavId, true));
  $('#fav-form').addEventListener('submit', saveFav);
  $('#fav-delete').addEventListener('click', () => {
    const f = state.favorites.find((x) => x.id === activeFavId);
    if (!f || !confirm(`¿Eliminar «${f.name}» de tus comidas frecuentes?`)) return;
    state.favorites = state.favorites.filter((x) => x.id !== activeFavId);
    save();
    renderFavs();
    closeSheet('#fav-sheet');
  });

  // Historial → ir a un día
  $('#hist-list').addEventListener('click', (e) => {
    const li = e.target.closest('[data-goto]');
    if (!li) return;
    viewDate = li.dataset.goto;
    showView('hoy');
  });

  // Cuerpo
  $('#body-form').addEventListener('submit', saveBody);
  $('#body-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del-body]');
    if (!b || !confirm('¿Eliminar esta medición?')) return;
    state.body = state.body.filter((x) => x.date !== b.dataset.delBody);
    save();
    renderBody();
  });

  // Ajustes
  $('#settings-form').addEventListener('submit', saveSettings);
  $('#theme-toggle').addEventListener('change', (e) => {
    state.settings.theme = e.target.checked ? 'light' : 'dark';
    save();
    applyTheme();
  });
  $('#export-btn').addEventListener('click', exportData);
  $('#import-file').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });
  $('#reset-favs').addEventListener('click', () => {
    if (!confirm('¿Restaurar las comidas frecuentes originales? Se perderán tus cambios en esa lista (tus registros diarios no se tocan).')) return;
    state.favorites = defaultFavorites();
    save();
    toast('Comidas frecuentes restauradas');
  });
  $('#wipe-btn').addEventListener('click', () => {
    if (!confirm('¿Borrar TODOS los datos (comidas, historial, peso, metas)? No se puede deshacer.')) return;
    state = defaultState(false);
    save();
    viewDate = todayKey();
    applyTheme();
    renderAll();
    toast('Datos borrados');
  });

  // Si la app queda abierta pasada la medianoche, vuelve a "hoy"
  let lastToday = todayKey();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const now = todayKey();
    if (now !== lastToday) {
      if (viewDate === lastToday) viewDate = now;
      lastToday = now;
      renderAll();
    }
  });
}

/* ---------------- Inicio ---------------- */

applyTheme();
bind();
save(); // guarda el estado inicial (incluye tu peso del 30/09/2026)
renderAll();

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
