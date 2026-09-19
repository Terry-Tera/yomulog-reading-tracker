const storageKey = 'yomulog-books-v1';
let books = loadBooks();
let activeFilter = 'all';
let activeView = 'table';

const statusNames = { want: '読みたい', reading: '読書中', done: '読了' };
const $ = (selector) => document.querySelector(selector);

function loadBooks() { try { return JSON.parse(localStorage.getItem(storageKey)) || []; } catch { return []; } }
function saveBooks() { localStorage.setItem(storageKey, JSON.stringify(books)); }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }
function newId() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function dateLabel(date) { return date ? date.replaceAll('-', '/') : '—'; }
function filteredBooks() {
  const query = $('#search-input').value.trim().toLowerCase();
  return books.filter((book) => (activeFilter === 'all' || book.status === activeFilter) && `${book.title} ${book.author} ${book.notes}`.toLowerCase().includes(query));
}
function statusTag(status) { return `<span class="status status-${status}">${statusNames[status]}</span>`; }
function render() {
  const visible = filteredBooks();
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count = (status) => books.filter((book) => book.status === status).length;
  $('#all-count').textContent = books.length;
  $('#want-count').textContent = count('want');
  $('#reading-count').textContent = count('reading');
  $('#done-count').textContent = count('done');
  $('#year-count').textContent = `${books.filter((book) => book.status === 'done' && book.finishedDate.startsWith(currentYear)).length}冊`;
  $('#month-count').textContent = `${books.filter((book) => book.status === 'done' && book.finishedDate.startsWith(currentMonth)).length}冊`;
  $('#summary-want-count').textContent = `${count('want')}冊`;
  $('#page-title').textContent = activeFilter === 'all' ? '本リスト' : statusNames[activeFilter];
  $('#empty-state').hidden = visible.length > 0 || books.length > 0;
  $('#table-view').hidden = activeView !== 'table' || visible.length === 0;
  $('#card-view').hidden = activeView !== 'card' || visible.length === 0;
  $('#book-table-body').innerHTML = visible.map((book) => `<tr><td class="book-title">${escapeHtml(book.title)}</td><td class="muted">${escapeHtml(book.author || '—')}</td><td class="muted">${dateLabel(book.finishedDate)}</td><td>${statusTag(book.status)}</td><td class="note">${escapeHtml(book.notes || '—')}</td><td><button class="row-button" data-edit="${book.id}" aria-label="${escapeHtml(book.title)}を編集">⋯</button></td></tr>`).join('');
  $('#card-view').innerHTML = visible.map((book) => `<article class="book-card"><button class="row-button card-action" data-edit="${book.id}" aria-label="${escapeHtml(book.title)}を編集">⋯</button>${statusTag(book.status)}<h2>${escapeHtml(book.title)}</h2><div class="muted">${escapeHtml(book.author || '著者未入力')}</div><p>${escapeHtml(book.notes || '感想を追加する')}</p></article>`).join('');
  document.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => openDialog(books.find((book) => book.id === button.dataset.edit))));
}
function openDialog(book) {
  $('#book-form').reset();
  $('#book-id').value = book?.id || '';
  $('#dialog-title').textContent = book ? '本を編集' : '本を登録';
  $('#book-title').value = book?.title || '';
  $('#book-author').value = book?.author || '';
  $('#book-status').value = book?.status || 'want';
  $('#book-date').value = book?.finishedDate || '';
  $('#book-notes').value = book?.notes || '';
  $('#delete-button').hidden = !book;
  $('#book-dialog').showModal();
  $('#book-title').focus();
}
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) { const char = text[i]; const next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') i += 1; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row); return rows;
}
function normalizeDate(value = '') { const match = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/) || value.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); return match ? `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}` : ''; }
function csvValue(value = '') { return `"${String(value).replaceAll('"', '""')}"`; }

$('#add-button').addEventListener('click', () => openDialog());
$('#close-dialog').addEventListener('click', () => $('#book-dialog').close());
$('#cancel-button').addEventListener('click', () => $('#book-dialog').close());
$('#book-form').addEventListener('submit', (event) => { event.preventDefault(); const id = $('#book-id').value; const record = { id: id || newId(), title: $('#book-title').value.trim(), author: $('#book-author').value.trim(), status: $('#book-status').value, finishedDate: $('#book-date').value, notes: $('#book-notes').value.trim() }; if (id) books = books.map((book) => book.id === id ? record : book); else books.unshift(record); saveBooks(); $('#book-dialog').close(); render(); });
$('#delete-button').addEventListener('click', () => { const id = $('#book-id').value; if (id && confirm('この本を削除しますか？')) { books = books.filter((book) => book.id !== id); saveBooks(); $('#book-dialog').close(); render(); } });
document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => { activeFilter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button)); render(); }));
$('#search-input').addEventListener('input', render);
$('#table-view-button').addEventListener('click', () => { activeView = 'table'; $('#table-view-button').classList.add('active'); $('#card-view-button').classList.remove('active'); $('#table-view-button').setAttribute('aria-selected', 'true'); $('#card-view-button').setAttribute('aria-selected', 'false'); render(); });
$('#card-view-button').addEventListener('click', () => { activeView = 'card'; $('#card-view-button').classList.add('active'); $('#table-view-button').classList.remove('active'); $('#card-view-button').setAttribute('aria-selected', 'true'); $('#table-view-button').setAttribute('aria-selected', 'false'); render(); });
$('#import-button').addEventListener('click', () => $('#csv-input').click());
$('#csv-input').addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; const rows = parseCsv((await file.text()).replace(/^\uFEFF/, '')); const headers = rows.shift().map((header) => header.trim()); const index = (name) => headers.indexOf(name); const imported = rows.map((row) => ({ id: newId(), title: row[index('タイトル')]?.trim() || '', author: row[index('著者')]?.trim() || '', notes: row[index('感想')]?.trim() || '', finishedDate: normalizeDate(row[index('読了日')]?.trim() || ''), status: normalizeDate(row[index('読了日')]?.trim() || '') ? 'done' : 'want' })).filter((book) => book.title); if (!imported.length) { alert('タイトル列を含むCSVを読み込めませんでした。'); return; } const message = books.length ? `${imported.length}冊を現在の本リストへ追加しますか？` : `${imported.length}冊を読み込みますか？`; if (confirm(message)) { books = [...imported, ...books]; saveBooks(); activeFilter = 'all'; render(); } event.target.value = ''; });
$('#export-button').addEventListener('click', () => { const lines = [['タイトル','ID','感想','著者','読了日','状態'], ...books.map((book) => [book.title,book.id,book.notes,book.author,book.finishedDate,statusNames[book.status]])].map((row) => row.map(csvValue).join(',')); const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type:'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `よむログ_${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');
render();
