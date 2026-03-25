import './style.css'
import { db, auth, googleProvider } from './firebase.js'
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy
} from 'firebase/firestore'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'

// ── CONFIG ────────────────────────────────────────────────────────
const SHEET_ID  = import.meta.env.VITE_SHEET_ID
const SHEET_TAB = import.meta.env.VITE_SHEET_TAB || 'Arkusz1'
const API_KEY   = import.meta.env.VITE_SHEETS_API_KEY
// Kolumny Sheets (0-indexed): A=data B=konto C=tekst D=link E=linki F=id G=done H=zdjecia
const COL = { date:0, account:1, text:2, link:3, links:4, id:5, img:7 }

// ── STATE ─────────────────────────────────────────────────────────
let posts    = {}
let myPosts  = {}
let refLinks = {}
let notes    = {}
let emojis   = ['💸','💰','👇','👉','✨','⭕','➖','📌','🔹','🔗','🧵','💥','✅','💯','📝','📆','🎟️','📸','➡️','📍','‼️','❗','⏩','⏪','▶️','◀️','🔽','⬇️','↔️','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🚨','🏆','📈','🔥','🚀','🧬','🌟','✔','🪂','🎟','⚠️','💎','⭐','🎁','💡']

// Filter state — zarządzane lokalnie
let fAccount = ''
let fStatus  = ''
let fSearch  = ''

// ── UTILS ─────────────────────────────────────────────────────────
const nowStr = () => new Date().toLocaleString('pl-PL',{hour12:false}).replace(',','')
const uid    = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6)

let toastTimer
function toast(msg) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400)
}

function copyText(txt) {
  // Kopiuje czysty tekst — bez żadnego formatowania HTML
  navigator.clipboard.writeText(txt).then(() => toast('Skopiowano! ✓')).catch(() => toast('Skopiowano! ✓'))
}

function statusStyle(s) {
  const m = {
    'Nowy':              'background:rgba(0,229,255,.1);color:#00e5ff',
    'Do zrobienia':      'background:rgba(245,158,11,.1);color:#f59e0b',
    'W toku':            'background:rgba(124,58,237,.1);color:#a78bfa',
    'Opublikowane':      'background:rgba(16,185,129,.1);color:#10b981',
    'Odrzucone':         'background:rgba(239,68,68,.1);color:#ef4444',
    'Powrót z archiwum': 'background:rgba(124,58,237,.1);color:#a78bfa',
  }
  return m[s] || ''
}

function badgeClass(s) {
  return {
    'Nowy':'badge-new','Do zrobienia':'badge-todo','W toku':'badge-wip',
    'Opublikowane':'badge-done','Odrzucone':'badge-rejected',
    'Powrót z archiwum':'badge-return','Szkic':'badge-draft'
  }[s] || 'badge-draft'
}

// ── EMOJI PANEL ───────────────────────────────────────────────────
async function loadEmojis() {
  try {
    const snap = await getDocs(collection(db, 'emojis'))
    if (!snap.empty) {
      // Zapisane jako jeden dokument 'list' z polem 'items'
      const docData = snap.docs.find(d => d.id === 'list')
      if (docData) {
        const items = docData.data().items
        if (Array.isArray(items) && items.length) emojis = items
      }
    }
  } catch(e) { /* użyj domyślnych */ }
}

async function saveEmojis() {
  try {
    await setDoc(doc(db, 'emojis', 'list'), { items: emojis })
  } catch(e) { console.warn('Nie można zapisać emotikonów:', e) }
}

function renderEmojiPanel() {
  const grid = document.getElementById('ep-grid')
  if (!grid) return
  grid.innerHTML = emojis.map((e, i) =>
    `<div class="ep-item" onclick="emojiClick('${e}')" title="Kliknij aby skopiować">
      ${e}
      <button class="ep-del" onclick="removeEmoji(event,${i})">×</button>
    </div>`
  ).join('')
}

function emojiClick(e) {
  copyText(e)
}

async function removeEmoji(ev, idx) {
  ev.stopPropagation()
  emojis.splice(idx, 1)
  await saveEmojis()
  renderEmojiPanel()
}

async function addEmoji() {
  const inp = document.getElementById('ep-input')
  const val = inp.value.trim()
  if (!val) return
  emojis.push(val)
  await saveEmojis()
  renderEmojiPanel()
  inp.value = ''
}

function toggleEmojiPanel() {
  document.getElementById('emoji-body').classList.toggle('open')
}

// ── GOOGLE AUTH ───────────────────────────────────────────────────
function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex'
  document.getElementById('main-app').style.display = 'none'
}

function showMainApp(user) {
  document.getElementById('auth-screen').style.display = 'none'
  document.getElementById('main-app').style.display = 'block'
  const img  = document.getElementById('user-avatar')
  const name = document.getElementById('user-name')
  if (img)  img.src = user.photoURL || ''
  if (name) name.textContent = user.displayName || user.email || ''
}

async function loginGoogle() {
  try { await signInWithPopup(auth, googleProvider) }
  catch(e) { toast('Błąd logowania: ' + e.message) }
}

async function logout() {
  await signOut(auth)
}

// ── FIREBASE LOAD ─────────────────────────────────────────────────
async function loadAll() {
  posts = {}; myPosts = {}; refLinks = {}; notes = {}
  const [ps, ms, rs, ns] = await Promise.all([
    getDocs(query(collection(db,'posts'),   orderBy('xDate','desc'))),
    getDocs(query(collection(db,'myPosts'), orderBy('created','desc'))),
    getDocs(collection(db,'refLinks')),
    getDocs(query(collection(db,'notes'),   orderBy('created','desc'))),
  ])
  ps.forEach(d => { posts[d.id]    = d.data() })
  ms.forEach(d => { myPosts[d.id]  = d.data() })
  rs.forEach(d => { refLinks[d.id] = d.data() })
  ns.forEach(d => { notes[d.id]    = d.data() })
}

// ── SHEETS SYNC ───────────────────────────────────────────────────
async function syncSheets() {
  const infoEl = document.getElementById('sync-info')
  if (infoEl) infoEl.textContent = 'synchronizacja...'
  try {
    const range = encodeURIComponent(`${SHEET_TAB}!A2:H`)
    const url   = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`
    const res   = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { values = [] } = await res.json()
    let added = 0
    for (const row of values) {
      const id = (row[COL.id] || '').trim()
      if (!id || posts[id]) continue
      const post = {
        id,
        account: row[COL.account] || '',
        xDate:   row[COL.date]    || '',
        xLink:   row[COL.link]    || '',
        text:    row[COL.text]    || '',
        // Linki mogą być oddzielone \n lub przecinkami
        links:   row[COL.links]  ? row[COL.links].split(/[\n,]+/).map(s=>s.trim()).filter(Boolean) : [],
        // Zdjęcia — może być kilka oddzielonych \n
        imgs:    row[COL.img]    ? row[COL.img].split(/[\n,]+/).map(s=>s.trim()).filter(Boolean) : [],
        para:    '',
        status:  'Nowy',
        addedAt: nowStr(),
      }
      await setDoc(doc(db,'posts',id), post)
      posts[id] = post
      added++
    }
    const t = new Date().toLocaleTimeString('pl-PL')
    if (infoEl) infoEl.textContent = `sync: ${t}${added ? ` (+${added})` : ''}`
    if (added) { toast(`Dodano ${added} nowych wpisów 🔔`); renderMain(); updateStats(); updateBadges() }
  } catch(e) {
    if (infoEl) infoEl.textContent = `błąd sync: ${e.message}`
    toast('Błąd synchronizacji: ' + e.message)
  }
}

// ── TAB SWITCH ────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelector(`.tab[data-tab="${name}"]`).classList.add('active')
  document.getElementById(`page-${name}`).classList.add('active')
  const fn = {main:renderMain, moje:renderMoje, archiwum:renderArchive, notatki:renderNotes, ref:renderRef}
  if (fn[name]) fn[name]()
}

// ── REF CHIPS ─────────────────────────────────────────────────────
function refLinksHtml() {
  const list = Object.values(refLinks)
  if (!list.length) return ''
  const chips = list.map(r =>
    `<span class="ref-chip">
      <span class="ref-chip-name">${r.name}</span>
      <button class="ref-chip-copy" onclick="copyText('${r.url.replace(/'/g,"\\'")}')">Kopiuj</button>
    </span>`
  ).join('')
  return `<div class="ref-links-row">
    <span style="font-size:11px;color:var(--text3)">Linki ref:</span>${chips}
  </div>`
}

function refSelectHtml() {
  const list = Object.values(refLinks)
  return `<option value="">— brak —</option>` +
    list.map(r => `<option value="${r.url}">${r.name}</option>`).join('')
}

// ── RENDER: MAIN ──────────────────────────────────────────────────
function renderMain() {
  // Pobierz aktualne wartości filtrów z DOM (FIX: filtry)
  const selAcc = document.getElementById('f-account')
  const selSt  = document.getElementById('f-status')
  const inpSr  = document.getElementById('f-search')
  if (selAcc) fAccount = selAcc.value
  if (selSt)  fStatus  = selSt.value
  if (inpSr)  fSearch  = inpSr.value.toLowerCase()

  const list = Object.values(posts).filter(p => {
    if (p.status === 'Odrzucone' || p.status === 'Opublikowane') return false
    if (fAccount && p.account !== fAccount) return false
    if (fStatus  && p.status  !== fStatus)  return false
    if (fSearch  && !p.text.toLowerCase().includes(fSearch)) return false
    return true
  }).sort((a,b) => b.xDate.localeCompare(a.xDate))

  // Odśwież listę kont w filtrze
  const accounts = [...new Set(Object.values(posts).map(p=>p.account))].sort()
  if (selAcc) {
    const prev = selAcc.value
    selAcc.innerHTML = '<option value="">Wszystkie konta</option>' +
      accounts.map(a => `<option${a===prev?' selected':''}>${a}</option>`).join('')
    selAcc.value = prev
  }

  const el = document.getElementById('main-cards')
  if (!el) return
  if (!list.length) { el.innerHTML = '<div class="empty">Brak wpisów pasujących do filtrów.</div>'; return }

  el.innerHTML = list.map(p => {
    // Linki z posta
    const linksH = p.links?.length
      ? `<div class="card-links"><span style="font-size:11px;color:var(--text3)">Linki:</span>
          ${p.links.map(l=>`<a class="lchip" href="${l}" target="_blank" title="${l}">${l.replace(/^https?:\/\//,'').slice(0,40)}</a>`).join('')}
         </div>`
      : ''
    // Zdjęcia — może być kilka (FIX: wiele zdjęć)
    const imgsH = p.imgs?.length
      ? `<div class="card-links"><span style="font-size:11px;color:var(--text3)">Zdjęcia:</span>
          ${p.imgs.map((img,i)=>`<a class="lchip" href="${img}" target="_blank">Zdjęcie ${p.imgs.length>1?i+1:''}</a>`).join('')}
         </div>`
      : (p.img
          ? `<div class="card-links"><span style="font-size:11px;color:var(--text3)">Zdjęcia:</span>
              ${p.img.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean).map((img,i,arr)=>
                `<a class="lchip" href="${img}" target="_blank">Zdjęcie ${arr.length>1?i+1:''}</a>`
              ).join('')}
             </div>`
          : '')

    return `<div class="card" id="card-${p.id}">
      <div class="card-head">
        <span class="account">@${p.account}</span>
        <a class="xlink" href="${p.xLink||'#'}" target="_blank">Otwórz na X ↗</a>
        <span class="post-date">📅 ${p.xDate}</span>
        <select class="status-sel" style="${statusStyle(p.status)}" onchange="setPostStatus('${p.id}',this.value)">
          ${['Nowy','Do zrobienia','W toku','Opublikowane','Odrzucone'].map(s=>`<option${s===p.status?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      ${linksH}${imgsH}
      ${refLinksHtml()}
      <div class="card-body">
        <div class="col-orig">
          <div class="col-label">Oryginał</div>
          <div class="orig-text" id="orig-${p.id}">${p.text}</div>
        </div>
        <div class="col-para">
          <div class="col-label">Twoja parafraza</div>
          <textarea class="para-area" id="para-${p.id}"
            placeholder="Wklej tutaj swoją parafrazę..."
            onblur="savePara('${p.id}',this.value)">${p.para||''}</textarea>
        </div>
      </div>
      <div class="card-foot">
        <button class="btn" id="bexp-${p.id}" onclick="toggleExpand('${p.id}')">Rozwiń</button>
        <button class="btn" onclick="copyText(document.getElementById('orig-${p.id}').innerText)">Kopiuj oryginał</button>
        <button class="btn btn-info" onclick="copyText(document.getElementById('para-${p.id}').value)">Kopiuj parafrazę</button>
        <button class="btn btn-danger ml-auto" onclick="setPostStatus('${p.id}','Odrzucone')">Odrzuć</button>
      </div>
    </div>`
  }).join('')
}

// ── POST ACTIONS ──────────────────────────────────────────────────
async function setPostStatus(id, status) {
  if (!posts[id]) return
  posts[id].status = status
  const upd = { status }
  if (status === 'Opublikowane') { posts[id].archivedAt = nowStr(); upd.archivedAt = posts[id].archivedAt }
  await updateDoc(doc(db,'posts',id), upd)
  if (status === 'Opublikowane') toast('Przeniesiono do Archiwum ✓')
  renderMain(); updateStats(); updateBadges()
}

async function savePara(id, value) {
  if (!posts[id] || posts[id].para === value) return
  posts[id].para = value
  await updateDoc(doc(db,'posts',id), { para: value })
}

function toggleExpand(id) {
  const o = document.getElementById('orig-'+id)
  const p = document.getElementById('para-'+id)
  const b = document.getElementById('bexp-'+id)
  if (!o) return
  const ex = o.classList.contains('expanded')
  if (!ex) {
    // Rozwijamy: oblicz naturalną wysokość obu i ustaw obu tę samą (maksimum)
    o.classList.add('expanded')
    if (p) p.classList.add('expanded')
    // Synchronizuj wysokość - ustaw min-height na wyższy z dwóch
    requestAnimationFrame(() => {
      const hO = o.scrollHeight
      const hP = p ? p.scrollHeight : 0
      const maxH = Math.max(hO, hP)
      o.style.maxHeight = maxH + 'px'
      if (p) p.style.minHeight = maxH + 'px'
    })
  } else {
    // Zwijamy: usuń styl i klasę
    o.classList.remove('expanded')
    o.style.maxHeight = ''
    if (p) { p.classList.remove('expanded'); p.style.minHeight = '' }
  }
  if (b) b.textContent = ex ? 'Rozwiń' : 'Zwiń'
}

// ── STATS & BADGES ────────────────────────────────────────────────
function updateStats() {
  const all  = Object.values(posts)
  const s    = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v }
  s('s-all',  all.filter(p=>p.status!=='Odrzucone'&&p.status!=='Opublikowane').length)
  s('s-new',  all.filter(p=>p.status==='Nowy').length)
  s('s-todo', all.filter(p=>p.status==='Do zrobienia'||p.status==='W toku').length)
  s('s-done', all.filter(p=>p.status==='Opublikowane').length)
}

function updateBadges() {
  const s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v }
  s('tab-main-badge', Object.values(posts).filter(p=>p.status!=='Odrzucone'&&p.status!=='Opublikowane').length)
  s('tab-moje-badge', Object.keys(myPosts).length)
  s('tab-arch-badge', Object.values(posts).filter(p=>p.status==='Opublikowane').length)
  s('tab-notes-badge',Object.keys(notes).length)
  s('tab-ref-badge',  Object.keys(refLinks).length)
}

// ── RENDER: MY POSTS ──────────────────────────────────────────────
function renderMoje() {
  const el   = document.getElementById('moje-cards')
  if (!el) return
  const list = Object.values(myPosts).sort((a,b)=>b.created.localeCompare(a.created))
  if (!list.length) { el.innerHTML='<div class="empty">Brak własnych wpisów.</div>'; return }

  el.innerHTML = list.map(p => {
    const editing = !!p._editing
    return `<div class="mypost-card" id="mycard-${p.id}">
      <div class="mypost-head">
        <span style="font-size:12px;font-weight:700;color:var(--text2)">Mój wpis</span>
        ${p.tags ? `<span style="font-size:11px;color:var(--neon)">${p.tags}</span>` : ''}
        <span class="badge ${badgeClass(p.status)}">${p.status}</span>
        ${p.refLink ? `<a class="xlink" href="${p.refLink}" target="_blank" style="font-size:10px">Link ref ↗</a>` : ''}
        ${!editing ? `<button class="btn ml-auto" id="mbexp-${p.id}" onclick="toggleMyExpand('${p.id}')">Rozwiń</button>` : ''}
      </div>
      <div class="mypost-body">
        ${editing ? `
          <div class="edit-form">
            <div class="edit-row full"><div>
              <div class="form-label">Treść wpisu</div>
              <textarea class="mypost-edit-area" id="edit-text-${p.id}">${p.text}</textarea>
            </div></div>
            <div class="edit-row">
              <div><div class="form-label">Planowana data publikacji</div>
                <input class="form-input" type="datetime-local" id="edit-planned-${p.id}"
                  value="${p.planned?p.planned.replace(' ','T'):''}"></div>
              <div><div class="form-label">Hashtagi</div>
                <input class="form-input" id="edit-tags-${p.id}" value="${p.tags||''}"></div>
            </div>
            <div class="edit-row">
              <div><div class="form-label">Notatka</div>
                <input class="form-input" id="edit-note-${p.id}" value="${p.note||''}"></div>
              <div><div class="form-label">Link referencyjny</div>
                <select class="form-select" id="edit-ref-${p.id}">${refSelectHtml()}</select></div>
            </div>
            <div style="display:flex;gap:6px;margin-top:4px">
              <button class="btn btn-primary" onclick="saveMyEdit('${p.id}')">Zapisz</button>
              <button class="btn" onclick="cancelMyEdit('${p.id}')">Anuluj</button>
            </div>
          </div>
        ` : `
          <div class="mypost-text" id="mytext-${p.id}">${p.text||'(brak treści)'}</div>
          <div class="mypost-meta">
            <span class="meta-item">Utworzono: ${p.created}</span>
            ${p.planned?`<span class="meta-item">Planowana: ${p.planned}</span>`:''}
            ${p.published?`<span class="meta-item green">Opublikowano: ${p.published}</span>`:''}
            ${p.note?`<span class="meta-item">📝 ${p.note}</span>`:''}
          </div>
        `}
      </div>
      ${!editing ? `
      <div class="mypost-foot">
        <button class="btn" onclick="copyText(\`${p.text.replace(/`/g,"'").replace(/\\/g,'\\\\')}\`)">Kopiuj wpis</button>
        <button class="btn" onclick="startMyEdit('${p.id}')">Edytuj</button>
        ${p.status!=='Opublikowane'?`<button class="btn btn-success" onclick="publishMyPost('${p.id}')">Opublikowano</button>`:''}
        <button class="btn btn-danger ml-auto" onclick="deleteMyPost('${p.id}')">Usuń</button>
      </div>` : ''}
    </div>`
  }).join('')
}

function toggleMyExpand(id) {
  const t = document.getElementById('mytext-'+id)
  const b = document.getElementById('mbexp-'+id)
  if (!t) return
  t.classList.toggle('expanded')
  if (b) b.textContent = t.classList.contains('expanded') ? 'Zwiń' : 'Rozwiń'
}

function startMyEdit(id)  { if(myPosts[id]){myPosts[id]._editing=true;  renderMoje()} }
function cancelMyEdit(id) { if(myPosts[id]){myPosts[id]._editing=false; renderMoje()} }

async function saveMyEdit(id) {
  const p = myPosts[id]; if(!p) return
  const text    = document.getElementById(`edit-text-${id}`)?.value.trim()||''
  const planned = (document.getElementById(`edit-planned-${id}`)?.value||'').replace('T',' ')
  const tags    = document.getElementById(`edit-tags-${id}`)?.value.trim()||''
  const note    = document.getElementById(`edit-note-${id}`)?.value.trim()||''
  const refLink = document.getElementById(`edit-ref-${id}`)?.value||''
  Object.assign(p,{text,planned,tags,note,refLink,_editing:false})
  const save={...p}; delete save._editing
  await setDoc(doc(db,'myPosts',id),save)
  toast('Zaktualizowano ✓'); renderMoje()
}

async function addMyPost() {
  const text = document.getElementById('np-text')?.value.trim()
  if(!text){toast('Wpisz treść!');return}
  const id = uid()
  const post = {
    id,text,
    created: (document.getElementById('np-created')?.value||'').replace('T',' ')||nowStr(),
    planned: (document.getElementById('np-planned')?.value||'').replace('T',' '),
    published:'',
    tags:    document.getElementById('np-tags')?.value.trim()||'',
    note:    document.getElementById('np-note')?.value.trim()||'',
    refLink: document.getElementById('np-reflink')?.value||'',
    status:  'Szkic',
  }
  await setDoc(doc(db,'myPosts',id),post)
  myPosts[id]=post
  toggleMyForm(false)
  renderMoje(); updateBadges(); toast('Wpis dodany ✓')
}

async function publishMyPost(id) {
  const p=myPosts[id]; if(!p) return
  p.status='Opublikowane'; p.published=nowStr()
  await updateDoc(doc(db,'myPosts',id),{status:p.status,published:p.published})
  toast('Oznaczono jako opublikowany ✓'); renderMoje()
}

async function deleteMyPost(id) {
  if(!confirm('Usunąć ten wpis?')) return
  await deleteDoc(doc(db,'myPosts',id))
  delete myPosts[id]; renderMoje(); updateBadges(); toast('Usunięto ✓')
}

function toggleMyForm(show) {
  const f = document.getElementById('my-form')
  const b = document.getElementById('btn-add-my')
  if(!f||!b) return
  if(show===undefined) show = f.style.display==='none'
  f.style.display = show ? 'block' : 'none'
  b.textContent   = show ? '✕ Zamknij' : '+ Dodaj wpis'
  if(show) {
    // Wyczyść wszystkie pola formularza
    const txt = document.getElementById('np-text')
    const tags = document.getElementById('np-tags')
    const note = document.getElementById('np-note')
    const planned = document.getElementById('np-planned')
    const cnt = document.getElementById('np-count')
    if(txt) txt.value = ''
    if(tags) tags.value = ''
    if(note) note.value = ''
    if(planned) planned.value = ''
    if(cnt) cnt.textContent = '0/280'
    // Ustaw aktualną datę w polu "Data utworzenia"
    const created = document.getElementById('np-created')
    if(created) created.value = new Date().toISOString().slice(0,16)
    // Odśwież select linków ref i zresetuj na brak
    const sel = document.getElementById('np-reflink')
    if(sel){sel.innerHTML=refSelectHtml();sel.value=''}
  }
}

// ── RENDER: ARCHIVE ───────────────────────────────────────────────
function renderArchive() {
  const list = Object.values(posts)
    .filter(p=>p.status==='Opublikowane')
    .sort((a,b)=>(b.archivedAt||'').localeCompare(a.archivedAt||''))
  const el = document.getElementById('arch-cards')
  if(!el) return
  if(!list.length){el.innerHTML='<div class="empty">Brak wpisów w archiwum.</div>';return}
  el.innerHTML = list.map(p=>`
    <div class="arch-card">
      <div class="arch-head">
        <span class="account">@${p.account}</span>
        <a class="xlink" href="${p.xLink||'#'}" target="_blank">Otwórz na X ↗</a>
        <span class="post-date">📅 ${p.xDate}</span>
        <span style="font-size:11px;color:var(--text3);margin-left:auto">arch. ${p.archivedAt||''}</span>
      </div>
      <div class="arch-body">
        <div class="arch-text">${p.text}</div>
        ${p.para?`<div style="font-size:11px;color:var(--text3);margin-bottom:4px">Parafraza:</div><div class="arch-para">${p.para}</div>`:''}
      </div>
      <div class="arch-foot">
        <span style="font-size:12px;color:var(--text2)">Przywróć jako:</span>
        <select id="rs-${p.id}" style="font-size:12px;padding:5px 8px;border:1px solid var(--border2);border-radius:var(--r);background:var(--bg3);color:var(--text)">
          <option>Nowy</option><option>Do zrobienia</option><option>W toku</option><option>Powrót z archiwum</option>
        </select>
        <button class="btn btn-info" onclick="restorePost('${p.id}')">Przywróć</button>
      </div>
    </div>`).join('')
}

async function restorePost(id) {
  const p=posts[id]; if(!p) return
  const sel=document.getElementById(`rs-${id}`)
  p.status=sel?sel.value:'Nowy'; delete p.archivedAt
  await updateDoc(doc(db,'posts',id),{status:p.status,archivedAt:null})
  toast('Przywrócono ✓'); renderArchive(); updateStats(); updateBadges()
}

// ── RENDER: NOTES ─────────────────────────────────────────────────
function renderNotes() {
  const list = Object.values(notes).sort((a,b)=>b.created.localeCompare(a.created))
  const el = document.getElementById('notes-cards')
  if(!el) return
  if(!list.length){el.innerHTML='<div class="empty">Brak notatek.</div>';return}
  el.innerHTML = list.map(n=>`
    <div class="note-card">
      <div class="note-head">
        <span class="note-date">📝 ${n.created}</span>
        <button class="btn btn-danger" style="font-size:11px;padding:2px 8px" onclick="deleteNote('${n.id}')">Usuń</button>
      </div>
      <div class="note-text">${n.text}</div>
    </div>`).join('')
}

async function addNote() {
  const text=document.getElementById('new-note')?.value.trim()
  if(!text){toast('Wpisz treść notatki!');return}
  const id=uid(), note={id,text,created:nowStr()}
  await setDoc(doc(db,'notes',id),note)
  notes[id]=note
  document.getElementById('new-note').value=''
  renderNotes(); updateBadges(); toast('Zapisano ✓')
}

async function deleteNote(id) {
  await deleteDoc(doc(db,'notes',id))
  delete notes[id]; renderNotes(); updateBadges(); toast('Usunięto ✓')
}

// ── RENDER: REF LINKS ─────────────────────────────────────────────
function renderRef() {
  const list = Object.values(refLinks).sort((a,b)=>a.name.localeCompare(b.name))
  const el = document.getElementById('ref-cards')
  if(!el) return
  if(!list.length){el.innerHTML='<div class="empty">Brak linków referencyjnych.</div>';return}
  el.innerHTML = list.map(r=>{
    const editing=!!r._editing
    return `<div class="ref-card" id="refcard-${r.id}">
      ${editing ? `
        <div class="edit-form">
          <div><div class="form-label">Nazwa projektu</div>
            <input class="form-input" id="re-name-${r.id}" value="${r.name}"></div>
          <div><div class="form-label">Link (URL)</div>
            <input class="form-input" id="re-url-${r.id}" value="${r.url}"></div>
          <div style="display:flex;gap:6px;margin-top:4px">
            <button class="btn btn-primary" onclick="saveRefEdit('${r.id}')">Zapisz</button>
            <button class="btn" onclick="cancelRefEdit('${r.id}')">Anuluj</button>
          </div>
        </div>
      ` : `
        <div class="ref-project">${r.name}</div>
        <div class="ref-link-url">${r.url}</div>
        <div class="ref-actions">
          <button class="btn btn-info" onclick="copyText('${r.url.replace(/'/g,"\\'")}')">Kopiuj link</button>
          <button class="btn" onclick="startRefEdit('${r.id}')">Edytuj</button>
          <button class="btn btn-danger" onclick="deleteRef('${r.id}')">Usuń</button>
        </div>
      `}
    </div>`
  }).join('')
}

function toggleRefForm(show) {
  const f=document.getElementById('ref-form')
  const b=document.getElementById('btn-add-ref')
  if(!f||!b) return
  if(show===undefined) show=f.style.display==='none'
  f.style.display=show?'block':'none'
  b.textContent=show?'✕ Zamknij':'+ Dodaj link'
}

async function addRef() {
  const name=document.getElementById('ref-name')?.value.trim()
  const url =document.getElementById('ref-url')?.value.trim()
  if(!name||!url){toast('Wypełnij oba pola!');return}
  if(!url.startsWith('http')){toast('Link musi zaczynać się od https://');return}
  const id=uid(), ref={id,name,url,addedAt:nowStr()}
  await setDoc(doc(db,'refLinks',id),ref)
  refLinks[id]=ref
  document.getElementById('ref-name').value=''
  document.getElementById('ref-url').value=''
  toggleRefForm(false)
  renderRef(); updateBadges()
  refreshRefInOtherTabs()
  toast('Link dodany ✓')
}

function startRefEdit(id)  {if(refLinks[id]){refLinks[id]._editing=true;  renderRef()}}
function cancelRefEdit(id) {if(refLinks[id]){refLinks[id]._editing=false; renderRef()}}

async function saveRefEdit(id) {
  const r=refLinks[id]; if(!r) return
  const name=document.getElementById(`re-name-${id}`)?.value.trim()||''
  const url =document.getElementById(`re-url-${id}`)?.value.trim()||''
  if(!name||!url){toast('Wypełnij oba pola!');return}
  Object.assign(r,{name,url,_editing:false})
  const save={...r};delete save._editing
  await setDoc(doc(db,'refLinks',id),save)
  toast('Zaktualizowano ✓'); renderRef(); refreshRefInOtherTabs()
}

async function deleteRef(id) {
  if(!confirm('Usunąć ten link?')) return
  await deleteDoc(doc(db,'refLinks',id))
  delete refLinks[id]; renderRef(); updateBadges(); refreshRefInOtherTabs(); toast('Usunięto ✓')
}

function refreshRefInOtherTabs() {
  // Odśwież kafelki ref w zakładce Wpisy (jeśli aktywna)
  if(document.getElementById('page-main')?.classList.contains('active')) renderMain()
  // Odśwież select w formularzu Moich wpisów
  const sel=document.getElementById('np-reflink')
  if(sel){const v=sel.value;sel.innerHTML=refSelectHtml();sel.value=v}
}

// ── BUILD HTML ────────────────────────────────────────────────────
function buildApp() {
  document.getElementById('app').innerHTML = `
  <div id="toast" class="toast"></div>

  <!-- AUTH SCREEN -->
  <div id="auth-screen">
    <div class="auth-box">
      <div class="auth-logo">𝕏</div>
      <div class="auth-title">XPost Manager</div>
      <div class="auth-sub">Zaloguj się aby zarządzać wpisami</div>
      <button class="btn-google" onclick="loginGoogle()">
        <svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Zaloguj się przez Google
      </button>
    </div>
  </div>

  <!-- MAIN APP -->
  <div id="main-app" style="display:none">
    <div class="topbar">
      <h1>𝕏 XPost Manager</h1>
      <span class="sync-info" id="sync-info">ładowanie...</span>
      <button class="btn-sync" onclick="syncSheets()">Synchronizuj</button>
      <div class="user-row">
        <img class="user-avatar" id="user-avatar" src="" alt="">
        <span class="user-name" id="user-name"></span>
        <button class="btn-logout" onclick="logout()">Wyloguj</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" data-tab="main"    onclick="switchTab('main')">Wpisy <span class="tab-badge" id="tab-main-badge">0</span></button>
      <button class="tab"        data-tab="moje"    onclick="switchTab('moje')">Moje wpisy <span class="tab-badge" id="tab-moje-badge">0</span></button>
      <button class="tab"        data-tab="archiwum"onclick="switchTab('archiwum')">Archiwum <span class="tab-badge" id="tab-arch-badge">0</span></button>
      <button class="tab"        data-tab="notatki" onclick="switchTab('notatki')">Notatki <span class="tab-badge" id="tab-notes-badge">0</span></button>
      <button class="tab"        data-tab="ref"     onclick="switchTab('ref')">Linki ref <span class="tab-badge" id="tab-ref-badge">0</span></button>
    </div>

    <!-- WPISY -->
    <div id="page-main" class="page active">
      <div class="stats">
        <div class="stat"><div class="stat-n" id="s-all" style="color:var(--text)">0</div><div class="stat-l">Wszystkich</div></div>
        <div class="stat"><div class="stat-n" id="s-new" style="color:var(--neon)">0</div><div class="stat-l">Nowych</div></div>
        <div class="stat"><div class="stat-n" id="s-todo" style="color:var(--neon4)">0</div><div class="stat-l">W toku</div></div>
        <div class="stat"><div class="stat-n" id="s-done" style="color:var(--neon3)">0</div><div class="stat-l">Opublikowanych</div></div>
      </div>
      <div class="filters">
        <select id="f-account" onchange="renderMain()"><option value="">Wszystkie konta</option></select>
        <select id="f-status"  onchange="renderMain()">
          <option value="">Wszystkie statusy</option>
          <option>Nowy</option><option>Do zrobienia</option><option>W toku</option>
        </select>
        <input id="f-search" placeholder="Szukaj w treści..." oninput="renderMain()" style="flex:1;min-width:140px">
      </div>
      <div id="main-cards"><div class="loading">Ładowanie...</div></div>
    </div>

    <!-- MOJE WPISY -->
    <div id="page-moje" class="page">
      <div class="section-header">
        <span style="font-size:13px;color:var(--text2)">Twoje własne wpisy na X</span>
        <button class="btn-add" id="btn-add-my" onclick="toggleMyForm()">+ Dodaj wpis</button>
      </div>
      <div id="my-form" style="display:none">
        <div class="form-card">
          <div class="form-title">Nowy wpis</div>
          <div class="form-row full">
            <div>
              <div class="form-label">Treść wpisu</div>
              <textarea class="form-textarea" id="np-text" style="min-height:110px"
                placeholder="Napisz swój wpis na X..."
                oninput="document.getElementById('np-count').textContent=this.value.length+'/280'"></textarea>
              <div class="char-count" id="np-count">0/280</div>
            </div>
          </div>
          <div class="form-row">
            <div><div class="form-label">Data utworzenia</div>
              <input class="form-input" type="datetime-local" id="np-created"></div>
            <div><div class="form-label">Planowana data publikacji</div>
              <input class="form-input" type="datetime-local" id="np-planned"></div>
          </div>
          <div class="form-row">
            <div><div class="form-label">Hashtagi</div>
              <input class="form-input" id="np-tags" placeholder="#crypto #airdrop"></div>
            <div><div class="form-label">Notatka</div>
              <input class="form-input" id="np-note" placeholder="np. źródło, pomysł..."></div>
          </div>
          <div class="form-row full">
            <div><div class="form-label">Link referencyjny</div>
              <select class="form-select" id="np-reflink">${refSelectHtml()}</select></div>
          </div>
          <div class="form-btns">
            <button class="btn btn-primary" onclick="addMyPost()">Dodaj wpis</button>
            <button class="btn" onclick="toggleMyForm(false)">Anuluj</button>
          </div>
        </div>
      </div>
      <div id="moje-cards"></div>
    </div>

    <!-- ARCHIWUM -->
    <div id="page-archiwum" class="page">
      <div style="font-size:13px;color:var(--text2);margin-bottom:12px">Opublikowane wpisy. Przywróć do głównej zakładki jeśli potrzeba.</div>
      <div id="arch-cards"></div>
    </div>

    <!-- NOTATKI -->
    <div id="page-notatki" class="page">
      <div class="form-card" style="margin-bottom:16px">
        <div class="form-title">Nowa notatka</div>
        <textarea class="note-input" id="new-note" placeholder="Zapisz coś — pomysł, link, przypomnienie..."></textarea>
        <div style="margin-top:8px"><button class="btn btn-primary" onclick="addNote()">Zapisz notatkę</button></div>
      </div>
      <div id="notes-cards"></div>
    </div>

    <!-- LINKI REF -->
    <div id="page-ref" class="page">
      <div class="section-header">
        <span style="font-size:13px;color:var(--text2)">Linki dostępne w zakładkach Wpisy i Moje wpisy</span>
        <button class="btn-add" id="btn-add-ref" onclick="toggleRefForm()">+ Dodaj link</button>
      </div>
      <div id="ref-form" style="display:none">
        <div class="form-card">
          <div class="form-title">Nowy link referencyjny</div>
          <div class="form-row">
            <div><div class="form-label">Nazwa projektu</div>
              <input class="form-input" id="ref-name" placeholder="np. Walrus Airdrop"></div>
            <div><div class="form-label">Link (URL)</div>
              <input class="form-input" id="ref-url" placeholder="https://..."></div>
          </div>
          <div class="form-btns">
            <button class="btn btn-primary" onclick="addRef()">Dodaj</button>
            <button class="btn" onclick="toggleRefForm(false)">Anuluj</button>
          </div>
        </div>
      </div>
      <div id="ref-cards"></div>
    </div>

  </div><!-- /main-app -->

  <!-- EMOJI FAB -->
  <div class="emoji-fab">
    <div class="emoji-body" id="emoji-body">
      <div class="ep-title">Panel emotikonów — kliknij aby skopiować</div>
      <div class="ep-add">
        <input class="ep-input" id="ep-input" placeholder="✨" maxlength="8">
        <button class="btn btn-primary" style="font-size:12px;padding:5px 10px" onclick="addEmoji()">Dodaj</button>
      </div>
      <div class="ep-grid" id="ep-grid"></div>
    </div>
    <button class="emoji-toggle" onclick="toggleEmojiPanel()" title="Panel emotikonów">😊</button>
  </div>
  `
}

// ── EXPOSE ────────────────────────────────────────────────────────
Object.assign(window, {
  loginGoogle, logout, switchTab, syncSheets,
  renderMain, setPostStatus, savePara, toggleExpand, copyText,
  renderMoje, toggleMyExpand, startMyEdit, cancelMyEdit, saveMyEdit,
  addMyPost, toggleMyForm, publishMyPost, deleteMyPost,
  renderArchive, restorePost,
  addNote, deleteNote,
  renderRef, toggleRefForm, addRef, startRefEdit, cancelRefEdit, saveRefEdit, deleteRef,
  toggleEmojiPanel, addEmoji, emojiClick, removeEmoji,
})

// ── INIT ──────────────────────────────────────────────────────────
buildApp()

onAuthStateChanged(auth, async user => {
  if (user) {
    showMainApp(user)
    await loadAll()
    await loadEmojis()
    renderEmojiPanel()
    renderMain(); renderMoje(); renderNotes(); renderRef()
    updateStats(); updateBadges()
    await syncSheets()
    setInterval(syncSheets, 5 * 60 * 1000)
  } else {
    showAuthScreen()
  }
})
