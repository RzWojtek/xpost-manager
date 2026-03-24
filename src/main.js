// src/main.js
import './style.css'
import { db } from './firebase.js'
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot
} from 'firebase/firestore'

// ── GOOGLE SHEETS CONFIG ──────────────────────────────────────────
const SHEET_ID  = import.meta.env.VITE_SHEET_ID
const SHEET_TAB = import.meta.env.VITE_SHEET_TAB || 'Arkusz1'
const API_KEY   = import.meta.env.VITE_SHEETS_API_KEY

// Kolumny w Sheets (0-indexed): A=data, B=konto, C=tekst, D=link_X, E=linki, F=id, G=zrobione, H=zdjecia
const COL = { date: 0, account: 1, text: 2, link: 3, links: 4, id: 5, img: 7 }

// ── STATE ─────────────────────────────────────────────────────────
let posts    = {}   // { id: {...} }  — z Firebase
let myPosts  = {}
let refLinks = {}
let notes    = {}

let filterAccount = ''
let filterStatus  = ''
let filterSearch  = ''

// ── HELPERS ───────────────────────────────────────────────────────
const now = () => new Date().toLocaleString('pl-PL', { hour12: false }).replace(',', '')
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

function toast(msg) {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(el._t)
  el._t = setTimeout(() => el.classList.remove('show'), 2400)
}

function statusBadge(s) {
  const map = {
    'Nowy': 'badge-new', 'Do zrobienia': 'badge-todo', 'W toku': 'badge-wip',
    'Opublikowane': 'badge-done', 'Odrzucone': 'badge-rejected',
    'Powrót z archiwum': 'badge-return', 'Szkic': 'badge-draft'
  }
  return `<span class="badge ${map[s] || 'badge-draft'}">${s}</span>`
}

function statusStyle(s) {
  const map = {
    'Nowy': 'background:var(--blue-bg);color:var(--blue)',
    'Do zrobienia': 'background:var(--amber-bg);color:var(--amber)',
    'W toku': 'background:var(--amber-bg);color:var(--amber)',
    'Opublikowane': 'background:var(--green-bg);color:var(--green)',
    'Odrzucone': 'background:var(--red-bg);color:var(--red)',
    'Powrót z archiwum': 'background:var(--purple-bg);color:var(--purple)',
  }
  return map[s] || ''
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => toast('Skopiowano! ✓'))
    .catch(() => { toast('Skopiowano! ✓') })
}

function refLinksRow(targetId, context) {
  const refs = Object.values(refLinks)
  if (!refs.length) return ''
  const chips = refs.map(r =>
    `<span class="ref-chip-row" title="${r.url}">
      <span class="ref-chip-name">${r.name}</span>
      <button class="ref-chip-copy" onclick="copyToClipboard('${r.url.replace(/'/g,"\\'")}')">Kopiuj</button>
    </span>`
  ).join('')
  return `<div class="ref-links-row">
    <span style="font-size:11px;color:var(--text3)">Linki ref:</span>
    ${chips}
  </div>`
}

function refSelectOptions() {
  const refs = Object.values(refLinks)
  return `<option value="">— brak —</option>` +
    refs.map(r => `<option value="${r.url}">${r.name}</option>`).join('')
}

// ── GOOGLE SHEETS SYNC ────────────────────────────────────────────
async function syncFromSheets() {
  document.getElementById('sync-info').textContent = 'synchronizacja...'
  try {
    const range = encodeURIComponent(`${SHEET_TAB}!A2:H`)
    const url   = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`
    const res   = await fetch(url)
    if (!res.ok) throw new Error(`Sheets HTTP ${res.status}`)
    const data  = await res.json()
    const rows  = data.values || []

    let newCount = 0
    for (const row of rows) {
      const id = row[COL.id]?.trim()
      if (!id) continue
      if (posts[id]) continue                   // już w Firebase – pomijamy

      const post = {
        id,
        account:  row[COL.account] || '',
        xDate:    row[COL.date]    || '',
        xLink:    row[COL.link]    || '',
        text:     row[COL.text]    || '',
        links:    row[COL.links]   ? row[COL.links].split('\n').filter(Boolean) : [],
        img:      row[COL.img]     || '',
        para:     '',
        status:   'Nowy',
        addedAt:  now(),
      }
      await setDoc(doc(db, 'posts', id), post)
      posts[id] = post
      newCount++
    }

    document.getElementById('sync-info').textContent =
      `ostatnia sync: ${new Date().toLocaleTimeString('pl-PL')}${newCount ? ` (+${newCount} nowych)` : ''}`
    if (newCount) { toast(`Dodano ${newCount} nowych wpisów 🔔`); renderMain(); updateStats(); updateBadges() }
    else document.getElementById('sync-info').textContent =
      `ostatnia sync: ${new Date().toLocaleTimeString('pl-PL')} — brak nowych`
  } catch (e) {
    console.error(e)
    document.getElementById('sync-info').textContent = `błąd synchronizacji: ${e.message}`
    toast(`Błąd sync: ${e.message}`)
  }
}

// ── FIREBASE LOAD ─────────────────────────────────────────────────
async function loadFromFirebase() {
  const [postsSnap, mySnap, refSnap, notesSnap] = await Promise.all([
    getDocs(query(collection(db, 'posts'),    orderBy('xDate',    'desc'))),
    getDocs(query(collection(db, 'myPosts'),  orderBy('created',  'desc'))),
    getDocs(collection(db, 'refLinks')),
    getDocs(query(collection(db, 'notes'),    orderBy('created',  'desc'))),
  ])
  posts    = {}; myPosts = {}; refLinks = {}; notes = {}
  postsSnap.forEach  (d => { posts[d.id]    = d.data() })
  mySnap.forEach     (d => { myPosts[d.id]  = d.data() })
  refSnap.forEach    (d => { refLinks[d.id] = d.data() })
  notesSnap.forEach  (d => { notes[d.id]    = d.data() })
}

// ── TAB SWITCH ────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelector(`.tab[data-tab="${name}"]`).classList.add('active')
  document.getElementById(`page-${name}`).classList.add('active')
  const renders = { main: renderMain, moje: renderMoje, archiwum: renderArchive, notatki: renderNotes, ref: renderRef }
  if (renders[name]) renders[name]()
}

// ── RENDER: MAIN ──────────────────────────────────────────────────
function renderMain() {
  let list = Object.values(posts).filter(p => {
    if (p.status === 'Odrzucone' || p.status === 'Opublikowane') return false
    if (filterAccount && p.account !== filterAccount) return false
    if (filterStatus  && p.status  !== filterStatus)  return false
    if (filterSearch  && !p.text.toLowerCase().includes(filterSearch)) return false
    return true
  }).sort((a, b) => b.xDate.localeCompare(a.xDate))

  // Update account filter
  const accounts = [...new Set(Object.values(posts).map(p => p.account))].sort()
  const sel = document.getElementById('f-account')
  const cur = sel.value
  sel.innerHTML = '<option value="">Wszystkie konta</option>' +
    accounts.map(a => `<option${a === cur ? ' selected' : ''}>${a}</option>`).join('')
  sel.value = cur

  const el = document.getElementById('main-cards')
  if (!list.length) { el.innerHTML = '<div class="empty">Brak wpisów pasujących do filtrów.</div>'; return }

  el.innerHTML = list.map(p => {
    const linksH = p.links?.length
      ? `<div class="card-links"><span style="font-size:11px;color:var(--text3)">Linki:</span>
         ${p.links.map(l => `<a class="lchip" href="${l}" target="_blank" title="${l}">${l.replace('https://','').replace('http://','')}</a>`).join('')}
         </div>`
      : ''
    const imgH = p.img
      ? `<div class="card-links"><span style="font-size:11px;color:var(--text3)">Zdjęcie:</span>
         <a class="lchip" href="${p.img}" target="_blank">otwórz zdjęcie</a></div>`
      : ''

    return `<div class="card${p.status === 'Odrzucone' ? ' rejected' : ''}" id="card-${p.id}">
      <div class="card-head">
        <span class="account">@${p.account}</span>
        <a class="xlink" href="${p.xLink || '#'}" target="_blank">Otwórz na X ↗</a>
        <span class="post-date">📅 ${p.xDate}</span>
        <select class="status-sel" style="${statusStyle(p.status)}"
          onchange="setPostStatus('${p.id}', this.value)">
          ${['Nowy','Do zrobienia','W toku','Opublikowane','Odrzucone']
            .map(s => `<option${s === p.status ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      ${linksH}${imgH}
      ${refLinksRow(p.id, 'main')}
      <div class="card-body">
        <div class="col-orig">
          <div class="col-label">Oryginał</div>
          <div class="orig-text" id="orig-${p.id}">${p.text}</div>
        </div>
        <div class="col-para">
          <div class="col-label">Twoja parafraza</div>
          <textarea class="para-area" id="para-${p.id}"
            placeholder="Wklej tutaj swoją parafrazę..."
            onblur="savePara('${p.id}', this.value)">${p.para || ''}</textarea>
        </div>
      </div>
      <div class="card-foot">
        <button class="btn" id="btn-exp-${p.id}" onclick="toggleExpand('${p.id}')">Rozwiń</button>
        <button class="btn" onclick="copyToClipboard(document.getElementById('orig-${p.id}').innerText)">Kopiuj oryginał</button>
        <button class="btn btn-info" onclick="copyToClipboard(document.getElementById('para-${p.id}').value)">Kopiuj parafrazę</button>
        <button class="btn btn-danger ml-auto" onclick="setPostStatus('${p.id}','Odrzucone')">Odrzuć</button>
      </div>
    </div>`
  }).join('')
}

// ── POST ACTIONS ──────────────────────────────────────────────────
async function setPostStatus(id, status) {
  if (!posts[id]) return
  posts[id].status = status
  if (status === 'Opublikowane') {
    posts[id].archivedAt = now()
    await updateDoc(doc(db, 'posts', id), { status, archivedAt: posts[id].archivedAt })
    toast('Przeniesiono do Archiwum ✓')
  } else {
    await updateDoc(doc(db, 'posts', id), { status })
  }
  renderMain(); updateStats(); updateBadges()
}

async function savePara(id, value) {
  if (!posts[id] || posts[id].para === value) return
  posts[id].para = value
  await updateDoc(doc(db, 'posts', id), { para: value })
}

function toggleExpand(id) {
  const orig = document.getElementById('orig-' + id)
  const para = document.getElementById('para-' + id)
  const btn  = document.getElementById('btn-exp-' + id)
  const expanded = orig.classList.contains('expanded')
  orig.classList.toggle('expanded')
  para.classList.toggle('expanded')
  btn.textContent = expanded ? 'Rozwiń' : 'Zwiń'
}

// ── STATS & BADGES ────────────────────────────────────────────────
function updateStats() {
  const active = Object.values(posts).filter(p => p.status !== 'Odrzucone' && p.status !== 'Opublikowane')
  document.getElementById('s-all').textContent  = active.length
  document.getElementById('s-new').textContent  = Object.values(posts).filter(p => p.status === 'Nowy').length
  document.getElementById('s-todo').textContent = Object.values(posts).filter(p => p.status === 'Do zrobienia' || p.status === 'W toku').length
  document.getElementById('s-done').textContent = Object.values(posts).filter(p => p.status === 'Opublikowane').length
}

function updateBadges() {
  const mainCount = Object.values(posts).filter(p => p.status !== 'Odrzucone' && p.status !== 'Opublikowane').length
  const archCount = Object.values(posts).filter(p => p.status === 'Opublikowane').length
  document.getElementById('tab-main-badge').textContent   = mainCount
  document.getElementById('tab-moje-badge').textContent   = Object.keys(myPosts).length
  document.getElementById('tab-arch-badge').textContent   = archCount
  document.getElementById('tab-notes-badge').textContent  = Object.keys(notes).length
  document.getElementById('tab-ref-badge').textContent    = Object.keys(refLinks).length
}

// ── RENDER: MY POSTS ──────────────────────────────────────────────
function renderMoje() {
  const refOpts = refSelectOptions()
  const el = document.getElementById('moje-cards')
  const list = Object.values(myPosts).sort((a, b) => b.created.localeCompare(a.created))

  if (!list.length) { el.innerHTML = '<div class="empty">Brak własnych wpisów. Dodaj pierwszy powyżej.</div>'; return }

  el.innerHTML = list.map(p => {
    const editing = p._editing
    return `<div class="mypost-card" id="mycard-${p.id}">
      <div class="mypost-head">
        <span style="font-size:12px;font-weight:600;color:var(--text2)">Mój wpis</span>
        ${p.tags ? `<span style="font-size:11px;color:var(--blue)">${p.tags}</span>` : ''}
        ${statusBadge(p.status)}
        ${p.refLink ? `<a class="xlink" href="${p.refLink}" target="_blank" style="font-size:10px">Link ref ↗</a>` : ''}
      </div>
      <div class="mypost-body">
        ${editing ? `
          <div class="edit-form">
            <div class="edit-row full"><div>
              <div class="form-label">Treść wpisu</div>
              <textarea class="mypost-edit-area" id="edit-text-${p.id}">${p.text}</textarea>
              <div class="char-count" id="edit-count-${p.id}">${p.text.length}/280</div>
            </div></div>
            <div class="edit-row">
              <div><div class="form-label">Planowana data publikacji</div>
                <input class="form-input" type="datetime-local" id="edit-planned-${p.id}"
                  value="${p.planned ? p.planned.replace(' ','T') : ''}"></div>
              <div><div class="form-label">Temat / hashtagi</div>
                <input class="form-input" id="edit-tags-${p.id}" value="${p.tags || ''}"></div>
            </div>
            <div class="edit-row">
              <div><div class="form-label">Notatka</div>
                <input class="form-input" id="edit-note-${p.id}" value="${p.note || ''}"></div>
              <div><div class="form-label">Link referencyjny</div>
                <select class="form-select" id="edit-ref-${p.id}">${refOpts}</select></div>
            </div>
            <div style="display:flex;gap:6px;margin-top:4px">
              <button class="btn btn-primary" onclick="saveMyPostEdit('${p.id}')">Zapisz</button>
              <button class="btn" onclick="cancelMyPostEdit('${p.id}')">Anuluj</button>
            </div>
          </div>
        ` : `
          <div class="mypost-text">${p.text || '(brak treści)'}</div>
          <div class="mypost-meta">
            <span class="meta-item">Utworzono: ${p.created}</span>
            ${p.planned ? `<span class="meta-item">Planowana: ${p.planned}</span>` : ''}
            ${p.published ? `<span class="meta-item green">Opublikowano: ${p.published}</span>` : ''}
            ${p.note ? `<span class="meta-item">📝 ${p.note}</span>` : ''}
          </div>
        `}
      </div>
      ${!editing ? `
      <div class="mypost-foot">
        <button class="btn" onclick="copyToClipboard(\`${p.text.replace(/`/g, "'")}\`)">Kopiuj wpis</button>
        <button class="btn" onclick="startMyPostEdit('${p.id}')">Edytuj</button>
        ${p.status !== 'Opublikowane'
          ? `<button class="btn btn-success" onclick="publishMyPost('${p.id}')">Oznacz opublikowany</button>` : ''}
        <button class="btn btn-danger ml-auto" onclick="deleteMyPost('${p.id}')">Usuń</button>
      </div>` : ''}
    </div>`
  }).join('')

  // Attach char counter for edit areas
  list.forEach(p => {
    if (p._editing) {
      const ta = document.getElementById(`edit-text-${p.id}`)
      const ct = document.getElementById(`edit-count-${p.id}`)
      if (ta && ct) ta.addEventListener('input', () => { ct.textContent = ta.value.length + '/280' })
    }
  })
}

function startMyPostEdit(id) {
  if (myPosts[id]) { myPosts[id]._editing = true; renderMoje() }
}

function cancelMyPostEdit(id) {
  if (myPosts[id]) { myPosts[id]._editing = false; renderMoje() }
}

async function saveMyPostEdit(id) {
  const p = myPosts[id]; if (!p) return
  const text    = document.getElementById(`edit-text-${id}`)?.value.trim() || ''
  const planned = (document.getElementById(`edit-planned-${id}`)?.value || '').replace('T', ' ')
  const tags    = document.getElementById(`edit-tags-${id}`)?.value.trim() || ''
  const note    = document.getElementById(`edit-note-${id}`)?.value.trim() || ''
  const refLink = document.getElementById(`edit-ref-${id}`)?.value || ''
  Object.assign(p, { text, planned, tags, note, refLink, _editing: false })
  const toSave = { ...p }; delete toSave._editing
  await setDoc(doc(db, 'myPosts', id), toSave)
  toast('Wpis zaktualizowany ✓'); renderMoje()
}

async function addMyPost() {
  const text = document.getElementById('np-text').value.trim()
  if (!text) { toast('Wpisz treść wpisu!'); return }
  const id = uid()
  const post = {
    id, text,
    created:  document.getElementById('np-created').value.replace('T', ' ') || now(),
    planned:  (document.getElementById('np-planned').value || '').replace('T', ' '),
    published: '',
    tags:     document.getElementById('np-tags').value.trim(),
    note:     document.getElementById('np-note').value.trim(),
    refLink:  document.getElementById('np-reflink').value || '',
    status:   'Szkic',
  }
  await setDoc(doc(db, 'myPosts', id), post)
  myPosts[id] = post
  clearMyPostForm(); renderMoje(); updateBadges(); toast('Wpis dodany ✓')
}

function clearMyPostForm() {
  ;['np-text','np-tags','np-note'].forEach(i => { const el = document.getElementById(i); if (el) el.value = '' })
  ;['np-planned'].forEach(i => { const el = document.getElementById(i); if (el) el.value = '' })
  const cnt = document.getElementById('np-count'); if (cnt) cnt.textContent = '0/280'
  const rl = document.getElementById('np-reflink'); if (rl) rl.value = ''
  const d = new Date(); const inp = document.getElementById('np-created')
  if (inp) inp.value = d.toISOString().slice(0, 16)
}

async function publishMyPost(id) {
  const p = myPosts[id]; if (!p) return
  p.status = 'Opublikowane'; p.published = now()
  await updateDoc(doc(db, 'myPosts', id), { status: p.status, published: p.published })
  toast('Oznaczono jako opublikowany ✓'); renderMoje()
}

async function deleteMyPost(id) {
  if (!confirm('Usunąć ten wpis?')) return
  await deleteDoc(doc(db, 'myPosts', id))
  delete myPosts[id]; renderMoje(); updateBadges(); toast('Usunięto ✓')
}

// ── RENDER: ARCHIVE ───────────────────────────────────────────────
function renderArchive() {
  const list = Object.values(posts)
    .filter(p => p.status === 'Opublikowane')
    .sort((a, b) => (b.archivedAt || '').localeCompare(a.archivedAt || ''))
  const el = document.getElementById('arch-cards')
  if (!list.length) { el.innerHTML = '<div class="empty">Brak wpisów w archiwum.</div>'; return }
  el.innerHTML = list.map(p => `
    <div class="arch-card">
      <div class="arch-head">
        <span class="account">@${p.account}</span>
        <a class="xlink" href="${p.xLink || '#'}" target="_blank">Otwórz na X ↗</a>
        <span class="post-date">📅 ${p.xDate}</span>
        <span style="font-size:11px;color:var(--text3);margin-left:auto">arch. ${p.archivedAt || ''}</span>
      </div>
      <div class="arch-body">
        <div class="arch-text">${p.text}</div>
        ${p.para ? `<div style="font-size:11px;color:var(--text3);margin-top:8px;margin-bottom:4px">Parafraza:</div>
          <div class="arch-para">${p.para}</div>` : ''}
      </div>
      <div class="arch-foot">
        <span style="font-size:12px;color:var(--text2)">Przywróć jako:</span>
        <select id="restore-${p.id}" style="font-size:12px;padding:4px 8px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text)">
          <option>Nowy</option><option>Do zrobienia</option><option>W toku</option><option>Powrót z archiwum</option>
        </select>
        <button class="btn btn-info" onclick="restorePost('${p.id}')">Przywróć</button>
      </div>
    </div>`).join('')
}

async function restorePost(id) {
  const p = posts[id]; if (!p) return
  const sel = document.getElementById(`restore-${id}`)
  const status = sel ? sel.value : 'Nowy'
  p.status = status; delete p.archivedAt
  await updateDoc(doc(db, 'posts', id), { status, archivedAt: null })
  toast('Wpis przywrócony ✓'); renderArchive(); updateStats(); updateBadges()
}

// ── RENDER: NOTES ─────────────────────────────────────────────────
function renderNotes() {
  const list = Object.values(notes).sort((a, b) => b.created.localeCompare(a.created))
  const el = document.getElementById('notes-cards')
  if (!list.length) { el.innerHTML = '<div class="empty">Brak notatek. Dodaj pierwszą powyżej.</div>'; return }
  el.innerHTML = list.map(n => `
    <div class="note-card">
      <div class="note-head">
        <span class="note-date">📝 ${n.created}</span>
        <button class="btn btn-danger" style="font-size:11px;padding:2px 8px" onclick="deleteNote('${n.id}')">Usuń</button>
      </div>
      <div class="note-text">${n.text}</div>
    </div>`).join('')
}

async function addNote() {
  const text = document.getElementById('new-note').value.trim()
  if (!text) { toast('Wpisz treść notatki!'); return }
  const id = uid()
  const note = { id, text, created: now() }
  await setDoc(doc(db, 'notes', id), note)
  notes[id] = note
  document.getElementById('new-note').value = ''
  renderNotes(); updateBadges(); toast('Notatka zapisana ✓')
}

async function deleteNote(id) {
  await deleteDoc(doc(db, 'notes', id))
  delete notes[id]; renderNotes(); updateBadges(); toast('Notatka usunięta ✓')
}

// ── RENDER: REF LINKS ─────────────────────────────────────────────
function renderRef() {
  const list = Object.values(refLinks).sort((a, b) => a.name.localeCompare(b.name))
  const el   = document.getElementById('ref-cards')

  if (!list.length) {
    el.innerHTML = '<div class="empty">Brak linków referencyjnych. Dodaj pierwszy powyżej.</div>'; return
  }
  el.innerHTML = list.map(r => {
    const editing = r._editing
    return `<div class="ref-card" id="refcard-${r.id}">
      ${editing ? `
        <div class="edit-form">
          <div><div class="form-label">Nazwa projektu</div>
            <input class="form-input" id="re-name-${r.id}" value="${r.name}"></div>
          <div><div class="form-label">Link referencyjny (URL)</div>
            <input class="form-input" id="re-url-${r.id}" value="${r.url}" placeholder="https://..."></div>
          <div style="display:flex;gap:6px;margin-top:4px">
            <button class="btn btn-primary" onclick="saveRefEdit('${r.id}')">Zapisz</button>
            <button class="btn" onclick="cancelRefEdit('${r.id}')">Anuluj</button>
          </div>
        </div>
      ` : `
        <div class="ref-card-head">
          <div style="flex:1">
            <div class="ref-project">${r.name}</div>
            <div class="ref-link-text">${r.url}</div>
          </div>
        </div>
        <div class="ref-actions">
          <button class="btn btn-info" onclick="copyToClipboard('${r.url.replace(/'/g,"\\'")}')">Kopiuj link</button>
          <button class="btn" onclick="startRefEdit('${r.id}')">Edytuj</button>
          <button class="btn btn-danger" onclick="deleteRef('${r.id}')">Usuń</button>
        </div>
      `}
    </div>`
  }).join('')
}

async function addRef() {
  const name = document.getElementById('ref-name').value.trim()
  const url  = document.getElementById('ref-url').value.trim()
  if (!name || !url) { toast('Wypełnij nazwę i link!'); return }
  if (!url.startsWith('http')) { toast('Link musi zaczynać się od https://'); return }
  const id = uid()
  const ref = { id, name, url, addedAt: now() }
  await setDoc(doc(db, 'refLinks', id), ref)
  refLinks[id] = ref
  document.getElementById('ref-name').value = ''
  document.getElementById('ref-url').value  = ''
  renderRef(); updateBadges()
  // refresh ref selects in other pages
  refreshRefSelects()
  toast('Link dodany ✓')
}

function startRefEdit(id)  { if (refLinks[id]) { refLinks[id]._editing = true;  renderRef() } }
function cancelRefEdit(id) { if (refLinks[id]) { refLinks[id]._editing = false; renderRef() } }

async function saveRefEdit(id) {
  const r    = refLinks[id]; if (!r) return
  const name = document.getElementById(`re-name-${id}`)?.value.trim() || ''
  const url  = document.getElementById(`re-url-${id}`)?.value.trim()  || ''
  if (!name || !url) { toast('Wypełnij oba pola!'); return }
  Object.assign(r, { name, url, _editing: false })
  const toSave = { ...r }; delete toSave._editing
  await setDoc(doc(db, 'refLinks', id), toSave)
  toast('Link zaktualizowany ✓'); renderRef(); refreshRefSelects()
}

async function deleteRef(id) {
  if (!confirm('Usunąć ten link?')) return
  await deleteDoc(doc(db, 'refLinks', id))
  delete refLinks[id]; renderRef(); updateBadges(); refreshRefSelects(); toast('Usunięto ✓')
}

function refreshRefSelects() {
  const opts = refSelectOptions()
  ;['np-reflink', 'moje-reflink'].forEach(selId => {
    const el = document.getElementById(selId)
    if (el) { const v = el.value; el.innerHTML = opts; el.value = v }
  })
  // Also re-render main to update ref chips
  if (document.getElementById('page-main').classList.contains('active')) renderMain()
  if (document.getElementById('page-moje').classList.contains('active')) renderMoje()
}

// ── BUILD HTML ────────────────────────────────────────────────────
function buildApp() {
  const d = new Date()
  const defaultNow = d.toISOString().slice(0, 16)

  document.getElementById('app').innerHTML = `
  <div id="toast" class="toast"></div>

  <div class="topbar">
    <h1>𝕏 XPost Manager</h1>
    <span class="sync-info" id="sync-info">ładowanie...</span>
    <button class="btn-sync" onclick="syncFromSheets()">Synchronizuj</button>
  </div>

  <div class="tabs">
    <button class="tab active" data-tab="main" onclick="switchTab('main')">
      Wpisy <span class="tab-badge" id="tab-main-badge">0</span>
    </button>
    <button class="tab" data-tab="moje" onclick="switchTab('moje')">
      Moje wpisy <span class="tab-badge" id="tab-moje-badge">0</span>
    </button>
    <button class="tab" data-tab="archiwum" onclick="switchTab('archiwum')">
      Archiwum <span class="tab-badge" id="tab-arch-badge">0</span>
    </button>
    <button class="tab" data-tab="notatki" onclick="switchTab('notatki')">
      Notatki <span class="tab-badge" id="tab-notes-badge">0</span>
    </button>
    <button class="tab" data-tab="ref" onclick="switchTab('ref')">
      Linki ref <span class="tab-badge" id="tab-ref-badge">0</span>
    </button>
  </div>

  <!-- ── WPISY ── -->
  <div id="page-main" class="page active">
    <div class="stats">
      <div class="stat"><div class="stat-n" id="s-all" style="color:var(--text)">0</div><div class="stat-l">Wszystkich</div></div>
      <div class="stat"><div class="stat-n" id="s-new" style="color:var(--blue)">0</div><div class="stat-l">Nowych</div></div>
      <div class="stat"><div class="stat-n" id="s-todo" style="color:var(--amber)">0</div><div class="stat-l">W toku</div></div>
      <div class="stat"><div class="stat-n" id="s-done" style="color:var(--green)">0</div><div class="stat-l">Opublikowanych</div></div>
    </div>
    <div class="filters">
      <select id="f-account" onchange="filterAccount=this.value;renderMain()">
        <option value="">Wszystkie konta</option>
      </select>
      <select id="f-status" onchange="filterStatus=this.value;renderMain()">
        <option value="">Wszystkie statusy</option>
        <option>Nowy</option><option>Do zrobienia</option><option>W toku</option>
      </select>
      <input id="f-search" placeholder="Szukaj w treści..."
        oninput="filterSearch=this.value.toLowerCase();renderMain()"
        style="flex:1;min-width:140px">
    </div>
    <div id="main-cards"><div class="loading">Ładowanie wpisów...</div></div>
  </div>

  <!-- ── MOJE WPISY ── -->
  <div id="page-moje" class="page">
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
        <div>
          <div class="form-label">Data utworzenia</div>
          <input class="form-input" type="datetime-local" id="np-created" value="${defaultNow}">
        </div>
        <div>
          <div class="form-label">Planowana data publikacji</div>
          <input class="form-input" type="datetime-local" id="np-planned">
        </div>
      </div>
      <div class="form-row">
        <div>
          <div class="form-label">Temat / hashtagi</div>
          <input class="form-input" id="np-tags" placeholder="#crypto #airdrop">
        </div>
        <div>
          <div class="form-label">Notatka do wpisu</div>
          <input class="form-input" id="np-note" placeholder="np. źródło, pomysł...">
        </div>
      </div>
      <div class="form-row full">
        <div>
          <div class="form-label">Link referencyjny</div>
          <select class="form-select" id="np-reflink">${refSelectOptions()}</select>
        </div>
      </div>
      <div class="form-btns">
        <button class="btn btn-primary" onclick="addMyPost()">Dodaj wpis</button>
        <button class="btn" onclick="clearMyPostForm()">Wyczyść</button>
      </div>
    </div>
    <div id="moje-cards"></div>
  </div>

  <!-- ── ARCHIWUM ── -->
  <div id="page-archiwum" class="page">
    <div style="font-size:13px;color:var(--text2);margin-bottom:12px">
      Opublikowane wpisy. Możesz przywrócić każdy z powrotem do głównej zakładki.
    </div>
    <div id="arch-cards"></div>
  </div>

  <!-- ── NOTATKI ── -->
  <div id="page-notatki" class="page">
    <div class="form-card">
      <div class="form-title">Nowa notatka</div>
      <textarea class="note-input" id="new-note" placeholder="Zapisz coś — pomysł, przypomnienie, link..."></textarea>
      <div style="margin-top:8px">
        <button class="btn btn-primary" onclick="addNote()">Zapisz notatkę</button>
      </div>
    </div>
    <div id="notes-cards"></div>
  </div>

  <!-- ── LINKI REF ── -->
  <div id="page-ref" class="page">
    <div class="form-card">
      <div class="form-title">Dodaj link referencyjny</div>
      <div class="form-row">
        <div>
          <div class="form-label">Nazwa projektu</div>
          <input class="form-input" id="ref-name" placeholder="np. Walrus Airdrop">
        </div>
        <div>
          <div class="form-label">Link (URL)</div>
          <input class="form-input" id="ref-url" placeholder="https://claim.walrus.xyz/ref/abc123">
        </div>
      </div>
      <div class="form-btns">
        <button class="btn btn-primary" onclick="addRef()">Dodaj link</button>
      </div>
    </div>
    <div style="font-size:13px;color:var(--text2);margin-bottom:10px">
      Linki referencyjne są dostępne w zakładkach Wpisy i Moje wpisy — kliknij "Kopiuj" przy wybranym projekcie.
    </div>
    <div id="ref-cards"></div>
  </div>
  `
}

// ── EXPOSE TO HTML ────────────────────────────────────────────────
window.switchTab       = switchTab
window.syncFromSheets  = syncFromSheets
window.setPostStatus   = setPostStatus
window.savePara        = savePara
window.toggleExpand    = toggleExpand
window.copyToClipboard = copyToClipboard
window.addMyPost       = addMyPost
window.clearMyPostForm = clearMyPostForm
window.publishMyPost   = publishMyPost
window.deleteMyPost    = deleteMyPost
window.startMyPostEdit = startMyPostEdit
window.cancelMyPostEdit= cancelMyPostEdit
window.saveMyPostEdit  = saveMyPostEdit
window.restorePost     = restorePost
window.addNote         = addNote
window.deleteNote      = deleteNote
window.addRef          = addRef
window.startRefEdit    = startRefEdit
window.cancelRefEdit   = cancelRefEdit
window.saveRefEdit     = saveRefEdit
window.deleteRef       = deleteRef

// ── INIT ──────────────────────────────────────────────────────────
async function init() {
  buildApp()
  await loadFromFirebase()
  renderMain(); renderMoje(); renderNotes(); renderRef()
  updateStats(); updateBadges()
  refreshRefSelects()

  // Auto-sync co 5 minut
  await syncFromSheets()
  setInterval(syncFromSheets, 5 * 60 * 1000)
}

init()
