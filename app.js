const supabase = window.supabase.createClient('https://gghqbrajbtsgexweauek.supabase.co', 'sb_publishable_lkrm1scnEOtMY9GI_fPEPg_uUNa5LtC');
const STORAGE_KEY = 'yomulog-books-v1';
const $ = (s) => document.querySelector(s);
const statusLabels = { want: '読みたい', reading: '読書中', done: '読了' };
let user = null, books = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'), filter = 'all', view = 'table';

const newId = () => crypto.randomUUID();
const saveLocal = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
const escapeHtml = (s) => String(s || '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
const tag = (s) => `<span class="status status-${s}">${statusLabels[s]}</span>`;
// Only these columns exist in Supabase. Never send browser-only fields such as finishedDate.
const toRow = (b) => ({ id:b.id, title:b.title, author:b.author || '', notes:b.notes || '', status:b.status || 'want', finished_date:b.finishedDate || null });
const fromRow = (b) => ({ ...b, finishedDate:b.finished_date || '' });

function render() {
  const q = $('#search-input').value.toLowerCase();
  const shown = books.filter((b) => (filter === 'all' || b.status === filter) && `${b.title} ${b.author} ${b.notes}`.toLowerCase().includes(q));
  const count = (s) => books.filter((b) => b.status === s).length;
  const now = new Date(), year = String(now.getFullYear()), month = `${year}-${String(now.getMonth()+1).padStart(2,'0')}`;
  $('#all-count').textContent = books.length;
  ['want','reading','done'].forEach((s) => { $(`#${s}-count`).textContent = count(s); });
  $('#summary-want-count').textContent = `${count('want')}冊`;
  $('#year-count').textContent = `${books.filter((b) => b.status === 'done' && b.finishedDate.startsWith(year)).length}冊`;
  $('#month-count').textContent = `${books.filter((b) => b.status === 'done' && b.finishedDate.startsWith(month)).length}冊`;
  $('#account-label').textContent = user ? user.email : '未ログイン';
  $('#auth-button').textContent = user ? 'ログアウト' : 'ログイン';
  $('#empty-state').hidden = Boolean(shown.length || books.length);
  $('#table-view').hidden = view !== 'table' || !shown.length;
  $('#card-view').hidden = view !== 'card' || !shown.length;
  $('#book-table-body').innerHTML = shown.map((b) => `<tr><td class="book-title">${escapeHtml(b.title)}</td><td>${escapeHtml(b.author)||'—'}</td><td>${b.finishedDate||'—'}</td><td>${tag(b.status)}</td><td class="note">${escapeHtml(b.notes)||'—'}</td><td><button class="row-button" data-id="${b.id}">⋯</button></td></tr>`).join('');
  $('#card-view').innerHTML = shown.map((b) => `<article class="book-card">${tag(b.status)}<button class="row-button card-action" data-id="${b.id}">⋯</button><h2>${escapeHtml(b.title)}</h2><p>${escapeHtml(b.author)||'著者未入力'}</p><p>${escapeHtml(b.notes)||'メモはありません'}</p></article>`).join('');
  document.querySelectorAll('[data-id]').forEach((el) => { el.onclick = () => openEditor(books.find((b) => b.id === el.dataset.id)); });
}

async function uploadAll() {
  if (!user || !books.length) return true;
  const { error } = await supabase.from('books').upsert(books.map(toRow), { onConflict: 'id' });
  if (error) { console.error(error); alert(`同期できませんでした。${error.message}`); return false; }
  return true;
}
async function downloadAll() {
  if (!user) return;
  const { data, error } = await supabase.from('books').select('id,title,author,notes,status,finished_date,created_at').order('created_at', { ascending:false });
  if (error) { console.error(error); alert(`同期できませんでした。${error.message}`); return; }
  if (data.length) { books = data.map(fromRow); saveLocal(); }
  else if (books.length) await uploadAll();
  render();
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
  const b = { id:$('#book-id').value || newId(), title:$('#book-title').value.trim(), author:$('#book-author').value.trim(), status:$('#book-status').value, finishedDate:$('#book-date').value, notes:$('#book-notes').value.trim() };
  if (user) { const { error } = await supabase.from('books').upsert(toRow(b), { onConflict:'id' }); if (error) return alert(`保存できませんでした。${error.message}`); }
  books = [b, ...books.filter((item) => item.id !== b.id)]; saveLocal(); render(); $('#book-dialog').close();
};
$('#delete-button').onclick = async () => {
  const bookId = $('#book-id').value;
  if (user) { const { error } = await supabase.from('books').delete().eq('id',bookId); if (error) return alert(`削除できませんでした。${error.message}`); }
  books = books.filter((b) => b.id !== bookId); saveLocal(); render(); $('#book-dialog').close();
};
document.querySelectorAll('[data-filter]').forEach((el) => { el.onclick = () => { filter = el.dataset.filter; document.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('active',x === el)); render(); }; });
$('#search-input').oninput = render;
$('#table-view-button').onclick = () => { view='table'; $('#table-view-button').classList.add('active'); $('#card-view-button').classList.remove('active'); render(); };
$('#card-view-button').onclick = () => { view='card'; $('#card-view-button').classList.add('active'); $('#table-view-button').classList.remove('active'); render(); };
$('#auth-button').onclick = async () => {
  if (user) return supabase.auth.signOut();
  const email = prompt('メールアドレスを入力してください'); if (!email) return;
  const password = prompt('パスワードを入力してください（8文字以上）'); if (!password) return;
  const signIn = await supabase.auth.signInWithPassword({email,password});
  if (!signIn.error) return;
  const signUp = await supabase.auth.signUp({email,password,options:{emailRedirectTo:'https://terry-tera.github.io/yomulog-reading-tracker/'}});
  alert(signUp.error ? `ログインできませんでした。${signUp.error.message}` : '確認メールを送信しました。メールのリンクを開いてください。');
};
supabase.auth.onAuthStateChange((_event, session) => { user = session?.user || null; render(); if (user) downloadAll(); });
supabase.auth.getSession().then(({data}) => { user = data.session?.user || null; render(); if (user) downloadAll(); });

function parseCsv(text) {
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<text.length;i+=1) { const c=text[i]; if(c==='"') { if(quoted && text[i+1]==='"') { cell+='"'; i+=1; } else quoted=!quoted; } else if(c===','&&!quoted) { row.push(cell); cell=''; } else if((c==='\n'||c==='\r')&&!quoted) { if(c==='\r'&&text[i+1]==='\n')i+=1; row.push(cell); if(row.some(Boolean))rows.push(row); row=[]; cell=''; } else cell+=c; }
  row.push(cell); if(row.some(Boolean))rows.push(row); return rows;
}
const dateFromJapanese = (value) => { const m=String(value||'').match(/(\d{4})年(\d+)月(\d+)日/); return m ? `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` : ''; };
$('#import-button').onclick = () => $('#csv-input').click();
$('#csv-input').onchange = async (event) => {
  const file=event.target.files[0]; if(!file)return; const rows=parseCsv((await file.text()).replace(/^\uFEFF/,'')), headers=rows.shift()||[], col=(name)=>headers.indexOf(name);
  const added=rows.map((row)=>{ const finishedDate=dateFromJapanese(row[col('読了日')]); return {id:newId(),title:row[col('タイトル')]||'',author:row[col('著者')]||'',notes:row[col('感想')]||'',status:finishedDate?'done':'want',finishedDate}; }).filter((b)=>b.title);
  books=[...added,...books]; saveLocal(); await uploadAll(); render(); event.target.value='';
};
$('#export-button').onclick = () => { const quote=(v)=>`"${String(v||'').replace(/"/g,'""')}"`; const csv=[['タイトル','著者','感想','状態','読了日'],...books.map((b)=>[b.title,b.author,b.notes,statusLabels[b.status],b.finishedDate])].map((r)=>r.map(quote).join(',')).join('\n'); const link=document.createElement('a'); link.href=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'})); link.download='yomulog-backup.csv'; link.click(); URL.revokeObjectURL(link.href); };
render();
