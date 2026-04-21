import './style.css'
import { db, auth, googleProvider } from './firebase.js'
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot
} from 'firebase/firestore'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'

// ── CONFIG ────────────────────────────────────────────────────────
const SHEET_ID  = import.meta.env.VITE_SHEET_ID
const SHEET_TAB = import.meta.env.VITE_SHEET_TAB || 'Arkusz1'
const API_KEY   = import.meta.env.VITE_SHEETS_API_KEY
// Kolumny Sheets (0-indexed): A=data B=konto C=tekst D=link E=linki F=id G=done H=zdjecia
const COL = { date:0, account:1, text:2, link:3, links:4, id:5, img:7, type:8 }

// ── STATE ─────────────────────────────────────────────────────────
let posts      = {}
let myPosts    = {}
let refLinks   = {}
let notes      = {}
let tgSignals  = {}
let tgWpisy    = {}
let konta      = {}   // kategorie kont: { katId: { id, name, icon, note, accounts: [{id,name,note}] } }
let emojis     = ['💸','💰','👇','👉','✨','⭕','➖','📌','🔹','🔗','🧵','💥','✅','💯','📝','📆','🎟️','📸','➡️','📍','‼️','❗','⏩','⏪','▶️','◀️','🔽','⬇️','↔️','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🚨','🏆','📈','🔥','🚀','🧬','🌟','✔','🪂','🎟','⚠️','💎','⭐','🎁','💡']

// Filter state — zarządzane lokalnie
let fAccount = ''
let fStatus  = ''
let fSearch  = ''
let fType    = ''

// TG filter state
let tgSigChannel = ''
let tgSigStatus  = ''
let tgSigSearch  = ''
let tgWpisChannel= ''
let tgWpisStatus = ''
let tgWpisSearch = ''

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
  posts = {}; myPosts = {}; refLinks = {}; notes = {}; tgSignals = {}; tgWpisy = {}; konta = {}
  const [ps, ms, rs, ns, tgs, tgw, ks] = await Promise.all([
    getDocs(query(collection(db,'posts'),      orderBy('xDate','desc'))),
    getDocs(query(collection(db,'myPosts'),    orderBy('created','desc'))),
    getDocs(collection(db,'refLinks')),
    getDocs(query(collection(db,'notes'),      orderBy('created','desc'))),
    getDocs(query(collection(db,'tgSignals'),  orderBy('addedAt','desc'))),
    getDocs(query(collection(db,'tgWpisy'),    orderBy('addedAt','desc'))),
    getDocs(collection(db,'konta')),
  ])
  ps.forEach(d  => { posts[d.id]     = d.data() })
  ms.forEach(d  => { myPosts[d.id]   = d.data() })
  rs.forEach(d  => { refLinks[d.id]  = d.data() })
  ns.forEach(d  => { notes[d.id]     = d.data() })
  tgs.forEach(d => { tgSignals[d.id] = d.data() })
  tgw.forEach(d => { tgWpisy[d.id]   = d.data() })
  ks.forEach(d  => { konta[d.id]     = d.data() })
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
      // Pomijaj retweety — pobieramy tylko oryginalne posty
      const isRT = (row[COL.type]||'').trim().toUpperCase()==='RT'
                || (row[COL.account]||'').includes(' RT @')
      if (isRT) continue
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
        isRT:    (row[COL.type]||'').trim().toUpperCase()==='RT',
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
  const fn = {main:renderMain, moje:renderMoje, archiwum:renderArchive, notatki:renderNotes, ref:renderRef, kalendarz:renderKalendarz, tgsygnaly:renderTgSygnaly, tgwpisy:renderTgWpisy, konta:renderKonta}
  if (fn[name]) fn[name]()
}

// ── REF CHIPS ─────────────────────────────────────────────────────
function refLinksHtml(postId) {
  const list = Object.values(refLinks)
  if (!list.length) return ''
  const opts = list.map(r =>
    `<option value="${r.url}">${r.name}</option>`
  ).join('')
  return `<div style="padding:5px 14px 6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--border)">
    <span style="font-size:11px;color:var(--text3);white-space:nowrap">Link ref:</span>
    <select id="ref-sel-${postId}" style="font-size:12px;padding:4px 7px;border:1px solid var(--border2);border-radius:var(--r);background:var(--bg3);color:var(--text);flex:1;min-width:120px;max-width:100%">
      <option value="">— wybierz —</option>${opts}
    </select>
    <button class="btn btn-info" style="font-size:11px;padding:4px 10px;white-space:nowrap"
      onclick="copyRefToParaphrase('${postId}')">Kopiuj</button>
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
  const selTy  = document.getElementById('f-type')
  const inpSr  = document.getElementById('f-search')
  if (selAcc) fAccount = selAcc.value
  if (selSt)  fStatus  = selSt.value
  if (selTy)  fType    = selTy.value
  if (inpSr)  fSearch  = inpSr.value.toLowerCase()

  const list = Object.values(posts).filter(p => {
    if (p.status === 'Odrzucone' || p.status === 'Opublikowane') return false
    if (fAccount && p.account !== fAccount) return false
    if (fStatus  && p.status  !== fStatus)  return false
    // isRT może być ustawione przez bota LUB wykryte z nazwy konta (stare wpisy)
    const isRT = p.isRT || (p.account && p.account.includes(' RT @'))
    if (fType === 'rt'   && !isRT)  return false
    if (fType === 'post' &&  isRT)  return false
    if (fSearch  && !p.text.toLowerCase().includes(fSearch)) return false
    return true
  }).sort((a,b) => (b.xDate||b.addedAt).localeCompare(a.xDate||a.addedAt))

  // Odśwież listę kont w filtrze — tylko konta które mają aktywne wpisy
  const accounts = [...new Set(
    Object.values(posts)
      .filter(p => p.status !== 'Odrzucone' && p.status !== 'Opublikowane')
      .map(p => p.account)
  )].sort()
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
        ${(p.isRT || (p.account&&p.account.includes(' RT @'))) ? '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid rgba(124,58,237,.3);font-weight:700">RT</span>' : ''}
        <a class="xlink" href="${p.xLink||'#'}" target="_blank">Otwórz na X ↗</a>
        <span class="post-date">📅 ${p.xDate}</span>
        <select class="status-sel" style="${statusStyle(p.status)}" onchange="setPostStatus('${p.id}',this.value)">
          ${['Nowy','Do zrobienia','W toku','Opublikowane','Odrzucone'].map(s=>`<option${s===p.status?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      ${linksH}${imgsH}
      ${refLinksHtml(p.id)}
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
      <div class="card-note">
        <span style="font-size:11px;color:var(--text3);white-space:nowrap">📝 Notatka:</span>
        <input class="note-inline" id="note-${p.id}" value="${(p.note||'').replace(/"/g,'&quot;')}"
          placeholder="Dodaj notatkę..."
          onblur="savePostNote('${p.id}',this.value)">
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

async function savePostNote(id, value) {
  if (!posts[id] || posts[id].note === value) return
  posts[id].note = value
  await updateDoc(doc(db,'posts',id), { note: value })
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
  const isRT = p => p.isRT || (p.account && p.account.includes(' RT @'))
  s('s-all',  all.filter(p=>p.status!=='Odrzucone'&&p.status!=='Opublikowane').length)
  s('s-new',  all.filter(p=>p.status==='Nowy').length)
  s('s-todo', all.filter(p=>p.status==='Do zrobienia'||p.status==='W toku').length)
  s('s-done', all.filter(p=>p.status==='Opublikowane').length)
  s('s-rt',   all.filter(p=>p.status!=='Odrzucone'&&p.status!=='Opublikowane'&&isRT(p)).length)
}

function updateBadges() {
  const s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v }
  s('tab-main-badge',   Object.values(posts).filter(p=>p.status!=='Odrzucone'&&p.status!=='Opublikowane').length)
  s('tab-moje-badge',   Object.keys(myPosts).length)
  s('tab-arch-badge',   Object.values(posts).filter(p=>p.status==='Opublikowane').length)
  s('tab-notes-badge',  Object.keys(notes).length)
  s('tab-ref-badge',    Object.keys(refLinks).length)
  s('tab-konta-badge',  Object.values(konta).reduce((sum,k)=>(k.accounts||[]).length+sum, 0))
  s('tab-tgsig-badge',  Object.values(tgSignals).filter(p=>p.status==='Nowy').length)
  s('tab-tgwpisy-badge',Object.values(tgWpisy).filter(p=>p.status==='Nowy').length)
}

// ── RENDER: MY POSTS ──────────────────────────────────────────────
function renderMoje() {
  const el   = document.getElementById('moje-cards')
  if (!el) return
  const list = Object.values(myPosts).sort((a,b)=>b.created.localeCompare(a.created))
  if (!list.length) { el.innerHTML='<div class="empty">Brak własnych wpisów.</div>'; return }

  el.innerHTML = list.map(p => {
    const editing = !!p._editing
    return `<div class="mypost-card${p.status==='Opublikowane'?' is-published':''}" id="mycard-${p.id}">
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
      <div class="card-note" style="padding:5px 14px 6px;border-top:1px solid var(--border)">
        <span style="font-size:11px;color:var(--text3);white-space:nowrap">📝 Notatka:</span>
        <input class="note-inline" id="mynote-${p.id}" value="${(p.note||'').replace(/"/g,'&quot;')}"
          placeholder="Dodaj notatkę..."
          onblur="saveMyNote('${p.id}',this.value)">
      </div>
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

async function saveMyNote(id, value) {
  if (!myPosts[id] || myPosts[id].note === value) return
  myPosts[id].note = value
  await updateDoc(doc(db,'myPosts',id), { note: value })
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
        ${(p.isRT || (p.account&&p.account.includes(' RT @'))) ? '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid rgba(124,58,237,.3);font-weight:700">RT</span>' : ''}
        <a class="xlink" href="${p.xLink||'#'}" target="_blank">Otwórz na X ↗</a>
        <span class="post-date">📅 ${p.xDate}</span>
        <span style="font-size:11px;color:var(--text3)">arch. ${p.archivedAt||''}</span>
        <button class="btn ml-auto" id="aexp-${p.id}" onclick="toggleArchExpand('${p.id}')">Rozwiń</button>
      </div>
      <div class="arch-preview" id="arch-preview-${p.id}">${p.text}</div>
      <div class="arch-body" id="arch-body-${p.id}" style="display:none">
        <div class="arch-text">${p.text}</div>
        ${p.para?`<div style="font-size:11px;color:var(--text3);margin-bottom:4px;margin-top:8px">Parafraza:</div><div class="arch-para">${p.para}</div>`:''}
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

function toggleArchExpand(id) {
  const body    = document.getElementById('arch-body-'+id)
  const preview = document.getElementById('arch-preview-'+id)
  const btn     = document.getElementById('aexp-'+id)
  if (!body) return
  const visible = body.style.display !== 'none'
  body.style.display    = visible ? 'none'  : 'block'
  if (preview) preview.style.display = visible ? '' : 'none'
  if (btn) btn.textContent = visible ? 'Rozwiń' : 'Zwiń'
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
          <div><div class="form-label">Notatka</div>
            <input class="form-input" id="re-note-${r.id}" value="${r.note||''}" placeholder="np. mój ref link, wymaga KYC..."></div>
          <div style="display:flex;gap:6px;margin-top:4px">
            <button class="btn btn-primary" onclick="saveRefEdit('${r.id}')">Zapisz</button>
            <button class="btn" onclick="cancelRefEdit('${r.id}')">Anuluj</button>
          </div>
        </div>
      ` : `
        <div class="ref-project">${r.name}</div>
        <div class="ref-link-url">${r.url}</div>
        ${r.note ? `<div style="font-size:12px;color:var(--text3);margin:4px 0 6px;padding:4px 8px;background:var(--bg3);border-radius:var(--r)">📝 ${r.note}</div>` : ''}
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
  const note=document.getElementById(`re-note-${id}`)?.value.trim()||''
  if(!name||!url){toast('Wypełnij oba pola!');return}
  Object.assign(r,{name,url,note,_editing:false})
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

// ── RENDER: TG SYGNAŁY ───────────────────────────────────────────
function renderTgSygnaly() {
  const selCh = document.getElementById('tgsig-channel')
  const selSt = document.getElementById('tgsig-status')
  const inpSr = document.getElementById('tgsig-search')
  if (selCh) tgSigChannel = selCh.value
  if (selSt) tgSigStatus  = selSt.value
  if (inpSr) tgSigSearch  = inpSr.value.toLowerCase()

  const list = Object.entries(tgSignals).filter(([docId, p]) => {
    if (p.status === 'Odrzucone' || p.status === 'Opublikowane') return false
    if (tgSigChannel && p.channel !== tgSigChannel) return false
    if (tgSigStatus  && p.status  !== tgSigStatus)  return false
    if (tgSigSearch  && !p.text.toLowerCase().includes(tgSigSearch)) return false
    return true
  }).sort(([,a],[,b]) => (b.addedAt||b.tgDate).localeCompare(a.addedAt||a.tgDate))

  // Aktualizuj filtr kanałów
  const channels = [...new Set(Object.values(tgSignals).map(p=>p.channel))].sort()
  if (selCh) {
    const prev = selCh.value
    selCh.innerHTML = '<option value="">Wszystkie kanały</option>' +
      channels.map(c => `<option${c===prev?' selected':''}>${c}</option>`).join('')
    selCh.value = prev
  }

  // Statystyki
  const all = Object.values(tgSignals)
  const s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v }
  s('tgsig-s-all',  all.filter(p=>p.status!=='Odrzucone'&&p.status!=='Opublikowane').length)
  s('tgsig-s-new',  all.filter(p=>p.status==='Nowy').length)
  s('tgsig-s-todo', all.filter(p=>p.status==='Do zrobienia'||p.status==='W toku').length)
  s('tgsig-s-done', all.filter(p=>p.status==='Opublikowane').length)

  const el = document.getElementById('tgsig-cards')
  if (!el) return
  if (!list.length) { el.innerHTML = '<div class="empty">Brak sygnałów pasujących do filtrów.</div>'; return }

  el.innerHTML = list.map(([docId, p]) => {
    const kws = p.keywords ? p.keywords.map(k =>
      `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);font-weight:700">${k}</span>`
    ).join('') : ''
    return `<div class="card" id="tgsig-card-${docId}">
      <div class="card-head">
        <span style="font-size:11px;padding:2px 7px;border-radius:10px;background:rgba(0,229,255,.1);color:var(--neon);border:1px solid rgba(0,229,255,.3);font-weight:700">📡 @${p.channel}</span>
        ${kws}
        <a class="xlink" href="${p.link||'#'}" target="_blank">Otwórz na TG ↗</a>
        <span class="post-date">📅 ${(p.tgDate||'').slice(0,16)}</span>
        <select class="status-sel" style="${statusStyle(p.status)}" onchange="setTgStatus('tgSignals','${docId}',this.value,renderTgSygnaly)">
          ${['Nowy','Do zrobienia','W toku','Opublikowane','Odrzucone'].map(s=>`<option${s===p.status?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      ${refLinksHtml('tgsig_'+docId)}
      <div class="card-body">
        <div class="col-orig">
          <div class="col-label">Oryginał</div>
          <div class="orig-text" id="tgsig-orig-${docId}">${p.text}</div>
        </div>
        <div class="col-para">
          <div class="col-label">Twoja parafraza</div>
          <textarea class="para-area" id="tgsig-para-${docId}"
            placeholder="Wklej tutaj swoją parafrazę..."
            onblur="saveTgPara('tgSignals','${docId}',this.value)">${p.para||''}</textarea>
        </div>
      </div>
      <div class="card-note">
        <span style="font-size:11px;color:var(--text3);white-space:nowrap">📝 Notatka:</span>
        <input class="note-inline" id="tgsig-note-${docId}" value="${(p.note||'').replace(/"/g,'&quot;')}"
          placeholder="Dodaj notatkę..."
          onblur="saveTgNote('tgSignals','${docId}',this.value)">
      </div>
      <div class="card-foot">
        <button class="btn" id="tgsig-bexp-${docId}" onclick="toggleTgExpand('tgsig','${docId}')">Rozwiń</button>
        <button class="btn" onclick="copyText(document.getElementById('tgsig-orig-${docId}').innerText)">Kopiuj oryginał</button>
        <button class="btn btn-info" onclick="copyText(document.getElementById('tgsig-para-${docId}').value)">Kopiuj parafrazę</button>
        <span style="font-size:10px;color:var(--text3);margin-left:auto">👁 ${p.views||0} wyświetleń</span>
        <button class="btn btn-danger" onclick="setTgStatus('tgSignals','${docId}','Odrzucone',renderTgSygnaly)">Odrzuć</button>
      </div>
    </div>`
  }).join('')
}

// ── RENDER: TG WPISY ─────────────────────────────────────────────
function renderTgWpisy() {
  const selCh = document.getElementById('tgwpisy-channel')
  const selSt = document.getElementById('tgwpisy-status')
  const inpSr = document.getElementById('tgwpisy-search')
  if (selCh) tgWpisChannel = selCh.value
  if (selSt) tgWpisStatus  = selSt.value
  if (inpSr) tgWpisSearch  = inpSr.value.toLowerCase()

  const list = Object.entries(tgWpisy).filter(([docId, p]) => {
    if (p.status === 'Odrzucone' || p.status === 'Opublikowane') return false
    if (tgWpisChannel && p.channel !== tgWpisChannel) return false
    if (tgWpisStatus  && p.status  !== tgWpisStatus)  return false
    if (tgWpisSearch  && !p.text.toLowerCase().includes(tgWpisSearch)) return false
    return true
  }).sort(([,a],[,b]) => (b.addedAt||b.tgDate).localeCompare(a.addedAt||a.tgDate))

  const channels = [...new Set(Object.values(tgWpisy).map(p=>p.channel))].sort()
  if (selCh) {
    const prev = selCh.value
    selCh.innerHTML = '<option value="">Wszystkie kanały</option>' +
      channels.map(c => `<option${c===prev?' selected':''}>${c}</option>`).join('')
    selCh.value = prev
  }

  const all = Object.values(tgWpisy)
  const s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v }
  s('tgwpisy-s-all',  all.filter(p=>p.status!=='Odrzucone'&&p.status!=='Opublikowane').length)
  s('tgwpisy-s-new',  all.filter(p=>p.status==='Nowy').length)
  s('tgwpisy-s-todo', all.filter(p=>p.status==='Do zrobienia'||p.status==='W toku').length)
  s('tgwpisy-s-done', all.filter(p=>p.status==='Opublikowane').length)

  const el = document.getElementById('tgwpisy-cards')
  if (!el) return
  if (!list.length) { el.innerHTML = '<div class="empty">Brak wpisów pasujących do filtrów.</div>'; return }

  el.innerHTML = list.map(([docId, p]) => `
    <div class="card" id="tgwpisy-card-${docId}">
      <div class="card-head">
        <span style="font-size:11px;padding:2px 7px;border-radius:10px;background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid rgba(124,58,237,.3);font-weight:700">📋 @${p.channel}</span>
        <a class="xlink" href="${p.link||'#'}" target="_blank">Otwórz na TG ↗</a>
        <span class="post-date">📅 ${(p.tgDate||'').slice(0,16)}</span>
        <select class="status-sel" style="${statusStyle(p.status)}" onchange="setTgStatus('tgWpisy','${docId}',this.value,renderTgWpisy)">
          ${['Nowy','Do zrobienia','W toku','Opublikowane','Odrzucone'].map(s=>`<option${s===p.status?' selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      ${refLinksHtml('tgwpisy_'+docId)}
      <div class="card-body">
        <div class="col-orig">
          <div class="col-label">Oryginał</div>
          <div class="orig-text" id="tgwpisy-orig-${docId}">${p.text}</div>
        </div>
        <div class="col-para">
          <div class="col-label">Twoja parafraza</div>
          <textarea class="para-area" id="tgwpisy-para-${docId}"
            placeholder="Wklej tutaj swoją parafrazę..."
            onblur="saveTgPara('tgWpisy','${docId}',this.value)">${p.para||''}</textarea>
        </div>
      </div>
      <div class="card-note">
        <span style="font-size:11px;color:var(--text3);white-space:nowrap">📝 Notatka:</span>
        <input class="note-inline" id="tgwpisy-note-${docId}" value="${(p.note||'').replace(/"/g,'&quot;')}"
          placeholder="Dodaj notatkę..."
          onblur="saveTgNote('tgWpisy','${docId}',this.value)">
      </div>
      <div class="card-foot">
        <button class="btn" id="tgwpisy-bexp-${docId}" onclick="toggleTgExpand('tgwpisy','${docId}')">Rozwiń</button>
        <button class="btn" onclick="copyText(document.getElementById('tgwpisy-orig-${docId}').innerText)">Kopiuj oryginał</button>
        <button class="btn btn-info" onclick="copyText(document.getElementById('tgwpisy-para-${docId}').value)">Kopiuj parafrazę</button>
        <span style="font-size:10px;color:var(--text3);margin-left:auto">👁 ${p.views||0} wyświetleń</span>
        <button class="btn btn-danger" onclick="setTgStatus('tgWpisy','${docId}','Odrzucone',renderTgWpisy)">Odrzuć</button>
      </div>
    </div>`
  ).join('')
}

// ── RENDER: KONTA ────────────────────────────────────────────────
function renderKonta() {
  const el = document.getElementById('konta-cards')
  if (!el) return
  const list = Object.entries(konta).sort(([,a],[,b]) => a.name.localeCompare(b.name))
  if (!list.length) {
    el.innerHTML = '<div class="empty">Brak kategorii kont. Kliknij "+ Dodaj kategorię" aby zacząć.</div>'
    return
  }
  el.innerHTML = list.map(([katId, kat]) => {
    const accounts = kat.accounts || []
    const editingKat = !!kat._editingKat
    return `<div class="konta-card" id="konta-card-${katId}">
      <div class="konta-head">
        <span class="konta-icon">${kat.icon||'👤'}</span>
        ${editingKat ? `
          <input class="form-input" id="kat-edit-name-${katId}" value="${kat.name}" style="flex:1;max-width:180px">
          <input class="form-input" id="kat-edit-icon-${katId}" value="${kat.icon||''}" style="max-width:70px" placeholder="emoji">
          <button class="btn btn-primary" style="font-size:11px;padding:3px 10px" onclick="saveKatEdit('${katId}')">Zapisz</button>
          <button class="btn" style="font-size:11px;padding:3px 8px" onclick="cancelKatEdit('${katId}')">Anuluj</button>
        ` : `
          <span class="konta-title">${kat.name}</span>
          <span style="font-size:11px;color:var(--text3)">${accounts.length} ${accounts.length===1?'konto':accounts.length<5?'konta':'kont'}</span>
          <button class="btn ml-auto" style="font-size:11px;padding:3px 8px" onclick="startKatEdit('${katId}')">Edytuj</button>
          <button class="btn btn-danger" style="font-size:11px;padding:3px 8px" onclick="deleteKategoria('${katId}')">Usuń</button>
        `}
      </div>
      ${kat.note && !editingKat ? `<div class="konta-note-display">📝 ${kat.note}</div>` : ''}
      ${editingKat ? `
        <div style="padding:8px 14px;border-bottom:1px solid var(--border)">
          <div class="form-label">Notatka kategorii</div>
          <input class="form-input" id="kat-edit-note-${katId}" value="${kat.note||''}" placeholder="Notatka...">
        </div>
      ` : ''}

      <div class="konta-accounts">
        ${accounts.map((acc, idx) => `
          <div class="konta-acc-row" id="acc-row-${katId}-${idx}">
            ${acc._editing ? `
              <input class="form-input" id="acc-edit-name-${katId}-${idx}" value="${acc.name}" style="flex:1">
              <input class="form-input" id="acc-edit-note-${katId}-${idx}" value="${acc.note||''}" placeholder="notatka..." style="flex:1">
              <button class="btn btn-primary" style="font-size:11px;padding:3px 10px" onclick="saveAccEdit('${katId}',${idx})">Zapisz</button>
              <button class="btn" style="font-size:11px;padding:3px 8px" onclick="cancelAccEdit('${katId}',${idx})">Anuluj</button>
            ` : `
              <button class="konta-copy-btn" onclick="copyText('${acc.name.replace(/'/g,"\\'")}');this.textContent='✓';setTimeout(()=>this.textContent='${acc.name.replace(/'/g,"\\'")}',1200)" title="Kliknij aby skopiować">${acc.name}</button>
              ${acc.note ? `<span class="konta-acc-note">📝 ${acc.note}</span>` : ''}
              <div class="konta-acc-actions">
                <button class="btn" style="font-size:10px;padding:2px 7px" onclick="startAccEdit('${katId}',${idx})">Edytuj</button>
                <button class="btn btn-danger" style="font-size:10px;padding:2px 7px" onclick="deleteAccount('${katId}',${idx})">Usuń</button>
              </div>
            `}
          </div>`).join('')}
      </div>

      <div class="konta-add-row">
        <input class="form-input" id="new-acc-name-${katId}" placeholder="Nazwa konta (np. @WojciechK)" style="flex:1"
          onkeydown="if(event.key==='Enter') addAccount('${katId}')">
        <input class="form-input" id="new-acc-note-${katId}" placeholder="Notatka (opcjonalnie)" style="flex:1"
          onkeydown="if(event.key==='Enter') addAccount('${katId}')">
        <button class="btn btn-primary" style="font-size:12px;padding:5px 12px;white-space:nowrap" onclick="addAccount('${katId}')">+ Dodaj konto</button>
      </div>
    </div>`
  }).join('')
}

// ── KONTA ACTIONS ─────────────────────────────────────────────────
function toggleKatForm(show) {
  const f = document.getElementById('kat-form')
  const b = document.getElementById('btn-add-kat')
  if (!f||!b) return
  if (show === undefined) show = f.style.display === 'none'
  f.style.display = show ? 'block' : 'none'
  b.textContent   = show ? '✕ Zamknij' : '+ Dodaj kategorię'
  if (show) {
    const n = document.getElementById('kat-name')
    const i = document.getElementById('kat-icon')
    const t = document.getElementById('kat-note')
    if (n) n.value = ''
    if (i) i.value = ''
    if (t) t.value = ''
  }
}

async function addKategoria() {
  const name = document.getElementById('kat-name')?.value.trim()
  const icon = document.getElementById('kat-icon')?.value.trim() || '👤'
  const note = document.getElementById('kat-note')?.value.trim() || ''
  if (!name) { toast('Wpisz nazwę kategorii!'); return }
  const id = uid()
  const kat = { id, name, icon, note, accounts: [], addedAt: nowStr() }
  await setDoc(doc(db, 'konta', id), kat)
  konta[id] = kat
  toggleKatForm(false)
  renderKonta(); updateBadges(); toast('Kategoria dodana ✓')
}

function startKatEdit(katId) {
  if (konta[katId]) { konta[katId]._editingKat = true; renderKonta() }
}
function cancelKatEdit(katId) {
  if (konta[katId]) { konta[katId]._editingKat = false; renderKonta() }
}

async function saveKatEdit(katId) {
  const kat = konta[katId]; if (!kat) return
  const name = document.getElementById(`kat-edit-name-${katId}`)?.value.trim() || kat.name
  const icon = document.getElementById(`kat-edit-icon-${katId}`)?.value.trim() || kat.icon
  const note = document.getElementById(`kat-edit-note-${katId}`)?.value.trim() || ''
  Object.assign(kat, { name, icon, note, _editingKat: false })
  const save = { ...kat }; delete save._editingKat
  await setDoc(doc(db, 'konta', katId), save)
  toast('Zaktualizowano ✓'); renderKonta(); updateBadges()
}

async function deleteKategoria(katId) {
  if (!confirm('Usunąć całą kategorię wraz z kontami?')) return
  await deleteDoc(doc(db, 'konta', katId))
  delete konta[katId]
  renderKonta(); updateBadges(); toast('Usunięto ✓')
}

async function addAccount(katId) {
  const kat = konta[katId]; if (!kat) return
  const nameEl = document.getElementById(`new-acc-name-${katId}`)
  const noteEl = document.getElementById(`new-acc-note-${katId}`)
  const name = nameEl?.value.trim()
  const note = noteEl?.value.trim() || ''
  if (!name) { toast('Wpisz nazwę konta!'); return }
  if (!kat.accounts) kat.accounts = []
  kat.accounts.push({ name, note })
  const save = { ...kat }; delete save._editingKat
  await setDoc(doc(db, 'konta', katId), save)
  if (nameEl) nameEl.value = ''
  if (noteEl) noteEl.value = ''
  renderKonta(); updateBadges(); toast('Konto dodane ✓')
}

function startAccEdit(katId, idx) {
  if (konta[katId]?.accounts?.[idx]) { konta[katId].accounts[idx]._editing = true; renderKonta() }
}
function cancelAccEdit(katId, idx) {
  if (konta[katId]?.accounts?.[idx]) { konta[katId].accounts[idx]._editing = false; renderKonta() }
}

async function saveAccEdit(katId, idx) {
  const kat = konta[katId]; if (!kat?.accounts?.[idx]) return
  const name = document.getElementById(`acc-edit-name-${katId}-${idx}`)?.value.trim() || ''
  const note = document.getElementById(`acc-edit-note-${katId}-${idx}`)?.value.trim() || ''
  if (!name) { toast('Wpisz nazwę konta!'); return }
  kat.accounts[idx] = { name, note }
  const save = { ...kat }; delete save._editingKat
  save.accounts = save.accounts.map(a => { const c={...a}; delete c._editing; return c })
  await setDoc(doc(db, 'konta', katId), save)
  toast('Zaktualizowano ✓'); renderKonta()
}

async function deleteAccount(katId, idx) {
  const kat = konta[katId]; if (!kat?.accounts) return
  kat.accounts.splice(idx, 1)
  const save = { ...kat }; delete save._editingKat
  save.accounts = save.accounts.map(a => { const c={...a}; delete c._editing; return c })
  await setDoc(doc(db, 'konta', katId), save)
  renderKonta(); updateBadges(); toast('Usunięto ✓')
}

// ── TG ACTIONS ────────────────────────────────────────────────────
async function setTgStatus(collectionName, docId, status, rerenderFn) {
  const store = collectionName === 'tgSignals' ? tgSignals : tgWpisy
  // docId to klucz dokumentu Firestore (np. tgs_kanal_123), nie p.id
  if (!store[docId]) return
  store[docId].status = status
  const upd = { status }
  if (status === 'Opublikowane') { store[docId].archivedAt = nowStr(); upd.archivedAt = store[docId].archivedAt }
  await updateDoc(doc(db, collectionName, docId), upd)
  if (status === 'Opublikowane') toast('Przeniesiono do Archiwum ✓')
  updateBadges()
  rerenderFn()
}

async function saveTgPara(collectionName, docId, value) {
  const store = collectionName === 'tgSignals' ? tgSignals : tgWpisy
  if (!store[docId] || store[docId].para === value) return
  store[docId].para = value
  await updateDoc(doc(db, collectionName, docId), { para: value })
}

async function saveTgNote(collectionName, docId, value) {
  const store = collectionName === 'tgSignals' ? tgSignals : tgWpisy
  if (!store[docId] || store[docId].note === value) return
  store[docId].note = value
  await updateDoc(doc(db, collectionName, docId), { note: value })
}

function toggleTgExpand(prefix, id) {
  const o = document.getElementById(`${prefix}-orig-${id}`)
  const p = document.getElementById(`${prefix}-para-${id}`)
  const b = document.getElementById(`${prefix}-bexp-${id}`)
  if (!o) return
  const ex = o.classList.contains('expanded')
  if (!ex) {
    o.classList.add('expanded')
    if (p) p.classList.add('expanded')
    requestAnimationFrame(() => {
      const hO = o.scrollHeight
      const hP = p ? p.scrollHeight : 0
      const maxH = Math.max(hO, hP)
      o.style.maxHeight = maxH + 'px'
      if (p) p.style.minHeight = maxH + 'px'
    })
  } else {
    o.classList.remove('expanded')
    o.style.maxHeight = ''
    if (p) { p.classList.remove('expanded'); p.style.minHeight = '' }
  }
  if (b) b.textContent = ex ? 'Rozwiń' : 'Zwiń'
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
      <button class="tab active" data-tab="main"       onclick="switchTab('main')">Wpisy <span class="tab-badge" id="tab-main-badge">0</span></button>
      <button class="tab"        data-tab="moje"       onclick="switchTab('moje')">Moje wpisy <span class="tab-badge" id="tab-moje-badge">0</span></button>
      <button class="tab"        data-tab="archiwum"   onclick="switchTab('archiwum')">Archiwum <span class="tab-badge" id="tab-arch-badge">0</span></button>
      <button class="tab"        data-tab="notatki"    onclick="switchTab('notatki')">Notatki <span class="tab-badge" id="tab-notes-badge">0</span></button>
      <button class="tab"        data-tab="ref"        onclick="switchTab('ref')">Linki ref <span class="tab-badge" id="tab-ref-badge">0</span></button>
      <button class="tab"        data-tab="konta"      onclick="switchTab('konta')">👤 Konta <span class="tab-badge" id="tab-konta-badge" style="background:rgba(16,185,129,.2);color:#10b981">0</span></button>
      <button class="tab"        data-tab="tgsygnaly"  onclick="switchTab('tgsygnaly')">📡 TG Sygnały <span class="tab-badge" id="tab-tgsig-badge" style="background:rgba(245,158,11,.25);color:#f59e0b">0</span></button>
      <button class="tab"        data-tab="tgwpisy"    onclick="switchTab('tgwpisy')">📋 TG Wpisy <span class="tab-badge" id="tab-tgwpisy-badge" style="background:rgba(124,58,237,.25);color:#a78bfa">0</span></button>
      <button class="tab"        data-tab="kalendarz"  onclick="switchTab('kalendarz')">Kalendarz</button>
    </div>

    <!-- WPISY -->
    <div id="page-main" class="page active">
      <div class="stats" style="grid-template-columns:repeat(5,minmax(0,1fr))">
        <div class="stat"><div class="stat-n" id="s-all" style="color:var(--text)">0</div><div class="stat-l">Wszystkich</div></div>
        <div class="stat"><div class="stat-n" id="s-new" style="color:var(--neon)">0</div><div class="stat-l">Nowych</div></div>
        <div class="stat"><div class="stat-n" id="s-todo" style="color:var(--neon4)">0</div><div class="stat-l">W toku</div></div>
        <div class="stat"><div class="stat-n" id="s-done" style="color:var(--neon3)">0</div><div class="stat-l">Opublikowanych</div></div>
        <div class="stat" style="cursor:pointer" onclick="document.getElementById('f-type').value='rt';renderMain()" title="Kliknij aby filtrować RT">
          <div class="stat-n" id="s-rt" style="color:#a78bfa">0</div>
          <div class="stat-l">Retweetów</div>
        </div>
      </div>
      <div class="filters">
        <select id="f-account" onchange="renderMain()"><option value="">Wszystkie konta</option></select>
        <select id="f-status"  onchange="renderMain()">
          <option value="">Wszystkie statusy</option>
          <option>Nowy</option><option>Do zrobienia</option><option>W toku</option>
        </select>
        <select id="f-type" onchange="renderMain()">
          <option value="">Posty i RT</option>
          <option value="post">Tylko posty</option>
          <option value="rt">Tylko RT</option>
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
            <div>
              <div class="form-label">Link referencyjny</div>
              <div style="display:flex;gap:8px;align-items:center">
                <select class="form-select" id="np-reflink" style="flex:1">${refSelectHtml()}</select>
                <button class="btn btn-info" style="white-space:nowrap" onclick="copyRefFromSelect('np-reflink')">Kopiuj link</button>
              </div>
            </div>
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

  
    <!-- KALENDARZ -->
    <div id="page-kalendarz" class="page">
    </div>

    <!-- TG SYGNAŁY -->
    <div id="page-tgsygnaly" class="page">
      <div class="stats" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        <div class="stat"><div class="stat-n" id="tgsig-s-all"  style="color:var(--text)">0</div><div class="stat-l">Wszystkich</div></div>
        <div class="stat"><div class="stat-n" id="tgsig-s-new"  style="color:#f59e0b">0</div><div class="stat-l">Nowych</div></div>
        <div class="stat"><div class="stat-n" id="tgsig-s-todo" style="color:var(--neon4)">0</div><div class="stat-l">W toku</div></div>
        <div class="stat"><div class="stat-n" id="tgsig-s-done" style="color:var(--neon3)">0</div><div class="stat-l">Opublikowanych</div></div>
      </div>
      <div class="filters">
        <select id="tgsig-channel" onchange="renderTgSygnaly()"><option value="">Wszystkie kanały</option></select>
        <select id="tgsig-status"  onchange="renderTgSygnaly()">
          <option value="">Wszystkie statusy</option>
          <option>Nowy</option><option>Do zrobienia</option><option>W toku</option>
        </select>
        <input id="tgsig-search" placeholder="Szukaj w treści..." oninput="renderTgSygnaly()" style="flex:1;min-width:140px">
      </div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:10px;padding:0 2px">
        ⚡ Sygnały filtrowane według słów kluczowych zdefiniowanych w <code style="background:var(--bg3);padding:1px 5px;border-radius:3px">tg_sygnaly.txt</code> na VPS
      </div>
      <div id="tgsig-cards"><div class="loading">Ładowanie...</div></div>
    </div>

    <!-- TG WPISY -->
    <div id="page-tgwpisy" class="page">
      <div class="stats" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        <div class="stat"><div class="stat-n" id="tgwpisy-s-all"  style="color:var(--text)">0</div><div class="stat-l">Wszystkich</div></div>
        <div class="stat"><div class="stat-n" id="tgwpisy-s-new"  style="color:#a78bfa">0</div><div class="stat-l">Nowych</div></div>
        <div class="stat"><div class="stat-n" id="tgwpisy-s-todo" style="color:var(--neon4)">0</div><div class="stat-l">W toku</div></div>
        <div class="stat"><div class="stat-n" id="tgwpisy-s-done" style="color:var(--neon3)">0</div><div class="stat-l">Opublikowanych</div></div>
      </div>
      <div class="filters">
        <select id="tgwpisy-channel" onchange="renderTgWpisy()"><option value="">Wszystkie kanały</option></select>
        <select id="tgwpisy-status"  onchange="renderTgWpisy()">
          <option value="">Wszystkie statusy</option>
          <option>Nowy</option><option>Do zrobienia</option><option>W toku</option>
        </select>
        <input id="tgwpisy-search" placeholder="Szukaj w treści..." oninput="renderTgWpisy()" style="flex:1;min-width:140px">
      </div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:10px;padding:0 2px">
        📋 Wszystkie wiadomości z kanałów zdefiniowanych w <code style="background:var(--bg3);padding:1px 5px;border-radius:3px">tg_wpisy.txt</code> na VPS
      </div>
      <div id="tgwpisy-cards"><div class="loading">Ładowanie...</div></div>
    </div>

    <!-- KONTA -->
    <div id="page-konta" class="page">
      <div class="section-header">
        <span style="font-size:13px;color:var(--text2)">Kategorie kont z możliwością kopiowania jednym kliknięciem</span>
        <button class="btn-add" id="btn-add-kat" onclick="toggleKatForm()">+ Dodaj kategorię</button>
      </div>
      <div id="kat-form" style="display:none">
        <div class="form-card" style="margin-bottom:16px">
          <div class="form-title">Nowa kategoria kont</div>
          <div class="form-row">
            <div>
              <div class="form-label">Nazwa kategorii</div>
              <input class="form-input" id="kat-name" placeholder="np. Twitter, Telegram, Email...">
            </div>
            <div>
              <div class="form-label">Ikona (emoji)</div>
              <input class="form-input" id="kat-icon" placeholder="np. 𝕏 📱 📧" maxlength="4" style="max-width:100px">
            </div>
          </div>
          <div class="form-row full">
            <div>
              <div class="form-label">Notatka do kategorii</div>
              <input class="form-input" id="kat-note" placeholder="np. konta do airdropów, konta główne...">
            </div>
          </div>
          <div class="form-btns">
            <button class="btn btn-primary" onclick="addKategoria()">Dodaj kategorię</button>
            <button class="btn" onclick="toggleKatForm(false)">Anuluj</button>
          </div>
        </div>
      </div>
      <div id="konta-cards"></div>
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

// ── KALENDARZ ────────────────────────────────────────────────────
function renderKalendarz() {
  const el = document.getElementById('page-kalendarz')
  if (!el) return

  // Zbierz wszystkie opublikowane wpisy z posts i myPosts
  const published = []

  Object.values(posts).forEach(p => {
    if (p.status === 'Opublikowane') {
      const dateStr = (p.archivedAt || p.xDate || '').slice(0, 10)
      if (dateStr) published.push({ date: dateStr, source: 'wpisy', text: p.text, account: '@' + p.account, xLink: p.xLink || '', para: p.para || '' })
    }
  })

  Object.values(myPosts).forEach(p => {
    if (p.status === 'Opublikowane') {
      const dateStr = (p.published || p.created || '').slice(0, 10)
      if (dateStr) published.push({ date: dateStr, source: 'moje', text: p.text, account: 'Mój wpis', xLink: '', para: '', tags: p.tags || '' })
    }
  })

  // Grupuj po dacie
  const byDate = {}
  published.forEach(p => {
    if (!byDate[p.date]) byDate[p.date] = []
    byDate[p.date].push(p)
  })

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))
  const total = published.length
  const totalDays = dates.length
  const avgPerDay = totalDays ? (total / totalDays).toFixed(1) : 0

  // Streak - ile dni z rzędu (od dzisiaj wstecz)
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 60; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const ds = d.toISOString().slice(0, 10)
    if (byDate[ds]) streak++
    else if (i > 0) break
  }

  // Najaktywniejszy dzień
  let maxDay = '', maxCount = 0
  dates.forEach(d => { if (byDate[d].length > maxCount) { maxCount = byDate[d].length; maxDay = d } })

  // Aktywność ostatnie 4 tygodnie (heatmapa)
  const heatmap = []
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const ds = d.toISOString().slice(0, 10)
    heatmap.push({ date: ds, count: byDate[ds] ? byDate[ds].length : 0 })
  }
  const maxHeat = Math.max(...heatmap.map(h => h.count), 1)

  function heatColor(count) {
    if (count === 0) return 'background:var(--bg3)'
    const intensity = Math.min(count / maxHeat, 1)
    if (intensity < 0.33) return 'background:rgba(0,229,255,0.25)'
    if (intensity < 0.66) return 'background:rgba(0,229,255,0.55)'
    return 'background:rgba(0,229,255,0.9)'
  }

  // Statystyki per konto
  const byAccount = {}
  published.forEach(p => {
    byAccount[p.account] = (byAccount[p.account] || 0) + 1
  })
  const topAccounts = Object.entries(byAccount).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Aktywność per miesiąc
  const byMonth = {}
  published.forEach(p => {
    const m = p.date.slice(0, 7)
    byMonth[m] = (byMonth[m] || 0) + 1
  })
  const months = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)
  const maxMonth = Math.max(...months.map(m => m[1]), 1)

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:20px">
      <div class="stat"><div class="stat-n" style="color:var(--neon)">${total}</div><div class="stat-l">Opublikowanych</div></div>
      <div class="stat"><div class="stat-n" style="color:var(--neon3)">${totalDays}</div><div class="stat-l">Aktywnych dni</div></div>
      <div class="stat"><div class="stat-n" style="color:var(--neon4)">${avgPerDay}</div><div class="stat-l">Śr. dziennie</div></div>
      <div class="stat"><div class="stat-n" style="color:var(--neon2)">${streak}</div><div class="stat-l">Dni z rzędu</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">

      <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:var(--rl);padding:14px">
        <div style="font-size:12px;font-weight:700;color:var(--neon);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em">Aktywność — ostatnie 4 tygodnie</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px">
          ${['Pn','Wt','Śr','Cz','Pt','Sb','Nd'].map(d=>`<div style="font-size:9px;color:var(--text3);text-align:center">${d}</div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
          ${heatmap.map(h=>`<div title="${h.date}: ${h.count} wpisów" style="aspect-ratio:1;border-radius:3px;${heatColor(h.count)};cursor:${h.count?'pointer':'default'}" onclick="${h.count?`showDayPosts('${h.date}')`:''}" ></div>`).join('')}
        </div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:8px">
          <span style="font-size:10px;color:var(--text3)">Mniej</span>
          ${[0,0.25,0.55,0.9].map(o=>`<div style="width:12px;height:12px;border-radius:2px;background:rgba(0,229,255,${o||0.08})"></div>`).join('')}
          <span style="font-size:10px;color:var(--text3)">Więcej</span>
        </div>
      </div>

      <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:var(--rl);padding:14px">
        <div style="font-size:12px;font-weight:700;color:var(--neon);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em">Aktywność miesięczna</div>
        ${months.length ? months.map(([m, cnt]) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
            <span style="font-size:12px;color:var(--text2);min-width:65px">${m}</span>
            <div style="flex:1;height:14px;background:var(--bg3);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${Math.round(cnt/maxMonth*100)}%;background:var(--neon);border-radius:3px;transition:width .3s"></div>
            </div>
            <span style="font-size:12px;color:var(--neon);min-width:20px;text-align:right">${cnt}</span>
          </div>`).join('') : '<div style="color:var(--text3);font-size:13px">Brak danych</div>'}
      </div>

    </div>

    ${topAccounts.length ? `
    <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:var(--rl);padding:14px;margin-bottom:20px">
      <div style="font-size:12px;font-weight:700;color:var(--neon);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em">Top źródła wpisów</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">
        ${topAccounts.map(([acc, cnt]) => `
          <div style="background:var(--bg3);border-radius:var(--r);padding:10px;text-align:center">
            <div style="font-size:13px;font-weight:700;color:var(--neon)">${cnt}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${acc}</div>
          </div>`).join('')}
      </div>
    </div>` : ''}

    <div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:10px">
      Historia publikacji — kliknij dzień aby zobaczyć wpisy
    </div>

    ${dates.length ? dates.map(date => `
      <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:var(--rl);overflow:hidden;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border)"
          onclick="toggleDayPosts('${date}')">
          <span style="font-size:13px;font-weight:700;color:var(--neon)">${date}</span>
          <span style="font-size:11px;color:var(--text3)">${new Date(date + 'T12:00:00').toLocaleDateString('pl-PL',{weekday:'long'})}</span>
          <span style="background:rgba(0,229,255,.12);color:var(--neon);font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:auto">${byDate[date].length} ${byDate[date].length===1?'wpis':byDate[date].length<5?'wpisy':'wpisów'}</span>
          <button class="btn" id="kbtn-${date}" style="font-size:11px;padding:3px 8px">Rozwiń</button>
        </div>
        <div id="kday-${date}" style="display:none">
          ${byDate[date].map((p, i) => `
            <div style="padding:10px 14px;border-bottom:${i<byDate[date].length-1?'1px solid var(--border)':'none'}">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
                <span style="font-size:12px;font-weight:700;color:${p.source==='moje'?'var(--neon2)':'var(--neon)'}">${p.account}</span>
                <span style="font-size:10px;padding:2px 6px;border-radius:3px;background:${p.source==='moje'?'rgba(124,58,237,.15)':'rgba(0,229,255,.1)'};color:${p.source==='moje'?'#a78bfa':'var(--neon)'}">${p.source==='moje'?'Mój wpis':'Z Wpisów'}</span>
                ${p.xLink?`<a class="xlink" href="${p.xLink}" target="_blank" style="font-size:10px">X ↗</a>`:''}
                ${p.tags?`<span style="font-size:11px;color:var(--neon)">${p.tags}</span>`:''}
              </div>
              <div id="kpost-${date}-${i}" style="font-size:13px;color:var(--text);white-space:pre-wrap;word-break:break-word;line-height:1.65;max-height:62px;overflow:hidden;mask-image:linear-gradient(to bottom,black 40%,transparent 100%)">${p.text}</div>
              ${p.para?`<div style="font-size:11px;color:var(--text3);margin-top:6px;margin-bottom:3px">Parafraza:</div>
              <div id="kpara-${date}-${i}" style="font-size:13px;color:var(--text);white-space:pre-wrap;word-break:break-word;line-height:1.65;max-height:62px;overflow:hidden;mask-image:linear-gradient(to bottom,black 40%,transparent 100%);background:var(--bg3);padding:6px 8px;border-radius:var(--r)">${p.para}</div>`:''}
              <div style="margin-top:6px">
                <button class="btn" id="kpbtn-${date}-${i}" style="font-size:11px;padding:3px 8px" onclick="toggleKPost('${date}',${i})">Rozwiń</button>
              </div>
            </div>`).join('')}
        </div>
      </div>`).join('')
    : '<div class="empty">Brak opublikowanych wpisów.</div>'}
  `
}

function toggleDayPosts(date) {
  const el  = document.getElementById('kday-' + date)
  const btn = document.getElementById('kbtn-' + date)
  if (!el) return
  const open = el.style.display !== 'none'
  el.style.display = open ? 'none' : 'block'
  if (btn) btn.textContent = open ? 'Rozwiń' : 'Zwiń'
}

function showDayPosts(date) {
  // Kliknięcie w heatmapę — otwórz dzień jeśli istnieje na liście
  const el = document.getElementById('kday-' + date)
  if (el) { el.style.display = 'block'; const btn = document.getElementById('kbtn-' + date); if (btn) btn.textContent = 'Zwiń'; el.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
}

function toggleKPost(date, idx) {
  const post = document.getElementById(`kpost-${date}-${idx}`)
  const para = document.getElementById(`kpara-${date}-${idx}`)
  const btn  = document.getElementById(`kpbtn-${date}-${idx}`)
  if (!post) return
  const expanded = post.style.maxHeight === 'none'
  post.style.maxHeight = expanded ? '62px' : 'none'
  post.style.maskImage = expanded ? 'linear-gradient(to bottom,black 40%,transparent 100%)' : 'none'
  if (para) { para.style.maxHeight = expanded ? '62px' : 'none'; para.style.maskImage = expanded ? 'linear-gradient(to bottom,black 40%,transparent 100%)' : 'none' }
  if (btn) btn.textContent = expanded ? 'Rozwiń' : 'Zwiń'
}

// ── REF COPY HELPERS ─────────────────────────────────────────────
function copyRefToParaphrase(postId) {
  const sel = document.getElementById('ref-sel-'+postId)
  if (!sel || !sel.value) { toast('Wybierz link z listy!'); return }
  copyText(sel.value)
}

function copyRefFromSelect(selectId) {
  const sel = document.getElementById(selectId)
  if (!sel || !sel.value) { toast('Wybierz link z listy!'); return }
  copyText(sel.value)
}

// ── EXPOSE ────────────────────────────────────────────────────────
Object.assign(window, {
  loginGoogle, logout, switchTab, syncSheets,
  renderMain, setPostStatus, savePara, savePostNote, toggleExpand, copyText,
  renderMoje, toggleMyExpand, startMyEdit, cancelMyEdit, saveMyEdit,
  addMyPost, toggleMyForm, publishMyPost, deleteMyPost, saveMyNote,
  renderArchive, restorePost, toggleArchExpand,
  addNote, deleteNote,
  renderRef, toggleRefForm, addRef, startRefEdit, cancelRefEdit, saveRefEdit, deleteRef,
  toggleEmojiPanel, addEmoji, emojiClick, removeEmoji,
  copyRefToParaphrase, copyRefFromSelect,
  renderKalendarz, toggleDayPosts, showDayPosts, toggleKPost,
  renderTgSygnaly, renderTgWpisy, setTgStatus, saveTgPara, saveTgNote, toggleTgExpand,
  renderKonta, toggleKatForm, addKategoria, startKatEdit, cancelKatEdit, saveKatEdit, deleteKategoria,
  addAccount, startAccEdit, cancelAccEdit, saveAccEdit, deleteAccount,
})

// ── INIT ──────────────────────────────────────────────────────────
buildApp()

onAuthStateChanged(auth, async user => {
  if (user) {
    showMainApp(user)
    await loadAll()
    await loadEmojis()
    renderEmojiPanel()
    renderMain(); renderMoje(); renderNotes(); renderRef(); renderKonta()
    updateStats(); updateBadges()
    await syncSheets()
    setInterval(syncSheets, 5 * 60 * 1000)
    // Odśwież TG dane co 2 minuty (live update bez bota)
    setInterval(async () => {
      const [tgs, tgw] = await Promise.all([
        getDocs(query(collection(db,'tgSignals'), orderBy('addedAt','desc'))),
        getDocs(query(collection(db,'tgWpisy'),   orderBy('addedAt','desc'))),
      ])
      let tgSigNew = 0, tgWpisNew = 0
      tgs.forEach(d => { if (!tgSignals[d.id]) tgSigNew++; tgSignals[d.id] = d.data() })
      tgw.forEach(d => { if (!tgWpisy[d.id])   tgWpisNew++; tgWpisy[d.id]  = d.data() })
      updateBadges()
      if (tgSigNew > 0) { toast(`📡 ${tgSigNew} nowych sygnałów TG!`); if(document.getElementById('page-tgsygnaly')?.classList.contains('active')) renderTgSygnaly() }
      if (tgWpisNew > 0) { toast(`📋 ${tgWpisNew} nowych wpisów TG!`); if(document.getElementById('page-tgwpisy')?.classList.contains('active')) renderTgWpisy() }
    }, 2 * 60 * 1000)
  } else {
    showAuthScreen()
  }
})
