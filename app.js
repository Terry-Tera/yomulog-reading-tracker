const SUPABASE_URL = 'https://gghqbrajbtsgexweauek.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lkrm1scnEOtMY9GI_fPEPg_uUNa5LtC';
const BOOKS_KEY = 'yomulog-books-v1';
const SESSION_KEY = 'yomulog-session-v1';
const $ = (selector) => document.querySelector(selector);
const statusLabels = { want: '読みたい', reading: '読書中', done: '読了' };
let session = readSession();
let books = JSON.parse(localStorage.getItem(BOOKS_KEY) || '[]');
let filter = 'all';
let view = 'table';

function readSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
function saveBooks() { localStorage.setItem(BOOKS_KEY, JSON.stringify(books)); }
function newId() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function escapeHtml(value) { return String(value || '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }
function statusTag(status) { return `<span class="status status-${status}">${statusLabels[status]}</span>`; }
function toRow(book) { return { id:book.id, title:book.title, author:book.author || '', notes:book.notes || '', status:book.status || 'want', finished_date:book.finishedDate || null }; }
function fromRow(row) { return { ...row, finishedDate:row.finished_date || '' }; }
function headers(extra = {}) { return { apikey:SUPABASE_KEY, Authorization:`Bearer ${session?.access_token || SUPABASE_KEY}`, ...extra }; }

async function request(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, options);
  const raw = await response.text();
  let data = null; try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new Error(data?.message || data?.msg || raw || `通信エラー (${response.status})`);
  return data;
}

function render() {
  const query = $('#search-input').value.toLowerCase();
  const shown = books.filter((book) => (filter === 'all' || book.status === filter) && `${book.title} ${book.author} ${book.notes}`.toLowerCase().includes(query));
  const count = (status) => books.filter((book) => book.status === status).length;
  const now = new Date(), year = String(now.getFullYear()), month = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  $('#all-count').textContent = books.length;
  ['want', 'reading', 'done'].forEach((status) => { $(`#${status}-count`).textContent = count(status); });
  $('#summary-want-count').textContent = `${count('want')}冊`;
  $('#year-count').textContent = `${books.filter((book) => book.status === 'done' && book.finishedDate.startsWith(year)).length}冊`;
  $('#month-count').textContent = `${books.filter((book) => book.status === 'done' && book.finishedDate.startsWith(month)).length}冊`;
  $('#account-label').textContent = session?.user?.email || '未ログイン';
  $('#auth-button').textContent = session ? 'ログアウト' : 'ログイン';
  $('#empty-state').hidden = Boolean(shown.length || books.length);
  $('#table-view').hidden = view !== 'table' || !shown.length;
  $('#card-view').hidden = view !== 'card' || !shown.length;
  $('#book-table-body').innerHTML = shown.map((book) => `<tr><td class="book-title">${escapeHtml(book.title)}</td><td>${escapeHtml(book.author)||'—'}</td><td>${book.finishedDate||'—'}</td><td>${statusTag(book.status)}</td><td class="note">${escapeHtml(book.notes)||'—'}</td><td><button class="row-button" data-id="${book.id}">⋯</button></td></tr>`).join('');
  $('#card-view').innerHTML = shown.map((book) => `<article class="book-card">${statusTag(book.status)}<button class="row-button card-action" data-id="${book.id}">⋯</button><h2>${escapeHtml(book.title)}</h2><p>${escapeHtml(book.author)||'著者未入力'}</p><p>${escapeHtml(book.notes)||'メモはありません'}</p></article>`).join('');
  document.querySelectorAll('[data-id]').forEach((button) => { button.onclick = () => openEditor(books.find((book) => book.id === button.dataset.id)); });
}

async function uploadBooks(records = books) {
  if (!session || !records.length) return true;
  await request('/rest/v1/books?on_conflict=id', { method:'POST', headers:headers({ 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=representation' }), body:JSON.stringify(records.map(toRow)) });
  return true;
}
async function downloadBooks() {
  if (!session) return;
  try {
    const data = await request('/rest/v1/books?select=id,title,author,notes,status,finished_date,created_at&order=created_at.desc', { headers:headers() });
    if (data.length) { books = data.map(fromRow); saveBooks(); }
    else if (books.length) await uploadBooks();
    render();
  } catch (error) { console.error(error); alert(`同期できませんでした。${error.message}`); }
}

function openEditor(book) {
  $('#book-form').reset(); $('#dialog-title').textContent = book ? '本を編集' : '本を登録';
  $('#book-id').value = book?.id || ''; $('#book-title').value = book?.title || ''; $('#book-author').value = book?.author || '';
  $('#book-status').value = book?.status || 'want'; $('#book-date').value = book?.finishedDate || ''; $('#book-notes').value = book?.notes || '';
  $('#delete-button').hidden = !book; $('#book-dialog').showModal();
}

$('#add-button').onclick = () => openEditor();
$('#close-dialog').onclick = $('#cancel-button').onclick = () => $('#book-dialog').close();
$('#book-form').onsubmit = async (event) => {
  event.preventDefault();
  const book = { id:$('#book-id').value || newId(), title:$('#book-title').value.trim(), author:$('#book-author').value.trim(), status:$('#book-status').value, finishedDate:$('#book-date').value, notes:$('#book-notes').value.trim() };
  try { if (session) await uploadBooks([book]); } catch (error) { return alert(`保存できませんでした。${error.message}`); }
  books = [book, ...books.filter((item) => item.id !== book.id)]; saveBooks(); render(); $('#book-dialog').close();
};
$('#delete-button').onclick = async () => {
  const bookId = $('#book-id').value;
  try { if (session) await request(`/rest/v1/books?id=eq.${encodeURIComponent(bookId)}`, { method:'DELETE', headers:headers({ Prefer:'return=representation' }) }); } catch (error) { return alert(`削除できませんでした。${error.message}`); }
  books = books.filter((book) => book.id !== bookId); saveBooks(); render(); $('#book-dialog').close();
};
document.querySelectorAll('[data-filter]').forEach((button) => { button.onclick = () => { filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button)); render(); }; });
$('#search-input').oninput = render;
$('#table-view-button').onclick = () => { view = 'table'; $('#table-view-button').classList.add('active'); $('#card-view-button').classList.remove('active'); render(); };
$('#card-view-button').onclick = () => { view = 'card'; $('#card-view-button').classList.add('active'); $('#table-view-button').classList.remove('active'); render(); };

$('#auth-button').onclick = async () => {
  if (session) { session = null; localStorage.removeItem(SESSION_KEY); books = []; render(); return; }
  const email = prompt('メールアドレスを入力してください'); if (!email) return;
  const password = prompt('パスワードを入力してください'); if (!password) return;
  try {
    const data = await request('/auth/v1/token?grant_type=password', { method:'POST', headers:{ apikey:SUPABASE_KEY, 'Content-Type':'application/json' }, body:JSON.stringify({ email, password }) });
    session = data; localStorage.setItem(SESSION_KEY, JSON.stringify(session)); render(); await downloadBooks();
  } catch (error) { alert(`ログインできませんでした。メールアドレスとパスワードを確認してください。\n${error.message}`); }
};

function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) { const char = text[i]; if (char === '"') { if (quoted && text[i+1] === '"') { cell += '"'; i += 1; } else quoted = !quoted; } else if (char === ',' && !quoted) { row.push(cell); cell = ''; } else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i+1] === '\n') i += 1; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; } else cell += char; }
  row.push(cell); if (row.some(Boolean)) rows.push(row); return rows;
}
function japaneseDate(value) { const match = String(value || '').match(/(\d{4})年(\d+)月(\d+)日/); return match ? `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}` : ''; }
$('#import-button').onclick = () => $('#csv-input').click();
$('#csv-input').onchange = async (event) => {
  const file = event.target.files[0]; if (!file) return;
  const rows = parseCsv((await file.text()).replace(/^\uFEFF/, '')), headers = rows.shift() || [], column = (name) => headers.indexOf(name);
  const imported = rows.map((row) => { const finishedDate = japaneseDate(row[column('読了日')]); return { id:newId(), title:row[column('タイトル')] || '', author:row[column('著者')] || '', notes:row[column('感想')] || '', status:finishedDate ? 'done' : 'want', finishedDate }; }).filter((book) => book.title);
  books = [...imported, ...books]; saveBooks();
  try { await uploadBooks(); } catch (error) { alert(`CSVはこの端末へ保存しましたが、同期に失敗しました。${error.message}`); }
  render(); event.target.value = '';
};
$('#export-button').onclick = () => { const quote = (value) => `"${String(value || '').replace(/"/g, '""')}"`; const csv = [['タイトル','著者','感想','状態','読了日'], ...books.map((book) => [book.title,book.author,book.notes,statusLabels[book.status],book.finishedDate])].map((row) => row.map(quote).join(',')).join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\uFEFF',csv], { type:'text/csv;charset=utf-8' })); link.download = 'yomulog-backup.csv'; link.click(); URL.revokeObjectURL(link.href); };
render();
