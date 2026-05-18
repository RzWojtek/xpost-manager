import './style.css'
import { db, auth, googleProvider } from './firebase.js'
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, orderBy, where, onSnapshot
} from 'firebase/firestore'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'

// ── CONFIG ────────────────────────────────────────────────────────
const SHEET_ID  = import.meta.env.VITE_SHEET_ID
const SHEET_TAB = import.meta.env.VITE_SHEET_TAB || 'Arkusz1'
const API_KEY   = import.meta.env.VITE_SHEETS_API_KEY
// Kolumny Sheets (0-indexed): A=data B=konto C=tekst D=link E=linki F=id G=done H=zdjecia
const COL = { date:0, account:1, text:2, link:3, links:4, id:5, img:7, type:8 }

// ── AI PARAFRAZA — SYSTEM ROTACJI MODELI ─────────────────────────
const AI_MODELS = [
  {
    id: 'groq_llama33',
    name: 'Groq llama-3.3-70b',
    type: 'openai',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    envKey: 'VITE_GROQ_API_KEY',
    resetMs: 62 * 1000,
  },
  {
    id: 'gemini_flash',
    name: 'Gemini 2.0 Flash',
    type: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    envKey: 'VITE_GEMINI_API_KEY',
    resetMs: 62 * 1000,
  },
  {
    id: 'cerebras_llama',
    name: 'Cerebras llama3.1-8b',
    type: 'openai',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'llama3.1-8b',
    envKey: 'VITE_CEREBRAS_API_KEY',
    resetMs: 60 * 60 * 1000,
  },
  {
    id: 'sambanova_llama',
    name: 'SambaNova Llama-3.1-70B',
    type: 'openai',
    url: 'https://api.sambanova.ai/v1/chat/completions',
    model: 'Meta-Llama-3.1-70B-Instruct',
    envKey: 'VITE_SAMBANOVA_API_KEY',
    resetMs: 60 * 60 * 1000,
  },
  {
    id: 'openrouter_deepseek',
    name: 'OpenRouter DeepSeek-R1',
    type: 'openai',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'deepseek/deepseek-r1:free',
    envKey: 'VITE_OPENROUTER_API_KEY',
    resetMs: 60 * 60 * 1000,
  },
  {
    id: 'openrouter_llama33',
    name: 'OpenRouter Llama-3.3-70b',
    type: 'openai',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    envKey: 'VITE_OPENROUTER_API_KEY',
    resetMs: 60 * 60 * 1000,
  },
  {
    id: 'groq_mixtral',
    name: 'Groq mixtral-8x7b',
    type: 'openai',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'mixtral-8x7b-32768',
    envKey: 'VITE_GROQ_API_KEY',
    resetMs: 62 * 1000,
  }
]

const PARA_PROMPT = `THE WORLD-CLASS X POST PARAPHRASER & THREAD GENERATOR

ROLE & MISSION
You are an elite ghostwriter specializing in X (Twitter) content. Your sole mission: transform raw source material into the most engaging, shareable posts on the platform — without adding anything beyond what the source contains. You rewrite; you do not create.

INPUT HANDLING

Image provided → Extract all text via OCR. Use only that content.
Text provided → Use the full text as your only source.
No embellishment — your job is to distill and reframe, not to invent.


ABSOLUTE RULES
① Paraphrase Completely
Rewrite every sentence with fresh structure, rhythm, and vocabulary. Zero verbatim copying. However: if it's not in the source, it's not in your output.
② No Added Content — Ever
No opinions. No analysis. No predictions. No praise. No context the source didn't provide. If you're tempted to add something "helpful," don't.
③ Preserve Critical References Exactly
Never alter: @usernames, project names, token tickers ($BTC, $ETH), URLs, dates, numbers, percentages, contract addresses, technical specs.
④ Cover Everything That Matters
Every significant fact from the source must appear. Don't pad — but don't cut important details either.

HOOK — THE MOST IMPORTANT ELEMENT
The opening must be a scroll-stopper. It should:

Create immediate curiosity or deliver an instant high-value signal
Be punchy: 1–2 lines max
Never start with "I", "We", or the project name
Use power patterns: bold contrast, surprising number, provocative question, or a setup that demands a payoff

Examples of strong hooks:

🚨 Everything changes today.
💥 The number is $2.4B. Here's why it matters.
❗Nobody's talking about this yet.


POST LENGTH & SPLITTING

Default: write as one single long post. The user has X Pro, so the 25,000-character limit applies — do NOT split unless explicitly instructed.
If splitting is requested: Write a continuous thread with natural flow between posts. No part numbers like "1/10".


EMOJI USAGE
Use emojis to guide the reader's eye — not to decorate.
Tone & frequency:

Maximum 1 emoji per paragraph or section — never stack multiple in a row
When in doubt — leave it out

Placement:

At the start of a line to open a new point, section, or key fact
Never mid-sentence or purely for decoration

Selection:
Choose the emoji that best fits the moment. Suggested reference set (use freely, replace with better alternatives when appropriate):
📌 ❗ 🔹 🔗 🧵 💥 ✅ ➖ ‼️ 📍 🚨 🔥 ✔ 💡 ➠ 🌟 👉 ➡️
Usage logic:

🚨 ‼️ ❗ 💥 → only for genuinely critical or breaking information
🔹 ➖ ➡️ ➠ 👉 → lists, transitions, flow
✅ ✔ 💡 🌟 → confirmed facts, key takeaways, insights
📌 📍 🔗 → references, links, anchoring information


STYLE DNA

Tone: Sharp. Confident. Zero fluff.
Sentence rhythm: Vary deliberately — short punches, then longer context, then short punches again.
Reading level: Clear enough for a newcomer, precise enough for an expert.
Language: English only.
Never use: "In conclusion", "It's worth noting", "This is huge", "game-changer" (unless source uses it), "LFG", or generic hype not present in the source.


STRUCTURE & FORMAT
Spacing: Separate every distinct section, thought, or paragraph with a blank line. Never run different ideas together into one block. The post must breathe visually — blank lines between hook, context, steps, takeaway, and hashtags.
Lists: Use 🔹 or ➖ or ➡️ as clean markers for scannable bullet points. Each list item on its own line.
Links: Always place 🔗 directly before any URL. Never leave a URL bare without this emoji.
Closing: End with the single sharpest takeaway from the source on its own line, followed by a blank line. No calls to action unless explicitly present in the source.
Hashtags: On a separate line after a blank line. Add 1–2 at the very end only. Use hashtags mentioned in the source first; supplement with 1 relevant topic hashtag if needed.

QUALITY CHECKLIST (self-verify before output)

 Hook would stop a scroll?
 Every fact from the source is present?
 Zero sentences copied verbatim?
 Nothing added that wasn't in the source?
 All tickers, names, URLs intact?
 Emojis only from the approved set, max 1 per section, placed correctly?
 Entire output is one post (unless splitting was requested)?


EXECUTE NOW.
Paste your source material below and the post will be generated immediately.

Source text to paraphrase:`

// Stan wyczerpania modeli — tylko w pamięci (resetuje się po odświeżeniu strony)
const _modelExhausted = {}
const _resetCheckers  = {}

function markModelExhausted(model) {
  _modelExhausted[model.id] = Date.now()
  // Sprawdzaj co resetMs czy limit się odnowił
  if (_resetCheckers[model.id]) return
  _resetCheckers[model.id] = setInterval(() => {
    const t = _modelExhausted[model.id]
    if (!t || Date.now() - t > model.resetMs) {
      delete _modelExhausted[model.id]
      clearInterval(_resetCheckers[model.id])
      delete _resetCheckers[model.id]
      console.log(`[AI Para] ${model.name} — limit odnowiony ✅`)
    }
  }, Math.min(model.resetMs, 30000))
}

function isModelAvailable(model) {
  if (!import.meta.env[model.envKey]) return false // brak klucza
  const t = _modelExhausted[model.id]
  if (!t) return true
  if (Date.now() - t > model.resetMs) {
    delete _modelExhausted[model.id]
    return true
  }
  return false
}

function getBestAvailableModel() {
  return AI_MODELS.find(m => isModelAvailable(m)) || null
}

// ── GROQ USAGE COUNTER (localStorage) ───────────────────────────
// Limity Groq free tier:
const GROQ_LIMITS = {
  rpm: 30,        // zapytania / minutę
  tpm: 6000,      // tokeny / minutę
  rpd: 1000,      // zapytania / dzień (reset o północy UTC)
}

function _groqStorageKey() { return 'groqUsage_v1' }

function _loadGroqUsage() {
  try {
    const raw = localStorage.getItem(_groqStorageKey())
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function _saveGroqUsage(data) {
  try { localStorage.setItem(_groqStorageKey(), JSON.stringify(data)) } catch {}
}

function _initGroqUsage() {
  const now   = Date.now()
  const dayMs = _msToMidnightUTC()
  return {
    // Okno minutowe — tablica timestampów ostatnich zapytań
    minuteReqs: [],
    // Dzienne — licznik i data resetu
    dayCount:   0,
    dayResetAt: now + dayMs,
    // Tokeny w ostatniej minucie — tablica {ts, tokens}
    minuteToks: [],
    // Ostatnie 429
    last429At:  null,
    retry429At: null,
  }
}

function _msToMidnightUTC() {
  const now = new Date()
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
  ))
  return midnight - now
}

function trackGroqCall(tokensUsed) {
  let d = _loadGroqUsage() || _initGroqUsage()
  const now = Date.now()

  // Reset dzienny jeśli minął czas
  if (now >= d.dayResetAt) {
    d.dayCount  = 0
    d.dayResetAt = now + _msToMidnightUTC()
  }

  // Oczyść stare wpisy z okna 60s
  d.minuteReqs = (d.minuteReqs || []).filter(ts => now - ts < 60000)
  d.minuteToks = (d.minuteToks || []).filter(e => now - e.ts < 60000)

  // Dodaj nowe
  d.minuteReqs.push(now)
  d.minuteToks.push({ ts: now, tokens: tokensUsed || 0 })
  d.dayCount = (d.dayCount || 0) + 1

  _saveGroqUsage(d)

  // Odśwież UI jeśli widoczne
  const el = document.getElementById('api-status-groq')
  if (el) renderGroqStatusCard()
}

function trackGroq429(retryAfterSec) {
  let d = _loadGroqUsage() || _initGroqUsage()
  const now = Date.now()
  d.last429At  = now
  d.retry429At = now + (retryAfterSec ? retryAfterSec * 1000 : 62000)
  _saveGroqUsage(d)
  const el = document.getElementById('api-status-groq')
  if (el) renderGroqStatusCard()
}

function renderGroqStatusCard() {
  const el = document.getElementById('api-status-groq')
  if (!el) return

  const d   = _loadGroqUsage()
  const now = Date.now()

  if (!d) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3)">Brak danych — wykonaj parafrazę lub kliknij "Odśwież"</div>`
    return
  }

  // Oczyść stare okna
  const minuteReqs = (d.minuteReqs || []).filter(ts => now - ts < 60000)
  const minuteToks = (d.minuteToks || []).filter(e  => now - e.ts < 60000)
  const tokThisMin = minuteToks.reduce((s, e) => s + e.tokens, 0)

  const dayReset   = d.dayResetAt > now ? d.dayResetAt : now + _msToMidnightUTC()
  const dayCount   = now >= (d.dayResetAt||0) ? 0 : (d.dayCount || 0)

  // Limity
  const rpmUsed = minuteReqs.length
  const rpmLeft = Math.max(0, GROQ_LIMITS.rpm - rpmUsed)
  const tpmLeft = Math.max(0, GROQ_LIMITS.tpm - tokThisMin)
  const rpdLeft = Math.max(0, GROQ_LIMITS.rpd - dayCount)

  const pctRpm = Math.round(rpmLeft / GROQ_LIMITS.rpm * 100)
  const pctTpm = Math.round(tpmLeft / GROQ_LIMITS.tpm * 100)
  const pctRpd = Math.round(rpdLeft / GROQ_LIMITS.rpd * 100)

  const barColor = pct => pct > 50 ? '#10b981' : pct > 20 ? '#f59e0b' : '#ef4444'

  const countdownStr = ms => {
    if (ms <= 0) return 'Już dostępne'
    const s = Math.ceil(ms / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60), sec = s % 60
    if (m < 60) return `${m}m ${sec}s`
    const h = Math.floor(m / 60), min = m % 60
    return `${h}h ${min}m`
  }

  // Ile sekund do resetu minutowego (od najstarszego zapytania w oknie)
  const oldestReq  = minuteReqs[0] || now
  const rpmResetMs = Math.max(0, 60000 - (now - oldestReq))
  const dayResetMs = Math.max(0, dayReset - now)

  // Alert 429
  const is429     = d.retry429At && now < d.retry429At
  const retry429Ms = is429 ? d.retry429At - now : 0

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${is429 ? `
      <div style="padding:8px 12px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);border-radius:var(--r);display:flex;align-items:center;gap:8px">
        <span style="font-size:16px">🚫</span>
        <div>
          <div style="font-size:12px;font-weight:700;color:#ef4444">Rate limit wyczerpany (429)</div>
          <div style="font-size:11px;color:var(--text3)">Dostępne za: <strong style="color:#f59e0b">${countdownStr(retry429Ms)}</strong></div>
        </div>
      </div>` : ''}

      <!-- RPM -->
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="color:var(--text2);font-weight:600">Zapytania / minuta (RPM)</span>
          <span style="color:var(--text)">${rpmLeft} / ${GROQ_LIMITS.rpm} wolnych</span>
        </div>
        <div style="height:8px;border-radius:4px;background:var(--bg3)">
          <div style="height:8px;border-radius:4px;background:${barColor(pctRpm)};width:${pctRpm}%;transition:width .3s"></div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">
          Użyte: ${rpmUsed} · Reset za: ${rpmUsed > 0 ? countdownStr(rpmResetMs) : '—'}
        </div>
      </div>

      <!-- TPM -->
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="color:var(--text2);font-weight:600">Tokeny / minuta (TPM)</span>
          <span style="color:var(--text)">${tpmLeft.toLocaleString()} / ${GROQ_LIMITS.tpm.toLocaleString()} wolnych</span>
        </div>
        <div style="height:8px;border-radius:4px;background:var(--bg3)">
          <div style="height:8px;border-radius:4px;background:${barColor(pctTpm)};width:${pctTpm}%;transition:width .3s"></div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">
          Użyte: ${tokThisMin.toLocaleString()} · Reset za: ${tokThisMin > 0 ? countdownStr(rpmResetMs) : '—'}
        </div>
      </div>

      <!-- RPD -->
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span style="color:var(--text2);font-weight:600">Zapytania / dzień (RPD)</span>
          <span style="color:var(--text)">${rpdLeft} / ${GROQ_LIMITS.rpd} wolnych</span>
        </div>
        <div style="height:8px;border-radius:4px;background:var(--bg3)">
          <div style="height:8px;border-radius:4px;background:${barColor(pctRpd)};width:${pctRpd}%;transition:width .3s"></div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">
          Użyte dziś: ${dayCount} · Reset za: ${countdownStr(dayResetMs)} (północ UTC)
        </div>
      </div>

      <div style="font-size:10px;color:var(--text3);border-top:1px solid var(--border);padding-top:6px">
        ℹ️ Licznik lokalny — zlicza wywołania z tej przeglądarki. Groq nie udostępnia limitów przez API dla aplikacji webowych.
        <button onclick="resetGroqCounter()" style="background:none;border:none;color:var(--neon);font-size:10px;cursor:pointer;padding:0;margin-left:6px;font-family:inherit">Resetuj licznik</button>
      </div>
    </div>`

  // Odśwież co sekundę
  if (!el._groqTimer) {
    el._groqTimer = setInterval(() => {
      if (document.getElementById('api-status-groq')) renderGroqStatusCard()
      else { clearInterval(el._groqTimer); el._groqTimer = null }
    }, 1000)
  }
}

function resetGroqCounter() {
  localStorage.removeItem(_groqStorageKey())
  renderGroqStatusCard()
  toast('Licznik Groq zresetowany ✓')
}

async function checkGroqStatus() {
  // Tylko odśwież widok — dane są z localStorage
  renderGroqStatusCard()
  const btn = document.getElementById('btn-check-groq')
  if (btn) {
    btn.textContent = '✓ Odświeżono'
    setTimeout(() => { if (btn) btn.textContent = '🔄 Odśwież' }, 1500)
  }
}

function parseGroqHeaders() {} // zachowane dla kompatybilności, CORS blokuje nagłówki

async function callModelApi(model, text) {
  const key = import.meta.env[model.envKey]
  const fullPrompt = PARA_PROMPT + '\n\n' + text

  if (model.type === 'gemini') {
    const res = await fetch(`${model.url}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
    })
    if (res.status === 429 || res.status === 503) throw new Error('RATE_LIMIT')
    if (!res.ok) throw new Error('API_ERROR_' + res.status)
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  // OpenAI-compatible (Groq, Cerebras, SambaNova, OpenRouter)
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`
  }
  if (model.id.startsWith('openrouter')) {
    headers['HTTP-Referer'] = 'https://xpost-manager.vercel.app'
    headers['X-Title'] = 'XPost Manager'
  }
  const res = await fetch(model.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model.model,
      messages: [{ role: 'user', content: fullPrompt }],
      max_tokens: 2048,
      temperature: 0.7
    })
  })
  if (res.status === 429 || res.status === 503) {
    // Zapisz info o 429 do licznika
    if (model.id.startsWith('groq')) trackGroq429(62)
    throw new Error('RATE_LIMIT')
  }
  if (!res.ok) throw new Error('API_ERROR_' + res.status)
  const data = await res.json()
  // Zlicz tokeny dla Groq
  if (model.id.startsWith('groq')) {
    const usedToks = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0)
    trackGroqCall(usedToks)
  }
  return data.choices?.[0]?.message?.content || ''
}

async function paraphraseWithAI(text) {
  const anyKey = AI_MODELS.some(m => import.meta.env[m.envKey])
  if (!anyKey) throw new Error('Brak kluczy API! Dodaj VITE_GROQ_API_KEY (lub inne) w Vercel.')
  for (let i = 0; i < AI_MODELS.length; i++) {
    const model = getBestAvailableModel()
    if (!model) throw new Error('Wszystkie modele wyczerpały limity. Spróbuj za chwilę.')
    try {
      console.log(`[AI Para] Używam: ${model.name}`)
      const result = await callModelApi(model, text)
      if (result && result.trim()) return { text: result.trim(), model: model.name }
      throw new Error('Pusta odpowiedź')
    } catch (err) {
      if (err.message === 'RATE_LIMIT') {
        console.warn(`[AI Para] ${model.name} — limit wyczerpany, przełączam...`)
        markModelExhausted(model)
      } else {
        console.error(`[AI Para] ${model.name} — błąd: ${err.message}`)
        markModelExhausted(model) // tymczasowo blokuj przy błędzie też
      }
    }
  }
  throw new Error('Nie udało się wygenerować parafrazy.')
}

async function triggerAIPara(postId, btn) {
  const ta        = document.getElementById('para-' + postId)
  const modelInfo = document.getElementById('para-model-' + postId)
  if (!ta) return

  const post = posts[postId]
  const sourceText = post?.text
  if (!sourceText || sourceText.trim().length < 10) {
    toast('Brak tekstu oryginalnego!')
    return
  }

  btn.disabled = true
  btn.textContent = '⏳ Generuję...'
  if (modelInfo) modelInfo.textContent = 'Łączę z modelem AI...'

  try {
    const result = await paraphraseWithAI(sourceText)
    // ── MOD 1: dopasuj linki ref ──────────────────────────────────
    const getDomain = url => { try { return new URL(url).hostname.replace('www.','') } catch { return '' } }
    const postLinks = post?.links || []
    const refList   = Object.values(refLinks)
    const linkLines = postLinks.map(link => {
      const linkDomain = getDomain(link)
      const matched = refList.find(r => getDomain(r.url) === linkDomain)
      if (matched) return `🔗 ${matched.name}: ${matched.url}`
      if (linkDomain) return `🔗 ${linkDomain}: ${link}`
      return null
    }).filter(Boolean)
    const finalText = linkLines.length
      ? result.text + '\n\n' + linkLines.join('\n')
      : result.text
    // ─────────────────────────────────────────────────────────────
    // Wstaw do textarea
    ta.value = finalText
    if (modelInfo) modelInfo.textContent = `✅ ${result.model}`
    // Zapisz do Firebase — dokładnie tak samo jak savePara()
    if (posts[postId]) posts[postId].para = finalText
    await updateDoc(doc(db, 'posts', postId), { para: finalText })
    toast('Parafraza wygenerowana i zapisana ✓')
  } catch (err) {
    if (modelInfo) modelInfo.textContent = `❌ ${err.message}`
    toast('Błąd AI: ' + err.message)
  } finally {
    btn.disabled = false
    btn.textContent = '✨ AI'
  }
}
// ── KONIEC: AI PARAFRAZA ──────────────────────────────────────────

// ── STATE ─────────────────────────────────────────────────────────
let posts      = {}
let myPosts    = {}
let refLinks   = {}
let notes      = {}
let tgSignals  = {}
let tgWpisy    = {}
let konta      = {}   // kategorie kont: { katId: { id, name, icon, note, accounts: [{id,name,note}] } }
let airdropTasks = {}
let aiTools      = {} // narzędzia AI: { docId: { id, name, desc, category, free, url, rating, tags, addedAt } }
let manualDrafts = {} // szkice w "Dodaj ręcznie": { docId: { id, text, account, xLink, note, addedAt } }

// ── MOD 4/8: VPS-API state ────────────────────────────────────────
let vpsAccountsX  = []
let vpsTgSignals  = []
let vpsTgWpisy    = []

const vpsHeaders = () => ({'Content-Type':'application/json','X-API-Key': import.meta.env.VITE_VPS_API_KEY || ''})
const vpsUrl = path => (import.meta.env.VITE_VPS_URL || '') + path

let emojis     = ['💸','💰','👇','👉','✨','⭕','➖','📌','🔹','🔗','🧵','💥','✅','💯','📝','📆','🎟️','📸','➡️','📍','‼️','❗','⏩','⏪','▶️','◀️','🔽','⬇️','↔️','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🚨','🏆','📈','🔥','🚀','🧬','🌟','✔','🪂','🎟','⚠️','💎','⭐','🎁','💡']

// Filter state — zarządzane lokalnie
let fAccount = ''
let fStatus  = ''
let fSearch  = ''
let fExclude = ''
let fExcludeMode = 'any'  // 'any' = LUB (którekolwiek słowo), 'all' = I (wszystkie słowa)
let fType    = ''
// Panel szybkiego przeglądu
let fMaxLines  = ''   // maks. liczba linii tekstu
let fMinLines  = ''   // min. liczba linii tekstu
let fMaxChars  = ''   // maks. liczba znaków
let fNoLinks   = false // tylko wpisy BEZ linków
let fNoMedia   = false // tylko wpisy BEZ zdjęć
let fDateFrom  = ''   // od daty
let fDateTo    = ''   // do daty
let fOlderDays = ''   // starsze niż X dni
let fDupes     = false // tylko duplikaty (ten sam początek)
let fPanelOpen = false // czy panel rozwinięty

// TG filter state
let tgSigChannel = ''
let tgSigStatus  = ''
let tgSigSearch  = ''
let tgWpisChannel= ''
let tgWpisStatus = ''
let tgWpisSearch = ''

// Airdrop filter state
let atSearch  = ''
let atStatus  = ''
let atType    = ''
let atView    = 'table' // 'table' | 'cards'
let atSelected  = new Set()
let atShowHidden = false
let atSortCol = 'excelRow' // kolumna sortowania
let atSortDir = 'desc'     // 'asc' | 'desc'
let mainSelected = new Set() // zaznaczone posty w zakładce Wpisy
let tgSigSelected = new Set() // zaznaczone sygnały TG
let tgWpiSelected = new Set() // zaznaczone wpisy TG

// ── UTILS ─────────────────────────────────────────────────────────
const nowStr = () => new Date().toLocaleString('pl-PL',{hour12:false}).replace(',','')
// ISO timestamp do sortowania i porównań dat (YYYY-MM-DD HH:MM:SS)
const nowISO = () => new Date().toISOString().slice(0,19).replace('T',' ')
// Konwertuje datę PL ("30.03.2026 00:28:51") lub ISO na YYYY-MM-DD do porównań
function parseDateStr(s) {
  if (!s) return ''
  // Format ISO: zaczyna się od cyfry 4-cyfrowego roku
  if (/^\d{4}-/.test(s)) return s.slice(0,10)
  // Format PL: DD.MM.YYYY ...
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  return s.slice(0,10)
}
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
    'ZROBIĆ':            'background:rgba(239,68,68,.15);color:#ef4444;font-weight:700',
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
  posts = {}; myPosts = {}; refLinks = {}; notes = {}; tgSignals = {}; tgWpisy = {}; konta = {}; airdropTasks = {}; aiTools = {}; manualDrafts = {}
  const [ps, ms, rs, ns, tgs, tgw, ks, at, cfg, ait, md] = await Promise.all([
    getDocs(query(collection(db,'posts'),         orderBy('xDate','desc'))),
    getDocs(query(collection(db,'myPosts'),       orderBy('created','desc'))),
    getDocs(collection(db,'refLinks')),
    getDocs(query(collection(db,'notes'),         orderBy('created','desc'))),
    getDocs(query(collection(db,'tgSignals'),     orderBy('addedAt','desc'))),
    getDocs(query(collection(db,'tgWpisy'),       orderBy('addedAt','desc'))),
    getDocs(collection(db,'konta')),
    getDocs(query(collection(db,'airdropTasks'),  orderBy('addedAt','desc'))),
    getDoc(doc(db,'airdropConfig','settings')),
    getDocs(query(collection(db,'aiTools'),       orderBy('addedAt','desc'))),
    getDocs(query(collection(db,'manualDrafts'),  orderBy('addedAt','desc'))),
  ])
  ps.forEach(d  => { posts[d.id]         = d.data() })
  ms.forEach(d  => { myPosts[d.id]       = d.data() })
  rs.forEach(d  => { refLinks[d.id]      = d.data() })
  ns.forEach(d  => { notes[d.id]         = d.data() })
  tgs.forEach(d => { tgSignals[d.id]     = d.data() })
  tgw.forEach(d => { tgWpisy[d.id]       = d.data() })
  ks.forEach(d  => { konta[d.id]         = d.data() })
  at.forEach(d  => { airdropTasks[d.id]  = d.data() })
  ait.forEach(d => { aiTools[d.id]       = d.data() })
  md.forEach(d  => { manualDrafts[d.id]  = d.data() })
  // Wczytaj customowe statusy/typy jeśli istnieją
  if (cfg.exists()) {
    const data = cfg.data()
    if (data.statuses?.length) AT_STATUSES = data.statuses
    if (data.types?.length)    AT_TYPES    = data.types
  }
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
  const tabEl = document.querySelector(`.tab[data-tab="${name}"]`)
  const pageEl = document.getElementById(`page-${name}`)
  if (tabEl)  tabEl.classList.add('active')
  if (pageEl) pageEl.classList.add('active')
  const fn = {main:renderMain, moje:renderMoje, notatki:renderNotes, ref:renderRef, konta:renderKonta, manual:()=>{}, airdrop:renderAirdrop, stats:renderStats, aitools:renderAiTools}
  if (fn[name]) fn[name]()
  // Wiecej — renderuj aktywną podzakładkę
  if (name === 'wiecej') {
    const activeSubtab = document.querySelector('.subtab.active')?.dataset.subtab || 'archiwum'
    switchSubTab(activeSubtab)
  }
}

function switchSubTab(name) {
  document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.subpage').forEach(p => p.classList.remove('active'))
  const tabEl  = document.querySelector(`.subtab[data-subtab="${name}"]`)
  const pageEl = document.getElementById(`sub-${name}`)
  if (tabEl)  tabEl.classList.add('active')
  if (pageEl) pageEl.classList.add('active')
  const fn = {archiwum:renderArchive, tgsygnaly:renderTgSygnaly, tgwpisy:renderTgWpisy, kalendarz:renderKalendarz, ustawienia:renderAtSettings, archprojekty:renderArchProjekty}
  if (fn[name]) fn[name]()
  // MOD 8: załaduj konta VPS przy wejściu w ustawienia
  if (name === 'ustawienia') loadVpsAccounts().then(() => renderAtSettings())
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

function toggleFilterPanel() {
  fPanelOpen = !fPanelOpen
  const panel = document.getElementById('main-filter-panel')
  const btn   = document.getElementById('btn-filter-panel')
  if (!panel || !btn) return
  panel.style.display = fPanelOpen ? 'block' : 'none'
  btn.textContent = fPanelOpen ? '🔍 Szybki przegląd ▲' : '🔍 Szybki przegląd ▼'
}

function resetFilterPanel() {
  fMaxLines = ''; fMinLines = ''; fMaxChars = ''; fNoLinks = false; fNoMedia = false
  fDateFrom = ''; fDateTo = ''; fOlderDays = ''; fDupes = false
  const ids = ['f-max-lines','f-min-lines','f-max-chars','f-date-from','f-date-to','f-older-days']
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
  const chks = ['f-no-links','f-no-media','f-dupes']
  chks.forEach(id => { const el = document.getElementById(id); if (el) el.checked = false })
  // Wyczyść też szybkie przyciski dat
  document.querySelectorAll('.f-date-btn').forEach(b => b.classList.remove('active'))
  renderMain()
}

function selectAllVisible() {
  const cards = document.querySelectorAll('#main-cards .card')
  cards.forEach(c => {
    const id = c.id.replace('card-', '')
    if (!id) return
    mainSelected.add(id)
    const chk = c.querySelector('.main-chk')
    if (chk) chk.checked = true
  })
  updateMainBulkBar()
  toast(`Zaznaczono ${mainSelected.size} wpisów`)
}

function setDateFilter(type) {
  const today = new Date()
  const pad   = n => String(n).padStart(2,'0')
  const fmt   = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  const todayStr = fmt(today)
  const yest = new Date(today); yest.setDate(yest.getDate()-1)
  const week = new Date(today); week.setDate(week.getDate()-6)

  const fromEl = document.getElementById('f-date-from')
  const toEl   = document.getElementById('f-date-to')
  document.querySelectorAll('.f-date-btn').forEach(b => b.classList.remove('active'))
  const btn = document.getElementById(`fdb-${type}`)
  if (btn) btn.classList.add('active')

  if (type === 'today') {
    if (fromEl) fromEl.value = todayStr
    if (toEl)   toEl.value   = todayStr
  } else if (type === 'yesterday') {
    if (fromEl) fromEl.value = fmt(yest)
    if (toEl)   toEl.value   = todayStr
  } else if (type === 'week') {
    if (fromEl) fromEl.value = fmt(week)
    if (toEl)   toEl.value   = todayStr
  }
  fDateFrom = fromEl?.value || ''
  fDateTo   = toEl?.value   || ''
  renderMain()
}

// ── RENDER: MAIN ──────────────────────────────────────────────────
function renderMain() {
  // Pobierz aktualne wartości filtrów z DOM (FIX: filtry)
  const selAcc = document.getElementById('f-account')
  const selSt  = document.getElementById('f-status')
  const selTy  = document.getElementById('f-type')
  const inpSr  = document.getElementById('f-search')
  const inpEx  = document.getElementById('f-exclude')
  if (selAcc) fAccount = selAcc.value
  if (selSt)  fStatus  = selSt.value
  if (selTy)  fType    = selTy.value
  if (inpSr)  fSearch  = inpSr.value.toLowerCase()
  if (inpEx)  fExclude = inpEx.value.toLowerCase()
  const selExMode = document.getElementById('f-exclude-mode')
  if (selExMode) fExcludeMode = selExMode.value
  // Panel szybkiego przeglądu
  const inpMaxLines = document.getElementById('f-max-lines')
  const inpMinLines = document.getElementById('f-min-lines')
  const inpMaxChars = document.getElementById('f-max-chars')
  const chkNoLinks  = document.getElementById('f-no-links')
  const chkNoMedia  = document.getElementById('f-no-media')
  const inpDateFrom = document.getElementById('f-date-from')
  const inpDateTo   = document.getElementById('f-date-to')
  const inpOlderDays= document.getElementById('f-older-days')
  const chkDupes    = document.getElementById('f-dupes')
  if (inpMaxLines)  fMaxLines  = inpMaxLines.value
  if (inpMinLines)  fMinLines  = inpMinLines.value
  if (inpMaxChars)  fMaxChars  = inpMaxChars.value
  if (chkNoLinks)   fNoLinks   = chkNoLinks.checked
  if (chkNoMedia)   fNoMedia   = chkNoMedia.checked
  if (inpDateFrom)  fDateFrom  = inpDateFrom.value
  if (inpDateTo)    fDateTo    = inpDateTo.value
  if (inpOlderDays) fOlderDays = inpOlderDays.value
  if (chkDupes)     fDupes     = chkDupes.checked

  // Wykryj duplikaty — wpisy z tym samym początkiem tekstu (pierwsze 60 znaków)
  const dupeSet = new Set()
  const dupeIds = new Set()
  if (fDupes) {
    Object.values(posts).forEach(p => {
      if (p.status === 'Odrzucone' || p.status === 'Opublikowane') return
      const key = p.text.trim().slice(0, 60).toLowerCase()
      if (dupeSet.has(key)) dupeIds.add(p.id)
      else dupeSet.add(key)
    })
    // Dodaj też oryginały które mają duplikat
    const keyCount = {}
    Object.values(posts).forEach(p => {
      if (p.status === 'Odrzucone' || p.status === 'Opublikowane') return
      const key = p.text.trim().slice(0, 60).toLowerCase()
      keyCount[key] = (keyCount[key] || 0) + 1
    })
    Object.values(posts).forEach(p => {
      if (p.status === 'Odrzucone' || p.status === 'Opublikowane') return
      const key = p.text.trim().slice(0, 60).toLowerCase()
      if (keyCount[key] > 1) dupeIds.add(p.id)
    })
  }

  const now = new Date()

  const list = Object.values(posts).filter(p => {
    if (p.status === 'Odrzucone' || p.status === 'Opublikowane') return false
    if (fAccount && p.account !== fAccount) return false
    if (fStatus  && p.status  !== fStatus)  return false
    const isRT = p.isRT || (p.account && p.account.includes(' RT @'))
    if (fType === 'rt'   && !isRT)  return false
    if (fType === 'post' &&  isRT)  return false
    if (fSearch  && !p.text.toLowerCase().includes(fSearch)) return false
    if (fExclude) {
      const txt = p.text.toLowerCase()
      const words = fExclude.split(/\s+/).filter(Boolean)
      const match = fExcludeMode === 'any'
        ? words.some(w => txt.includes(w))
        : words.every(w => txt.includes(w))
      if (match) return false
    }
    // Panel filtrów zaawansowanych
    if (fMaxLines) {
      const lines = p.text.split('\n').filter(l => l.trim()).length
      if (lines > parseInt(fMaxLines)) return false
    }
    if (fMinLines) {
      const lines = p.text.split('\n').filter(l => l.trim()).length
      if (lines < parseInt(fMinLines)) return false
    }
    if (fMaxChars) {
      if (p.text.length > parseInt(fMaxChars)) return false
    }
    if (fNoLinks) {
      const hasLink = /https?:\/\/\S+/.test(p.text) || (p.links && p.links.length > 0)
      if (hasLink) return false
    }
    if (fNoMedia) {
      if (p.imgs && p.imgs.length > 0) return false
    }
    if (fDateFrom) {
      const d = (p.xDate||p.addedAt||'').slice(0,10)
      if (d < fDateFrom) return false
    }
    if (fDateTo) {
      const d = (p.xDate||p.addedAt||'').slice(0,10)
      if (d > fDateTo) return false
    }
    if (fOlderDays) {
      const d    = new Date(p.xDate||p.addedAt||'')
      const diff = (now - d) / (1000*60*60*24)
      if (diff < parseInt(fOlderDays)) return false
    }
    if (fDupes && !dupeIds.has(p.id)) return false
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

  // Aktualizuj licznik w panelu
  const panelCount = document.getElementById('main-panel-count')
  if (panelCount) panelCount.textContent = `Widocznych wpisów: ${list.length}`

  // Bulk bar — pokaż/ukryj
  updateMainBulkBar()

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
        <input type="checkbox" class="main-chk" ${mainSelected.has(p.id)?'checked':''} onchange="mainToggleOne('${p.id}',this.checked)" style="width:15px;height:15px;accent-color:var(--neon5);cursor:pointer;flex-shrink:0;margin-right:2px">
        <span class="account" onclick="showAccountPanel('${p.account}')" style="cursor:pointer;text-decoration:underline dotted" title="Kliknij — podgląd wpisów tego konta">@${p.account}</span>
        ${(()=>{ const n=Object.values(posts).filter(x=>x.account===p.account&&x.status==='Nowy').length; return n>1?`<span style="font-size:10px;padding:1px 5px;border-radius:8px;background:rgba(0,229,255,.12);color:var(--neon);border:1px solid rgba(0,229,255,.25);font-weight:700" title="Nowych wpisów tego konta">${n}</span>`:''; })()}
        ${(p.isRT || (p.account&&p.account.includes(' RT @'))) ? '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid rgba(124,58,237,.3);font-weight:700">RT</span>' : ''}
        ${p.manualEntry ? '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);font-weight:700">✍ Ręczny</span>' : ''}
        <a class="xlink" href="${p.xLink||'#'}" target="_blank">Otwórz na X ↗</a>
        <span class="post-date">📅 ${p.xDate}</span>
        <select class="status-sel" style="${statusStyle(p.status)}" onchange="setPostStatus('${p.id}',this.value)">
          ${['Nowy','ZROBIĆ','Do zrobienia','W toku','Opublikowane','Odrzucone'].map(s=>`<option${s===p.status?' selected':''}>${s}</option>`).join('')}
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
          <div class="col-label" style="display:flex;align-items:center;justify-content:space-between;gap:6px">
            <span>Twoja parafraza</span>
            <button class="btn-ai-para" onclick="triggerAIPara('${p.id}',this)" title="Generuj parafrazę przez AI">✨ AI</button>
          </div>
          <div class="ai-para-info" id="para-model-${p.id}"></div>
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
        <button class="btn btn-success" onclick="addToProjects('${p.id}')" title="Dodaj do zakładki Projekty">🪂 Dodaj do Projektów</button>
        <button class="btn btn-danger ml-auto" onclick="setPostStatus('${p.id}','Odrzucone')">Odrzuć</button>
      </div>
    </div>`
  }).join('')
}

// ── DODAJ WPIS DO PROJEKTÓW (AI) ─────────────────────────────────
async function callAIJson(prompt) {
  // Używa tego samego systemu rotacji modeli co parafraza
  for (let i = 0; i < AI_MODELS.length; i++) {
    const model = getBestAvailableModel()
    if (!model) break
    try {
      const key = import.meta.env[model.envKey]
      let result = ''
      if (model.type === 'gemini') {
        const res = await fetch(`${model.url}?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        })
        if (!res.ok) throw new Error('RATE_LIMIT')
        const data = await res.json()
        result = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } else {
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }
        if (model.id.startsWith('openrouter')) {
          headers['HTTP-Referer'] = 'https://xpost-manager.vercel.app'
          headers['X-Title'] = 'XPost Manager'
        }
        const res = await fetch(model.url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: model.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 300,
            temperature: 0.2
          })
        })
        if (res.status === 429 || res.status === 503) throw new Error('RATE_LIMIT')
        if (!res.ok) throw new Error('API_ERROR_' + res.status)
        const data = await res.json()
        result = data.choices?.[0]?.message?.content || ''
      }
      if (result.trim()) return result.trim()
      throw new Error('Pusta odpowiedź')
    } catch(err) {
      if (err.message === 'RATE_LIMIT') markModelExhausted(model)
      else markModelExhausted(model)
    }
  }
  return null
}

async function addToProjects(postId) {
  const p = posts[postId]
  if (!p) return
  const btn = document.querySelector(`button[onclick="addToProjects('${postId}')"]`)
  if (btn) { btn.disabled = true; btn.textContent = '⏳ AI analizuje...' }

  let project = '', tasks = '', socialLink = p.xLink || '', testnetLinks = '', entry_type = ''

  // Wyciągnij wszystkie URL-e z treści tweeta z góry (niezależnie od AI)
  const urlsInText = (p.text.match(/https?:\/\/[^\s"'<>]+/g) || [])
    .filter(u => !u.includes('twitter.com') && !u.includes('x.com') && !u.includes('t.co/') === false || u.includes('t.co/'))
    .filter((u,i,a) => a.indexOf(u) === i) // unikalne

  try {
    const prompt = `Przeanalizuj ten tweet o projekcie crypto/Web3 i wyciągnij następujące pola:

1. "project" - nazwa projektu/protokołu (max 3 słowa, samo imię własne np. "Initia", "Monad", "Babylon"; jeśli nie ma jednoznacznej nazwy użyj nazwy konta)
2. "tasks" - co konkretnie trzeba zrobić (lista zadań po jednym na linię, max 5 zadań, zacznij każde od "-"; jeśli nie ma konkretnych zadań napisz "- Sprawdź projekt")
3. "testnetLinks" - WSZYSTKIE linki URL znalezione w tweecie które prowadzą do aplikacji, testnetów, questów, formularzy, bridge'y itp. (każdy link w osobnej linii; pomiń linki do twitter.com, x.com oraz skrócone t.co które nie są rozwinięte)
4. "type" - typ projektu: "Testnet", "Mainnet", "WL", "Airdrop" lub "Inne" (na podstawie kontekstu)

Tweet: "${p.text}"
Znalezione URL-e w tweecie: ${urlsInText.length ? urlsInText.join(', ') : 'brak'}

Odpowiedz WYŁĄCZNIE w formacie JSON bez żadnego dodatkowego tekstu ani backticks:
{"project":"...","tasks":"...","testnetLinks":"...","type":"..."}`

    const raw = await callAIJson(prompt)
    if (raw) {
      const clean  = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      project      = parsed.project      || p.account || ''
      tasks        = parsed.tasks        || ''
      testnetLinks = parsed.testnetLinks || urlsInText.join('\n') || ''
      if (parsed.type && AT_TYPES.includes(parsed.type)) {
        // użyj typu sugerowanego przez AI jeśli jest na liście
        entry_type = parsed.type
      }
    }
  } catch(e) {
    console.warn('[addToProjects] AI error:', e)
    // Fallback — wstaw linki z tekstu
    testnetLinks = urlsInText.join('\n')
  }

  // Fallback jeśli AI nie odpowiedziało
  if (!project) project = p.account || 'Nowy projekt'
  if (!testnetLinks) testnetLinks = urlsInText.join('\n')

  // Zapisz do Firebase
  const docId   = 'at_' + uid()
  const nextRow = Math.max(0, ...Object.values(airdropTasks).map(x => x.excelRow || 0)) + 1
  const entry   = {
    id: docId, excelRow: nextRow,
    status: 'TODO', type: entry_type || '',
    project, tasks,
    date: '', socialLink, testnetLinks,
    wallet: '', imgUrl: '', note: '',
    hidden: false, addedAt: nowStr()
  }
  await setDoc(doc(db, 'airdropTasks', docId), entry)
  airdropTasks[docId] = entry
  updateBadges()

  if (btn) { btn.disabled = false; btn.textContent = '✅ Dodano!' }
  setTimeout(() => { if (btn) btn.textContent = '🪂 Dodaj do Projektów' }, 2500)
  toast(`🪂 Dodano projekt "${project}" ✓`)
}

// ── PODGLĄD PROFILU KONTA ────────────────────────────────────────
function showAccountPanel(account) {
  // Usuń stary panel jeśli istnieje
  document.getElementById('account-panel')?.remove()

  const accountPosts = Object.values(posts)
    .filter(p => p.account === account && p.status !== 'Odrzucone')
    .sort((a,b) => (b.xDate||'').localeCompare(a.xDate||''))

  const counts = {
    nowy:         accountPosts.filter(p => p.status === 'Nowy').length,
    doZrobienia:  accountPosts.filter(p => p.status === 'Do zrobienia').length,
    wToku:        accountPosts.filter(p => p.status === 'W toku').length,
    opublikowane: accountPosts.filter(p => p.status === 'Opublikowane').length,
  }

  const panel = document.createElement('div')
  panel.id = 'account-panel'
  panel.innerHTML = `
    <div id="account-panel-bg" onclick="closeAccountPanel()" style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:999"></div>
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000;
      width:min(600px,95vw);max-height:80vh;overflow-y:auto;
      background:var(--bg2);border:1px solid var(--border2);border-radius:var(--rl);
      box-shadow:0 8px 40px rgba(0,0,0,.5);display:flex;flex-direction:column">
      <!-- Nagłówek -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border2);position:sticky;top:0;background:var(--bg2);z-index:2">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--neon)">@${account}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">
            ${accountPosts.length} wpisów aktywnych
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <a href="https://x.com/${account}" target="_blank" class="btn" style="font-size:11px;padding:4px 10px">Otwórz na X ↗</a>
          <button onclick="closeAccountPanel()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;padding:0 4px;line-height:1">✕</button>
        </div>
      </div>
      <!-- Statsy -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:12px 16px;border-bottom:1px solid var(--border)">
        <div class="stat"><div class="stat-n" style="color:#f59e0b;font-size:18px">${counts.nowy}</div><div class="stat-l">Nowe</div></div>
        <div class="stat"><div class="stat-n" style="color:var(--neon);font-size:18px">${counts.doZrobienia}</div><div class="stat-l">Do zrobienia</div></div>
        <div class="stat"><div class="stat-n" style="color:#a78bfa;font-size:18px">${counts.wToku}</div><div class="stat-l">W toku</div></div>
        <div class="stat"><div class="stat-n" style="color:#10b981;font-size:18px">${counts.opublikowane}</div><div class="stat-l">Opublikowane</div></div>
      </div>
      <!-- Lista wpisów -->
      <div style="padding:12px 16px;display:flex;flex-direction:column;gap:10px">
        ${accountPosts.length === 0
          ? '<div class="empty">Brak aktywnych wpisów.</div>'
          : accountPosts.slice(0,15).map(p => `
            <div style="background:var(--bg3);border-radius:var(--r);padding:10px 12px;border:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px">
                <span style="font-size:11px;color:var(--text3)">📅 ${p.xDate||''}</span>
                <span style="font-size:10px;padding:2px 7px;border-radius:4px;font-weight:700;${statusStyle(p.status)}">${p.status}</span>
              </div>
              <div style="font-size:12px;color:var(--text2);line-height:1.5;word-break:break-word;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${p.text}</div>
              ${p.xLink ? `<a href="${p.xLink}" target="_blank" style="font-size:11px;color:var(--neon);text-decoration:none;margin-top:5px;display:inline-block">Otwórz na X ↗</a>` : ''}
            </div>`).join('')
        }
        ${accountPosts.length > 15 ? `<div style="text-align:center;font-size:12px;color:var(--text3)">... i ${accountPosts.length-15} więcej wpisów</div>` : ''}
      </div>
    </div>`
  document.body.appendChild(panel)

  // Zamknij klawiszem Escape
  const escHandler = e => { if (e.key === 'Escape') { closeAccountPanel(); document.removeEventListener('keydown', escHandler) } }
  document.addEventListener('keydown', escHandler)
}

function closeAccountPanel() {
  document.getElementById('account-panel')?.remove()
}

// ── MAIN BULK SELECT ─────────────────────────────────────────────
function mainToggleOne(id, checked) {
  if (checked) mainSelected.add(id)
  else mainSelected.delete(id)
  updateMainBulkBar()
}

function updateMainBulkBar() {
  const bar   = document.getElementById('main-bulk-bar')
  const count = document.getElementById('main-bulk-count')
  if (!bar) return
  const n = mainSelected.size
  bar.style.display = n > 0 ? 'flex' : 'none'
  if (count) count.textContent = `Zaznaczono: ${n}`
}

async function deleteMainSelected() {
  const n = mainSelected.size
  if (!n) return
  if (!confirm(`Odrzucić ${n} zaznaczonych wpisów?`)) return
  const ids = [...mainSelected]
  await Promise.all(ids.map(id => {
    posts[id].status = 'Odrzucone'
    return updateDoc(doc(db, 'posts', id), { status: 'Odrzucone' })
  }))
  mainSelected.clear()
  renderMain(); updateStats(); updateBadges()
  toast(`Odrzucono ${n} wpisów ✓`)
}

// ── DODAJ RĘCZNIE ────────────────────────────────────────────────
function toggleManualForm(show) {
  const f = document.getElementById('manual-form')
  const b = document.getElementById('btn-add-manual')
  if (!f || !b) return
  if (show === undefined) show = f.style.display === 'none'
  f.style.display = show ? 'block' : 'none'
  b.textContent   = show ? '✕ Zamknij' : '+ Dodaj post ręcznie'
  if (show) {
    const fields = ['manual-text','manual-link','manual-account','manual-note']
    fields.forEach(id => { const el=document.getElementById(id); if(el) el.value='' })
    const d = document.getElementById('manual-date')
    if (d) d.value = new Date().toISOString().slice(0,16)
  }
}

async function addManualPost() {
  const text    = document.getElementById('manual-text')?.value.trim()
  const link    = document.getElementById('manual-link')?.value.trim() || ''
  const account = document.getElementById('manual-account')?.value.trim() || 'ręczny'
  const note    = document.getElementById('manual-note')?.value.trim() || ''
  const dateVal = document.getElementById('manual-date')?.value || ''
  if (!text) { toast('Wpisz treść posta!'); return }
  const id  = 'manual_' + uid()
  const now = nowStr()
  const xDate = dateVal ? dateVal.replace('T', ' ') : now
  const post = {
    id, account, xDate, xLink: link, text,
    links: [], imgs: [], isRT: false,
    para: '', note, status: 'Nowy',
    addedAt: now, manualEntry: true
  }
  await setDoc(doc(db, 'posts', id), post)
  posts[id] = post
  toggleManualForm(false)
  renderMain(); updateStats(); updateBadges()
  toast('Post dodany ✓')
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
  s('tab-airdrop-badge', Object.keys(airdropTasks).length)
  s('tab-tgsig-badge',  Object.values(tgSignals).filter(p=>p.status==='Nowy').length)
  s('tab-tgwpisy-badge',Object.values(tgWpisy).filter(p=>p.status==='Nowy').length)
  // Badge "Więcej" = suma nowych TG sygnałów + TG wpisów
  const wiecejCount = Object.values(tgSignals).filter(p=>p.status==='Nowy').length + Object.values(tgWpisy).filter(p=>p.status==='Nowy').length
  s('tab-wiecej-badge', wiecejCount || '')
}

// ── RENDER: MY POSTS ──────────────────────────────────────────────
function renderMoje() {
  const el   = document.getElementById('moje-cards')
  if (!el) return
  // Nieopublikowane na górze (sort po dacie), opublikowane na dole (sort po dacie)
  const list = Object.values(myPosts).sort((a,b) => {
    const aPub = a.status === 'Opublikowane' ? 1 : 0
    const bPub = b.status === 'Opublikowane' ? 1 : 0
    if (aPub !== bPub) return aPub - bPub
    return b.created.localeCompare(a.created)
  })
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
  const searchEl = document.getElementById('note-search')
  const search = searchEl ? searchEl.value.toLowerCase() : ''
  const list = Object.values(notes)
    .filter(n => !search || n.text.toLowerCase().includes(search))
    .sort((a,b)=>{
      const da = parseDateStr(a.created) + (a.created||'').slice(10)
      const db2 = parseDateStr(b.created) + (b.created||'').slice(10)
      return db2.localeCompare(da)
    })
  const el = document.getElementById('notes-cards')
  if(!el) return
  if(!list.length){el.innerHTML=`<div class="empty">${search ? 'Brak notatek pasujących do wyszukiwania.' : 'Brak notatek.'}</div>`;return}
  el.innerHTML = list.map(n=>{
    const editing = !!n._editing
    return `
    <div class="note-card">
      <div class="note-head">
        <span class="note-date">📝 ${n.created}</span>
        <div style="display:flex;gap:4px">
          ${editing
            ? `<button class="btn btn-primary" style="font-size:11px;padding:2px 8px" onclick="saveNoteEdit('${n.id}')">💾 Zapisz</button>
               <button class="btn" style="font-size:11px;padding:2px 8px" onclick="cancelNoteEdit('${n.id}')">Anuluj</button>`
            : `<button class="btn" style="font-size:11px;padding:2px 8px" onclick="startNoteEdit('${n.id}')">✏️ Edytuj</button>
               <button class="btn" style="font-size:11px;padding:2px 8px" onclick="copyNoteText('${n.id}')">📋 Kopiuj</button>`
          }
          <button class="btn btn-danger" style="font-size:11px;padding:2px 8px" onclick="deleteNote('${n.id}')">Usuń</button>
        </div>
      </div>
      ${editing
        ? `<textarea id="note-edit-${n.id}" style="width:100%;min-height:90px;margin-top:6px;box-sizing:border-box" class="form-textarea">${n.text}</textarea>`
        : `<div class="note-text">${n.text}</div>`
      }
    </div>`
  }).join('')
}

function copyNoteText(id) {
  const n = notes[id]
  if (!n) return
  navigator.clipboard.writeText(n.text).then(() => toast('📋 Skopiowano ✓'))
}

function startNoteEdit(id)  { if(notes[id]){ notes[id]._editing=true;  renderNotes() } }
function cancelNoteEdit(id) { if(notes[id]){ notes[id]._editing=false; renderNotes() } }

async function saveNoteEdit(id) {
  const n = notes[id]
  if (!n) return
  const text = document.getElementById(`note-edit-${id}`)?.value.trim()
  if (!text) { toast('Notatka nie może być pusta!'); return }
  n.text = text
  n._editing = false
  const save = {...n}; delete save._editing
  await setDoc(doc(db,'notes',id), save)
  renderNotes()
  toast('Zaktualizowano ✓')
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
// ── TG BULK SELECT ───────────────────────────────────────────────
function tgToggleOne(set, id, checked, updateFn) {
  if (checked) set.add(id)
  else set.delete(id)
  updateFn()
}

function updateTgBulkBar(set, barId, countId) {
  const bar   = document.getElementById(barId)
  const count = document.getElementById(countId)
  if (!bar) return
  const n = set.size
  bar.style.display = n > 0 ? 'flex' : 'none'
  if (count) count.textContent = `Zaznaczono: ${n}`
}

function tgSelectAll(set, collection, updateFn, renderFn) {
  // Zaznacz wszystkie widoczne karty
  document.querySelectorAll(`#${collection}-cards .tg-chk`).forEach(chk => {
    set.add(chk.dataset.id)
    chk.checked = true
  })
  updateFn()
  const n = set.size
  toast(`Zaznaczono ${n} wpisów`)
}

async function tgRejectSelected(set, collectionName, updateFn, renderFn) {
  if (!set.size) return
  if (!confirm(`Odrzucić ${set.size} zaznaczonych wpisów?`)) return
  const ids = [...set]
  set.clear()
  updateFn()
  let done = 0
  for (const id of ids) {
    try {
      await updateDoc(doc(db, collectionName, id), { status: 'Odrzucone' })
      if (collectionName === 'tgSignals') { if (tgSignals[id]) tgSignals[id].status = 'Odrzucone' }
      else                               { if (tgWpisy[id])   tgWpisy[id].status   = 'Odrzucone' }
      done++
    } catch(e) { console.warn('tgReject', id, e) }
  }
  toast(`✅ Odrzucono ${done} wpisów`)
  renderFn()
}
// ─────────────────────────────────────────────────────────────────

async function refreshTgData(type) {
  // type: 'signals' | 'wpisy' | 'both'
  const btnSig = document.getElementById('btn-refresh-tgsig')
  const btnWpi = document.getElementById('btn-refresh-tgwpisy')
  const doSig = type === 'signals' || type === 'both'
  const doWpi = type === 'wpisy'   || type === 'both'

  if (doSig && btnSig) { btnSig.disabled = true; btnSig.textContent = '⏳ Pobieranie...' }
  if (doWpi && btnWpi) { btnWpi.disabled = true; btnWpi.textContent = '⏳ Pobieranie...' }

  try {
    const promises = []
    if (doSig) promises.push(getDocs(query(collection(db,'tgSignals'), orderBy('addedAt','desc'))))
    if (doWpi) promises.push(getDocs(query(collection(db,'tgWpisy'),   orderBy('addedAt','desc'))))
    const results = await Promise.all(promises)

    let i = 0
    if (doSig) {
      let newSig = 0
      results[i].forEach(d => { if (!tgSignals[d.id]) newSig++; tgSignals[d.id] = d.data() })
      i++
      renderTgSygnaly()
      toast(`📡 Sygnały odświeżone${newSig ? ` (+${newSig} nowych)` : ' (bez zmian)'}`)
    }
    if (doWpi) {
      let newWpi = 0
      results[i].forEach(d => { if (!tgWpisy[d.id]) newWpi++; tgWpisy[d.id] = d.data() })
      renderTgWpisy()
      toast(`📋 Wpisy TG odświeżone${newWpi ? ` (+${newWpi} nowych)` : ' (bez zmian)'}`)
    }
    updateBadges()
  } catch(e) {
    toast('❌ Błąd odświeżania TG: ' + e.message)
  } finally {
    if (doSig && btnSig) { btnSig.disabled = false; btnSig.textContent = '🔄 Odśwież' }
    if (doWpi && btnWpi) { btnWpi.disabled = false; btnWpi.textContent = '🔄 Odśwież' }
  }
}

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
        <input type="checkbox" class="tg-chk" data-id="${docId}" ${tgSigSelected.has(docId)?'checked':''} style="width:15px;height:15px;accent-color:var(--neon5);cursor:pointer;flex-shrink:0;margin-right:2px" onchange="tgToggleOne(tgSigSelected,'${docId}',this.checked,()=>updateTgBulkBar(tgSigSelected,'tgsig-bulk-bar','tgsig-bulk-count'))">
        <span style="font-size:11px;padding:2px 7px;border-radius:10px;background:rgba(0,229,255,.1);color:var(--neon);border:1px solid rgba(0,229,255,.3);font-weight:700">📡 @${p.channel}</span>
        ${kws}
        <a class="xlink" href="${p.link||'#'}" target="_blank">Otwórz na TG ↗</a>
        <span class="post-date">📅 ${(p.tgDate||'').slice(0,16)}</span>
        <select class="status-sel" style="${statusStyle(p.status)}" onchange="setTgStatus('tgSignals','${docId}',this.value,renderTgSygnaly)">
          ${['Nowy','ZROBIĆ','Do zrobienia','W toku','Opublikowane','Odrzucone'].map(s=>`<option${s===p.status?' selected':''}>${s}</option>`).join('')}
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
        <input type="checkbox" class="tg-chk" data-id="${docId}" ${tgWpiSelected.has(docId)?'checked':''} style="width:15px;height:15px;accent-color:var(--neon5);cursor:pointer;flex-shrink:0;margin-right:2px" onchange="tgToggleOne(tgWpiSelected,'${docId}',this.checked,()=>updateTgBulkBar(tgWpiSelected,'tgwpisy-bulk-bar','tgwpisy-bulk-count'))">
        <span style="font-size:11px;padding:2px 7px;border-radius:10px;background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid rgba(124,58,237,.3);font-weight:700">📋 @${p.channel}</span>
        <a class="xlink" href="${p.link||'#'}" target="_blank">Otwórz na TG ↗</a>
        <span class="post-date">📅 ${(p.tgDate||'').slice(0,16)}</span>
        <select class="status-sel" style="${statusStyle(p.status)}" onchange="setTgStatus('tgWpisy','${docId}',this.value,renderTgWpisy)">
          ${['Nowy','ZROBIĆ','Do zrobienia','W toku','Opublikowane','Odrzucone'].map(s=>`<option${s===p.status?' selected':''}>${s}</option>`).join('')}
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

// ── AIRDROP TASKS ─────────────────────────────────────────────────
let AT_STATUSES = ['TODO','DONE na 1 koncie','DONE na 3 walletach','DONE na 3 kontach gmail','DONE na 5 walletach','Pominięty']
let AT_TYPES    = ['Testnet','Mainnet','WL','Airdrop','Inne']

function atStatusStyle(s) {
  if (!s) return 'background:rgba(245,158,11,.12);color:#f59e0b'
  const u = s.toUpperCase()
  if (u.startsWith('TODO'))    return 'background:rgba(245,158,11,.12);color:#f59e0b'
  if (u.startsWith('DONE'))    return 'background:rgba(16,185,129,.12);color:#10b981'
  if (s === 'Pominięty')       return 'background:rgba(239,68,68,.1);color:#ef4444'
  return 'background:var(--bg3);color:var(--text2)'
}

function renderAirdrop() {
  const el = document.getElementById('airdrop-content')
  if (!el) return

  const inpSr = document.getElementById('at-search')
  const selSt = document.getElementById('at-status')
  const selTy = document.getElementById('at-type')
  if (inpSr) atSearch = inpSr.value.toLowerCase()
  if (selSt) atStatus = selSt.value
  if (selTy) atType   = selTy.value

  const list = Object.entries(airdropTasks)
    .filter(([,p]) => {
      if (!atShowHidden && p.hidden) return false   // ukryte domyślnie niewidoczne
      if (atStatus && p.status !== atStatus) return false
      if (atType   && p.type   !== atType)   return false
      if (atSearch) {
        const hay = [p.project, p.tasks, p.note, p.wallet].join(' ').toLowerCase()
        if (!hay.includes(atSearch)) return false
      }
      return true
    })
    .sort(([,a],[,b]) => {
      const dir = atSortDir === 'asc' ? 1 : -1
      const col = atSortCol
      if (col === 'excelRow') {
        return ((a.excelRow||0) - (b.excelRow||0)) * dir
      }
      if (col === 'status') {
        return (a.status||'').localeCompare(b.status||'', 'pl') * dir
      }
      if (col === 'type') {
        return (a.type||'').localeCompare(b.type||'', 'pl') * dir
      }
      if (col === 'project') {
        return (a.project||'').localeCompare(b.project||'', 'pl') * dir
      }
      if (col === 'date') {
        return (a.date||'').localeCompare(b.date||'') * dir
      }
      // domyślnie excelRow desc
      return ((b.excelRow||0) - (a.excelRow||0))
    })

  const statsEl    = document.getElementById('at-stats-all')
  const statsTodo  = document.getElementById('at-stats-todo')
  const statsDone  = document.getElementById('at-stats-done')
  const allTasks   = Object.values(airdropTasks)
  if (statsEl)   statsEl.textContent   = allTasks.length
  if (statsTodo) statsTodo.textContent = allTasks.filter(p => p.status?.toUpperCase().startsWith('TODO') || !p.status).length
  if (statsDone) statsDone.textContent = allTasks.filter(p => p.status?.toUpperCase().startsWith('DONE')).length

  // Usuń z setu zaznaczenia wpisy których już nie ma na liście
  const visibleIds = new Set(list.map(([id]) => id))
  atSelected.forEach(id => { if (!visibleIds.has(id)) atSelected.delete(id) })
  updateAtBulkBar()

  if (!list.length) {
    el.innerHTML = '<div class="empty">Brak projektów pasujących do filtrów.</div>'
    return
  }

  if (atView === 'table') {
    const allChecked = list.length > 0 && list.every(([id]) => atSelected.has(id))

    // Linkifikuje URL-e w tekście
    const linkify = t => t.replace(/(https?:\/\/[^\s<]+)/g, u =>
      `<a href="${u}" target="_blank" class="at-link" title="${u}">${u.replace(/^https?:\/\//,'').slice(0,36)}</a>`)

    // Uniwersalna zwijalna komórka tekstowa (auto-linkuje URL-e)
    const CC = (text, docId, field, maxLen = 60) => {
      if (!text || !text.trim()) return '<span class="at-empty">—</span>'
      const trimmed = text.trim()
      const short   = trimmed.length > maxLen
      const display = short ? trimmed.slice(0, maxLen) + '…' : trimmed
      return `<div class="at-collapsible">
        <div class="at-cell-inner${short?' at-collapsed':''}" id="atc-${docId}-${field}">${linkify(display).replace(/\n/g,'<br>')}</div>
        ${short ? `<button class="at-expand-btn" onclick="atExpandCell('${docId}','${field}')"><span class="at-expand-icon">▼</span> więcej</button>` : ''}
      </div>`
    }

    // Zwijalna komórka z linkami
    const CL = (text, docId) => {
      if (!text || !text.trim()) return '<span class="at-empty">—</span>'
      const links = text.split('\n').map(l=>l.trim()).filter(Boolean)
      const short  = links.length > 2
      const renderL = arr => arr.map(l =>
        `<a href="${l}" target="_blank" class="at-link" title="${l}">${l.replace(/^https?:\/\//,'').slice(0,32)}</a>`
      ).join('')
      return `<div class="at-collapsible">
        <div class="at-cell-inner${short?' at-collapsed':''}" id="atc-${docId}-tlinks">${renderL(short ? links.slice(0,2) : links)}</div>
        ${short ? `<button class="at-expand-btn" onclick="atExpandCell('${docId}','tlinks')"><span class="at-expand-icon">▼</span> +${links.length-2} więcej</button>` : ''}
      </div>`
    }

    // Zwijalna komórka z pojedynczym linkiem socjali
    const CSocial = (url, docId) => {
      if (!url) return '<span class="at-empty">—</span>'
      return `<a href="${url}" target="_blank" class="at-link" title="${url}">${url.replace(/^https?:\/\//,'').slice(0,32)}</a>`
    }

    const si = (col) => atSortCol===col ? (atSortDir==='desc'?'↓':'↑') : '↕'
    const sh = (col, label) => `<th onclick="atSetSort('${col}')" style="cursor:pointer;user-select:none" title="Sortuj po: ${label}">${label} <span style="opacity:.5;font-size:9px">${si(col)}</span></th>`
    const tableHtml = `
      <table class="at-table" style="width:1460px">
        <colgroup>
          <col style="width:36px">
          <col style="width:46px">
          <col style="width:160px">
          <col style="width:100px">
          <col style="width:130px">
          <col style="width:200px">
          <col style="width:80px">
          <col style="width:160px">
          <col style="width:180px">
          <col style="width:110px">
          <col style="width:180px">
          <col style="width:78px">
        </colgroup>
        <thead>
          <tr>
            <th style="width:32px;padding:8px 6px 8px 12px">
              <input type="checkbox" class="at-chk" ${allChecked?'checked':''} onchange="atToggleAll(this.checked)" title="Zaznacz wszystkie">
            </th>
            ${sh('excelRow','#')}
            ${sh('status','Status')}
            ${sh('type','Typ')}
            ${sh('project','Projekt')}
            <th>Zadania</th>
            ${sh('date','Data')}
            <th>Link socjali</th>
            <th>Linki testnet</th>
            <th>Portfel</th>
            <th>Notatka</th>
            <th>Akcje</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(([docId, p]) => `
            <tr class="at-row${p.status?.toUpperCase().startsWith('DONE') || p.status==='Pominięty' ? ' at-row-done' : ''}${atSelected.has(docId)?' at-row-sel':''}">
              <td style="padding:7px 6px 7px 12px">
                <input type="checkbox" class="at-chk" ${atSelected.has(docId)?'checked':''} onchange="atToggleOne('${docId}',this.checked)">
              </td>
              <td><div class="at-num-cell">${p.excelRow||'—'}</div></td>
              <td>
                <select class="at-status-sel" style="${atStatusStyle(p.status)}" onchange="setAtStatus('${docId}',this.value)">
                  ${AT_STATUSES.map(s=>`<option${s===p.status?' selected':''}>${s}</option>`).join('')}
                </select>
              </td>
              <td>
                <select class="at-type-sel" onchange="setAtField('${docId}','type',this.value)">
                  <option value="">—</option>
                  ${AT_TYPES.map(t=>`<option${t===p.type?' selected':''}>${t}</option>`).join('')}
                </select>
              </td>
              <td>${CC(p.project, docId, 'project', 30)}</td>
              <td>${CC(p.tasks,   docId, 'tasks',   80)}</td>
              <td>${CC(p.date,   docId, 'date',   20)}</td>
              <td>${CC(p.socialLink, docId, 'socialLink', 32)}</td>
              <td>${CL(p.testnetLinks, docId)}</td>
              <td>${CC(p.wallet, docId, 'wallet', 20)}</td>
              <td>${CC(p.note,   docId, 'note',   80)}</td>
              <td>
                <div style="display:flex;gap:4px;flex-wrap:nowrap">
                  <button class="btn" style="font-size:11px;padding:3px 7px" onclick="openAtEdit('${docId}')" title="Edytuj">✏️</button>
                  <button class="btn" style="font-size:11px;padding:3px 7px" onclick="duplicateAt('${docId}')" title="Duplikuj">⧉</button>
                  <button class="btn ${p.hidden?'btn-success':'btn-info'}" style="font-size:11px;padding:3px 7px" onclick="toggleAtHide('${docId}')" title="${p.hidden?'Pokaż':'Ukryj'}">${p.hidden?'👁':'🙈'}</button>
                  <button class="btn btn-danger" style="font-size:11px;padding:3px 7px" onclick="deleteAt('${docId}')" title="Usuń">✕</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`

    el.innerHTML = `
      <div class="at-table-outer" id="at-table-wrap">${tableHtml}</div>`
  } else {
    // Widok kart — checkbox w nagłówku karty
    el.innerHTML = list.map(([docId, p]) => `
      <div class="at-card${p.status?.toUpperCase().startsWith('DONE') || p.status==='Pominięty' ? ' at-card-done' : ''}${atSelected.has(docId)?' at-card-sel':''}">
        <div class="at-card-head">
          <input type="checkbox" class="at-chk" ${atSelected.has(docId)?'checked':''} onchange="atToggleOne('${docId}',this.checked)" style="flex-shrink:0">
          <span class="at-card-project">${p.project||'(brak nazwy)'}</span>
          ${p.type ? `<span class="at-type-badge">${p.type}</span>` : ''}
          <select class="at-status-sel" style="${atStatusStyle(p.status)};margin-left:auto" onchange="setAtStatus('${docId}',this.value)">
            ${AT_STATUSES.map(s=>`<option${s===p.status?' selected':''}>${s}</option>`).join('')}
          </select>
          <button class="btn" style="font-size:11px;padding:3px 7px" onclick="openAtEdit('${docId}')" title="Edytuj">✏️</button>
          <button class="btn" style="font-size:11px;padding:3px 7px" onclick="duplicateAt('${docId}')" title="Duplikuj">⧉</button>
          <button class="btn ${p.hidden?'btn-success':'btn-info'}" style="font-size:11px;padding:3px 7px" onclick="toggleAtHide('${docId}')" title="${p.hidden?'Pokaż':'Ukryj'}">${p.hidden?'👁':'🙈'}</button>
          <button class="btn btn-danger" style="font-size:11px;padding:3px 7px" onclick="deleteAt('${docId}')" title="Usuń">✕</button>
        </div>
        ${p.tasks ? `<div class="at-card-tasks">${p.tasks.replace(/\n/g,'<br>')}</div>` : ''}
        <div class="at-card-foot">
          ${p.date ? `<span class="at-meta">📅 ${p.date}</span>` : ''}
          ${p.wallet ? `<span class="at-meta">👛 ${p.wallet}</span>` : ''}
          ${p.note ? `<span class="at-meta">📝 ${p.note}</span>` : ''}
          ${p.socialLink ? `<a href="${p.socialLink}" target="_blank" class="at-link">Socjale ↗</a>` : ''}
          ${(p.testnetLinks||'').split('\n').filter(Boolean).map((l,i)=>`<a href="${l.trim()}" target="_blank" class="at-link">Link ${i+1} ↗</a>`).join('')}
        </div>
        ${p.imgUrl ? `<img src="${p.imgUrl}" class="at-card-img" alt="screenshot" onclick="window.open('${p.imgUrl}','_blank')">` : ''}
      </div>`).join('')
  }
}

function atToggleOne(docId, checked) {
  if (checked) atSelected.add(docId)
  else atSelected.delete(docId)
  updateAtBulkBar()
  // Aktualizuj styl wiersza/karty bez pełnego re-renderu
  const row = document.querySelector(`[data-at-id="${docId}"]`) // fallback
  const chks = document.querySelectorAll('.at-chk')
  // Synchronizuj "zaznacz wszystkie" checkbox w nagłówku
  const allVisible = document.querySelectorAll('tbody .at-chk')
  const headerChk  = document.querySelector('thead .at-chk')
  if (headerChk && allVisible.length) {
    headerChk.checked = [...allVisible].every(c => c.checked)
    headerChk.indeterminate = !headerChk.checked && [...allVisible].some(c => c.checked)
  }
}

function atToggleAll(checked) {
  // Zaznacz/odznacz wszystkie widoczne
  document.querySelectorAll('tbody .at-chk').forEach(chk => {
    chk.checked = checked
    const tr = chk.closest('tr')
    if (!tr) return
    // Wyciągnij docId z onclick deleteAt lub checkbox onchange
    const oc = chk.getAttribute('onchange') || ''
    const m  = oc.match(/atToggleOne\('([^']+)'/)
    if (m) {
      if (checked) atSelected.add(m[1])
      else atSelected.delete(m[1])
    }
  })
  // Widok kart
  document.querySelectorAll('.at-card .at-chk').forEach(chk => {
    chk.checked = checked
    const oc = chk.getAttribute('onchange') || ''
    const m  = oc.match(/atToggleOne\('([^']+)'/)
    if (m) {
      if (checked) atSelected.add(m[1])
      else atSelected.delete(m[1])
    }
  })
  updateAtBulkBar()
}

function updateAtBulkBar() {
  const bar   = document.getElementById('at-bulk-bar')
  const count = document.getElementById('at-bulk-count')
  if (!bar) return
  const n = atSelected.size
  if (n > 0) {
    bar.style.display = 'flex'
    if (count) count.textContent = `Zaznaczono: ${n}`
  } else {
    bar.style.display = 'none'
  }
}

function atLinkify(t) {
  return (t||'').replace(/(https?:\/\/[^\s<]+)/g, u =>
    `<a href="${u}" target="_blank" class="at-link" title="${u}">${u.replace(/^https?:\/\//,'').slice(0,36)}</a>`)
}

function atExpandCell(docId, field) {
  const cell = document.getElementById(`atc-${docId}-${field}`)
  const btn  = cell?.nextElementSibling
  if (!cell) return
  const p = airdropTasks[docId]
  if (!p) return

  const maxLens = { project: 30, tasks: 80, wallet: 20, note: 80, date: 20 }
  const maxLen  = maxLens[field] || 80

  const isCollapsed = cell.classList.contains('at-collapsed')
  if (isCollapsed) {
    // Rozwiń — pełna treść z linkifikacją
    if (field === 'tlinks') {
      cell.innerHTML = (p.testnetLinks||'').split('\n').map(l=>l.trim()).filter(Boolean)
        .map(l => `<a href="${l}" target="_blank" class="at-link" title="${l}">${l.replace(/^https?:\/\//,'').slice(0,36)}</a>`).join('')
    } else {
      cell.innerHTML = atLinkify(p[field]||'').replace(/\n/g,'<br>')
    }
    cell.classList.remove('at-collapsed')
    if (btn) btn.innerHTML = '<span class="at-expand-icon at-expand-open">▲</span> mniej'
  } else {
    // Zwiń
    if (field === 'tlinks') {
      const links = (p.testnetLinks||'').split('\n').map(l=>l.trim()).filter(Boolean)
      cell.innerHTML = links.slice(0,2).map(l =>
        `<a href="${l}" target="_blank" class="at-link" title="${l}">${l.replace(/^https?:\/\//,'').slice(0,36)}</a>`
      ).join('')
      cell.classList.add('at-collapsed')
      if (btn) btn.innerHTML = `<span class="at-expand-icon">▼</span> +${links.length-2} więcej`
    } else {
      const text = p[field] || ''
      cell.innerHTML = atLinkify(text.slice(0, maxLen)).replace(/\n/g,'<br>') + (text.length > maxLen ? '…' : '')
      cell.classList.add('at-collapsed')
      if (btn) btn.innerHTML = '<span class="at-expand-icon">▼</span> więcej'
    }
  }
}

function exportAtCsv() {
  const headers = ['#','Status','Typ','Projekt','Zadania','Data','Link socjali','Linki testnet','Portfel','Notatka']
  const esc = v => `"${String(v||'').replace(/"/g,'""')}"`
  const rows = Object.values(airdropTasks)
    .filter(p => !p.hidden)
    .sort((a,b) => (b.excelRow||0) - (a.excelRow||0))
    .map(p => [
      p.excelRow||'',
      p.status||'',
      p.type||'',
      p.project||'',
      p.tasks||'',
      p.date||'',
      p.socialLink||'',
      p.testnetLinks||'',
      p.wallet||'',
      p.note||'',
    ].map(esc).join(','))

  const csv  = [headers.map(esc).join(','), ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `projekty_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast('📤 Eksport gotowy ✓')
}

async function duplicateAt(docId) {
  const src = airdropTasks[docId]
  if (!src) return
  const newId  = 'at_' + uid()
  const nextRow = Math.max(0, ...Object.values(airdropTasks).map(p => p.excelRow || 0)) + 1
  const entry  = { ...src, id: newId, excelRow: nextRow, status: 'TODO', addedAt: nowStr() }
  await setDoc(doc(db, 'airdropTasks', newId), entry)
  airdropTasks[newId] = entry
  renderAirdrop(); updateBadges()
  toast('⧉ Zduplikowano projekt ✓')
}

function atSetSort(col) {
  if (atSortCol === col) atSortDir = atSortDir === 'desc' ? 'asc' : 'desc'
  else { atSortCol = col; atSortDir = 'desc' }
  renderAirdrop()
}

async function toggleAtHide(docId) {
  if (!airdropTasks[docId]) return
  const hidden = !airdropTasks[docId].hidden
  airdropTasks[docId].hidden = hidden
  await updateDoc(doc(db, 'airdropTasks', docId), { hidden })
  renderAirdrop()
  toast(hidden ? '🙈 Ukryto wpis' : '👁 Pokazano wpis')
}

async function hideAtSelected() {
  const n = atSelected.size
  if (!n) return
  const ids = [...atSelected]
  await Promise.all(ids.map(id => {
    airdropTasks[id].hidden = true
    return updateDoc(doc(db, 'airdropTasks', id), { hidden: true })
  }))
  atSelected.clear()
  renderAirdrop()
  toast(`🙈 Ukryto ${n} wpisów`)
}

function toggleAtShowHidden() {
  atShowHidden = !atShowHidden
  const btn = document.getElementById('btn-show-hidden')
  if (btn) btn.textContent = atShowHidden ? '🙈 Ukryj schowane' : '👁 Pokaż ukryte'
  renderAirdrop()
}

async function deleteAtSelected() {
  const n = atSelected.size
  if (!n) return
  if (!confirm(`Usunąć ${n} zaznaczonych projektów? Tej operacji nie można cofnąć.`)) return
  const ids = [...atSelected]
  await Promise.all(ids.map(id => deleteDoc(doc(db, 'airdropTasks', id))))
  ids.forEach(id => delete airdropTasks[id])
  atSelected.clear()
  renderAirdrop()
  updateBadges()
  toast(`Usunięto ${n} projektów ✓`)
}

async function setAtStatus(docId, status) {
  if (!airdropTasks[docId]) return
  airdropTasks[docId].status = status
  await updateDoc(doc(db, 'airdropTasks', docId), { status })
  renderAirdrop()
}

async function setAtField(docId, field, value) {
  if (!airdropTasks[docId]) return
  airdropTasks[docId][field] = value
  await updateDoc(doc(db, 'airdropTasks', docId), { [field]: value })
}

async function deleteAt(docId) {
  if (!confirm('Usunąć ten projekt?')) return
  await deleteDoc(doc(db, 'airdropTasks', docId))
  delete airdropTasks[docId]
  renderAirdrop()
  toast('Usunięto ✓')
}

function toggleAtView(v) {
  atView = v
  document.querySelectorAll('.at-view-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === v)
  })
  renderAirdrop()
}

function toggleAtForm(show) {
  const f = document.getElementById('at-form')
  const b = document.getElementById('btn-add-at')
  if (!f || !b) return
  if (show === undefined) show = f.style.display === 'none'
  f.style.display = show ? 'block' : 'none'
  b.textContent   = show ? '✕ Zamknij' : '+ Dodaj projekt'
  if (show) {
    document.getElementById('at-edit-id').value = ''
    ;['at-f-project','at-f-tasks','at-f-date','at-f-social','at-f-testnet','at-f-wallet','at-f-note','at-f-imgurl'].forEach(id => {
      const el = document.getElementById(id)
      if (el) el.value = ''
    })
    const sel = document.getElementById('at-f-status')
    if (sel) sel.value = 'TODO'
    const ty = document.getElementById('at-f-type')
    if (ty) ty.value = ''
    const title = document.getElementById('at-form-title')
    if (title) title.textContent = 'Nowy projekt'
  }
}

function openAtEdit(docId) {
  const p = airdropTasks[docId]
  if (!p) return
  toggleAtForm(true)
  document.getElementById('at-edit-id').value = docId
  document.getElementById('at-f-project').value  = p.project || ''
  document.getElementById('at-f-tasks').value    = p.tasks || ''
  document.getElementById('at-f-date').value     = p.date || ''
  document.getElementById('at-f-social').value   = p.socialLink || ''
  document.getElementById('at-f-testnet').value  = p.testnetLinks || ''
  document.getElementById('at-f-wallet').value   = p.wallet || ''
  document.getElementById('at-f-note').value     = p.note || ''
  document.getElementById('at-f-imgurl').value   = p.imgUrl || ''
  const sel = document.getElementById('at-f-status')
  if (sel) sel.value = p.status || 'TODO'
  const ty = document.getElementById('at-f-type')
  if (ty) ty.value = p.type || ''
  const title = document.getElementById('at-form-title')
  if (title) title.textContent = 'Edytuj projekt'
  document.getElementById('at-form').scrollIntoView({ behavior:'smooth', block:'start' })
}

async function saveAt() {
  const editId  = document.getElementById('at-edit-id').value.trim()
  const project = document.getElementById('at-f-project').value.trim()
  const tasks   = document.getElementById('at-f-tasks').value.trim()
  const date    = document.getElementById('at-f-date').value.trim()
  const social  = document.getElementById('at-f-social').value.trim()
  const testnet = document.getElementById('at-f-testnet').value.trim()
  const wallet  = document.getElementById('at-f-wallet').value.trim()
  const note    = document.getElementById('at-f-note').value.trim()
  const imgUrl  = document.getElementById('at-f-imgurl').value.trim()
  const status  = document.getElementById('at-f-status').value
  const type    = document.getElementById('at-f-type').value

  if (!project && !tasks) { toast('Wpisz nazwę projektu lub zadania!'); return }

  const docId = editId || ('at_' + uid())
  // Nowy wpis — przypisz kolejny numer (max istniejący + 1)
  const nextRow = editId
    ? (airdropTasks[editId]?.excelRow || undefined)
    : (Math.max(0, ...Object.values(airdropTasks).map(p => p.excelRow || 0)) + 1)
  const entry = { id: docId, excelRow: nextRow, status, type, project, tasks, date, socialLink: social, testnetLinks: testnet, wallet, imgUrl, note, addedAt: nowStr() }

  if (editId) {
    entry.addedAt  = airdropTasks[editId]?.addedAt || nowStr()
    entry.excelRow = airdropTasks[editId]?.excelRow || nextRow
  }

  await setDoc(doc(db, 'airdropTasks', docId), entry)
  airdropTasks[docId] = entry
  toggleAtForm(false)
  renderAirdrop()
  toast(editId ? 'Zaktualizowano ✓' : 'Dodano projekt ✓')
}

// Import z .xlsx — używa SheetJS (CDN)
async function importAtXlsx(input) {
  const file = input.files?.[0]
  if (!file) return
  const statusEl = document.getElementById('at-import-status')
  if (statusEl) statusEl.textContent = 'Wczytuję plik...'

  // Lazy-load SheetJS
  if (!window.XLSX) {
    await new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      s.onload = res; s.onerror = rej
      document.head.appendChild(s)
    })
  }

  const reader = new FileReader()
  reader.onload = async e => {
    try {
      const wb   = XLSX.read(e.target.result, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      // Pomiń nagłówek (wiersz 0), importuj od wiersza 1
      let imported = 0
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i]
        // Kolumny: A=status, B=typ, C=projekt, D=zadania, E=data, F=link_socjali, G=linki_testnet, H=portfel, I=notatka
        const project = String(r[2] || '').trim()
        const tasks   = String(r[3] || '').trim()
        if (!project && !tasks) continue // pomiń puste wiersze

        const docId = 'at_' + uid()
        const entry = {
          id: docId,
          excelRow:     i + 1,  // numer wiersza z Excela (wiersz 1 = nagłówek, więc dane od wiersza 2)
          status:       String(r[0] || 'TODO').trim() || 'TODO',
          type:         String(r[1] || '').trim(),
          project,
          tasks,
          date:         String(r[4] || '').trim(),
          socialLink:   String(r[5] || '').trim(),
          testnetLinks: String(r[6] || '').trim(),
          wallet:       String(r[7] || '').trim(),
          note:         String(r[8] || '').trim(),
          imgUrl:       '',
          addedAt:      nowStr(),
        }
        await setDoc(doc(db, 'airdropTasks', docId), entry)
        airdropTasks[docId] = entry
        imported++
      }

      if (statusEl) statusEl.textContent = `✅ Zaimportowano ${imported} wierszy`
      renderAirdrop()
      toast(`Import zakończony: ${imported} projektów ✓`)
    } catch(err) {
      if (statusEl) statusEl.textContent = '❌ Błąd: ' + err.message
      toast('Błąd importu: ' + err.message)
    }
  }
  reader.readAsArrayBuffer(file)
  input.value = '' // resetuj input
}

// ── KONIEC: AIRDROP TASKS ─────────────────────────────────────────

// ── AIRDROP SETTINGS ─────────────────────────────────────────────
async function saveAtConfig() {
  await setDoc(doc(db, 'airdropConfig', 'settings'), {
    statuses: AT_STATUSES,
    types:    AT_TYPES,
  })
}

function renderAtSettings() {
  const el = document.getElementById('sub-ustawienia')
  if (!el) return

  // Zbierz cookies z przeglądarki i pokaż ich nazwy + daty wygaśnięcia
  // Cookies w przeglądarce nie ujawniają expiry przez JS (HttpOnly) —
  // pokazujemy listę dostępnych cookies (non-HttpOnly) oraz info o sesji Firebase
  const cookieList = document.cookie
    ? document.cookie.split(';').map(c => c.trim()).filter(Boolean)
    : []

  el.innerHTML = `
    <div style="max-width:560px;display:flex;flex-direction:column;gap:24px">

      <!-- STATUSY -->
      <div class="form-card">
        <div class="form-title">📋 Statusy projektów</div>
        <div id="at-statuses-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
          ${AT_STATUSES.map((s,i) => `
            <div style="display:flex;gap:6px;align-items:center">
              <input class="form-input" value="${s}" id="ats-${i}" style="flex:1">
              <button class="btn btn-danger" style="padding:4px 10px;font-size:12px;flex-shrink:0" onclick="removeAtStatus(${i})">✕</button>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:6px">
          <input class="form-input" id="ats-new" placeholder="Nowy status..." style="flex:1">
          <button class="btn btn-primary" style="white-space:nowrap" onclick="addAtStatus()">+ Dodaj</button>
        </div>
        <button class="btn btn-primary" style="margin-top:10px;width:100%" onclick="saveAtStatuses()">💾 Zapisz statusy</button>
      </div>

      <!-- TYPY -->
      <div class="form-card">
        <div class="form-title">🏷 Typy projektów</div>
        <div id="at-types-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
          ${AT_TYPES.map((t,i) => `
            <div style="display:flex;gap:6px;align-items:center">
              <input class="form-input" value="${t}" id="att-${i}" style="flex:1">
              <button class="btn btn-danger" style="padding:4px 10px;font-size:12px;flex-shrink:0" onclick="removeAtType(${i})">✕</button>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:6px">
          <input class="form-input" id="att-new" placeholder="Nowy typ..." style="flex:1">
          <button class="btn btn-primary" style="white-space:nowrap" onclick="addAtType()">+ Dodaj</button>
        </div>
        <button class="btn btn-primary" style="margin-top:10px;width:100%" onclick="saveAtTypes()">💾 Zapisz typy</button>
      </div>

      <!-- STATUS API -->
      <div class="form-card">
        <div class="form-title">📡 Status API — limity modeli AI</div>

        <!-- GROQ -->
        <div style="margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
            <div>
              <span style="font-size:13px;font-weight:700;color:var(--text)">Groq</span>
              <span style="font-size:11px;color:var(--text3);margin-left:8px">llama-3.3-70b-versatile (parafraza)</span>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <button class="btn" id="btn-check-groq" onclick="checkGroqStatus()" style="font-size:11px;padding:3px 10px">🔄 Odśwież</button>
              <a href="https://console.groq.com/usage" target="_blank" class="btn" style="font-size:11px;padding:3px 10px">📊 Konsola ↗</a>
            </div>
          </div>
          <div id="api-status-groq" style="background:var(--bg3);padding:10px 12px;border-radius:var(--r);border:1px solid var(--border)">
            <div style="font-size:12px;color:var(--text3)">Brak danych — wygeneruj parafrazę lub kliknij "Sprawdź teraz"</div>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">
            ⚠️ Groq free tier: 30 zapytań/min, 6 000 tokenów/min, 1 000 zapytań/dzień (reset o północy UTC)
          </div>
        </div>

        <!-- Pozostałe — tylko linki -->
        <div style="border-top:1px solid var(--border);padding-top:12px">
          <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px">Pozostałe providery — sprawdź w konsoli:</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            <a href="https://aistudio.google.com/app/apikey" target="_blank" class="btn" style="font-size:11px;padding:4px 12px">🟦 Gemini — AI Studio ↗</a>
            <a href="https://cloud.cerebras.ai/platform" target="_blank" class="btn" style="font-size:11px;padding:4px 12px">🟧 Cerebras ↗</a>
            <a href="https://cloud.sambanova.ai/" target="_blank" class="btn" style="font-size:11px;padding:4px 12px">🟩 SambaNova ↗</a>
            <a href="https://openrouter.ai/activity" target="_blank" class="btn" style="font-size:11px;padding:4px 12px">🟪 OpenRouter ↗</a>
          </div>
        </div>
      </div>

      <!-- COOKIES / SESJA -->
      <div class="form-card">
        <div class="form-title">🍪 Cookies i sesja</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:10px">
          Cookies HttpOnly (w tym auth cookies XParafBota) nie są widoczne przez JavaScript ze względów bezpieczeństwa przeglądarki.
          Poniżej widoczne są tylko cookies dostępne z poziomu JS oraz informacje o aktualnej sesji Firebase.
        </div>

        <div style="margin-bottom:14px">
          <div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Sesja Firebase (Google Auth)</div>
          ${(() => {
            const user = window._currentUser
            if (!user) return '<div style="color:var(--text3);font-size:12px">Brak zalogowanego użytkownika</div>'
            const meta = user.metadata
            const lastSignIn = meta?.lastSignInTime ? new Date(meta.lastSignInTime).toLocaleString('pl-PL') : '—'
            const created   = meta?.creationTime   ? new Date(meta.creationTime).toLocaleString('pl-PL')   : '—'
            return `
              <div style="display:grid;grid-template-columns:140px 1fr;gap:4px 10px;font-size:12px">
                <span style="color:var(--text3)">Email:</span><span style="color:var(--text)">${user.email||'—'}</span>
                <span style="color:var(--text3)">Ostatnie logowanie:</span><span style="color:var(--text)">${lastSignIn}</span>
                <span style="color:var(--text3)">Konto utworzone:</span><span style="color:var(--text)">${created}</span>
                <span style="color:var(--text3)">Token wygasa:</span><span style="color:var(--neon4)">co ~1 godzinę (auto-refresh)</span>
              </div>`
          })()}
        </div>

        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">
            Cookies JS-accessible (${cookieList.length})
          </div>
          ${cookieList.length
            ? `<div style="display:flex;flex-direction:column;gap:3px">
                ${cookieList.map(c => {
                  const name = c.split('=')[0]
                  return `<div style="font-size:11px;font-family:monospace;background:var(--bg3);padding:4px 8px;border-radius:4px;color:var(--text2)">${name}</div>`
                }).join('')}
              </div>`
            : '<div style="font-size:12px;color:var(--text3)">Brak cookies JS-accessible (wszystkie są HttpOnly — to dobrze, znaczy że są chronione).</div>'
          }
          <div style="margin-top:10px;font-size:11px;color:var(--text3);line-height:1.6">
            ⚠️ Cookies XParafBota (Playwright/GraphQL) są przechowywane lokalnie na VPS w pliku
            <code style="background:var(--bg3);padding:1px 5px;border-radius:3px">/root/xparafbot/cookies.json</code>
            lub podobnym. Sprawdź datę modyfikacji tego pliku na VPS żeby ocenić świeżość cookies.
          </div>
        </div>
      </div>

      ${import.meta.env.VITE_VPS_URL ? `
      <!-- MOD 8: OBSERWOWANE KONTA X -->
      <div class="form-card">
        <div class="form-title">📋 Obserwowane konta X</div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px">
          ${vpsAccountsX.length ? vpsAccountsX.map(acc => `
            <div style="display:flex;gap:6px;align-items:center">
              <span style="flex:1;font-size:13px;color:var(--text)">@${acc}</span>
              <button class="btn btn-danger" style="padding:3px 10px;font-size:11px" onclick="vpsRemoveAccountX('${acc}')">✕</button>
            </div>`).join('') : '<div style="font-size:12px;color:var(--text3)">Ładowanie...</div>'}
        </div>
        <div style="display:flex;gap:6px">
          <input id="vps-x-input" class="form-input" placeholder="nowekonto (bez @)" style="flex:1">
          <button class="btn btn-primary" style="white-space:nowrap" onclick="vpsAddAccountX()">+ Dodaj</button>
        </div>
      </div>

      <!-- MOD 8: KANAŁY TG SYGNAŁY -->
      <div class="form-card">
        <div class="form-title">📢 Kanały TG — Sygnały</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Kanały numeryczne wpisuj z prefiksem -100</div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px">
          ${vpsTgSignals.length ? vpsTgSignals.map(ch => `
            <div style="display:flex;gap:6px;align-items:center">
              <span style="flex:1;font-size:13px;color:var(--text);font-family:monospace">${ch}</span>
              <button class="btn btn-danger" style="padding:3px 10px;font-size:11px" onclick="vpsRemoveTg('signals','${ch}')">✕</button>
            </div>`).join('') : '<div style="font-size:12px;color:var(--text3)">Ładowanie...</div>'}
        </div>
        <div style="display:flex;gap:6px">
          <input id="vps-tg-signals-input" class="form-input" placeholder="@kanał lub -100123456789" style="flex:1">
          <button class="btn btn-primary" style="white-space:nowrap" onclick="vpsAddTg('signals')">+ Dodaj</button>
        </div>
      </div>

      <!-- MOD 8: KANAŁY TG WPISY -->
      <div class="form-card">
        <div class="form-title">📢 Kanały TG — Wpisy</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:8px">Kanały numeryczne wpisuj z prefiksem -100</div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px">
          ${vpsTgWpisy.length ? vpsTgWpisy.map(ch => `
            <div style="display:flex;gap:6px;align-items:center">
              <span style="flex:1;font-size:13px;color:var(--text);font-family:monospace">${ch}</span>
              <button class="btn btn-danger" style="padding:3px 10px;font-size:11px" onclick="vpsRemoveTg('wpisy','${ch}')">✕</button>
            </div>`).join('') : '<div style="font-size:12px;color:var(--text3)">Ładowanie...</div>'}
        </div>
        <div style="display:flex;gap:6px">
          <input id="vps-tg-wpisy-input" class="form-input" placeholder="@kanał lub -100123456789" style="flex:1">
          <button class="btn btn-primary" style="white-space:nowrap" onclick="vpsAddTg('wpisy')">+ Dodaj</button>
        </div>
      </div>
      ` : `
      <div class="form-card">
        <div class="form-title">⚙️ Zarządzanie kontami VPS</div>
        <div style="font-size:12px;color:var(--text3)">Aby zarządzać kontami X i kanałami TG, ustaw zmienną <code style="background:var(--bg3);padding:1px 5px;border-radius:3px">VITE_VPS_URL</code> w Vercel.</div>
      </div>
      `}

    </div>`
}

function addAtStatus() {
  const inp = document.getElementById('ats-new')
  const val = inp?.value.trim()
  if (!val) return
  AT_STATUSES.push(val)
  inp.value = ''
  renderAtSettings()
}

function removeAtStatus(i) {
  AT_STATUSES.splice(i, 1)
  renderAtSettings()
}

async function saveAtStatuses() {
  // Zbierz aktualne wartości z inputów (użytkownik mógł edytować)
  AT_STATUSES = AT_STATUSES.map((_,i) => {
    const el = document.getElementById(`ats-${i}`)
    return el ? el.value.trim() : _
  }).filter(Boolean)
  await saveAtConfig()
  renderAtSettings()
  renderAirdrop() // odśwież dropdowny w tabeli
  toast('Statusy zapisane ✓')
}

function addAtType() {
  const inp = document.getElementById('att-new')
  const val = inp?.value.trim()
  if (!val) return
  AT_TYPES.push(val)
  inp.value = ''
  renderAtSettings()
}

function removeAtType(i) {
  AT_TYPES.splice(i, 1)
  renderAtSettings()
}

async function saveAtTypes() {
  AT_TYPES = AT_TYPES.map((_,i) => {
    const el = document.getElementById(`att-${i}`)
    return el ? el.value.trim() : _
  }).filter(Boolean)
  await saveAtConfig()
  renderAtSettings()
  renderAirdrop()
  toast('Typy zapisane ✓')
}

// ── STATYSTYKI ────────────────────────────────────────────────────
function renderStats() {
  const el = document.getElementById('stats-content')
  if (!el) return

  // ── Dane: Wpisy ──
  const allPosts   = Object.values(posts)
  const activePosts = allPosts.filter(p => p.status !== 'Odrzucone' && p.status !== 'Opublikowane')
  const newPosts    = allPosts.filter(p => p.status === 'Nowy')
  const published   = allPosts.filter(p => p.status === 'Opublikowane')
  const rejected    = allPosts.filter(p => p.status === 'Odrzucone')

  // Top konta wg liczby aktywnych wpisów
  const accountCounts = {}
  activePosts.forEach(p => { accountCounts[p.account] = (accountCounts[p.account]||0) + 1 })
  const topAccounts = Object.entries(accountCounts).sort((a,b)=>b[1]-a[1]).slice(0,10)
  const maxAcc = topAccounts[0]?.[1] || 1

  // Wpisy per dzień (ostatnie 14 dni)
  const dayMap = {}
  const today = new Date()
  for (let i=13; i>=0; i--) {
    const d = new Date(today); d.setDate(d.getDate()-i)
    dayMap[d.toISOString().slice(0,10)] = 0
  }
  allPosts.forEach(p => {
    const day = (p.xDate||p.addedAt||'').slice(0,10)
    if (dayMap[day] !== undefined) dayMap[day]++
  })
  const dayEntries = Object.entries(dayMap)
  const maxDay = Math.max(...dayEntries.map(([,v])=>v), 1)

  // ── Dane: Projekty ──
  const allProjects = Object.values(airdropTasks).filter(p => !p.hidden)
  const projTodo    = allProjects.filter(p => (p.status||'').toUpperCase().startsWith('TODO') || !p.status)
  const projDone    = allProjects.filter(p => (p.status||'').toUpperCase().startsWith('DONE'))
  const projSkip    = allProjects.filter(p => p.status === 'Pominięty')

  // Rozkład statusów projektów
  const statusCounts = {}
  allProjects.forEach(p => { const s=p.status||'Brak'; statusCounts[s]=(statusCounts[s]||0)+1 })
  const statusEntries = Object.entries(statusCounts).sort((a,b)=>b[1]-a[1])
  const maxSt = statusEntries[0]?.[1] || 1

  // Typy projektów
  const typeCounts = {}
  allProjects.forEach(p => { const t=p.type||'Brak'; typeCounts[t]=(typeCounts[t]||0)+1 })
  const typeEntries = Object.entries(typeCounts).sort((a,b)=>b[1]-a[1])

  const bar = (val, max, color='var(--neon)') =>
    `<div style="height:6px;border-radius:3px;background:var(--bg3);margin-top:3px">
      <div style="height:6px;border-radius:3px;background:${color};width:${Math.round(val/max*100)}%;transition:width .3s"></div>
    </div>`

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">

      <!-- Wpisy: statsy -->
      <div class="form-card">
        <div class="form-title">📨 Wpisy z X</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
          <div class="stat"><div class="stat-n" style="color:var(--neon)">${activePosts.length}</div><div class="stat-l">Aktywne</div></div>
          <div class="stat"><div class="stat-n" style="color:#f59e0b">${newPosts.length}</div><div class="stat-l">Nowe</div></div>
          <div class="stat"><div class="stat-n" style="color:#10b981">${published.length}</div><div class="stat-l">Opublikowane</div></div>
          <div class="stat"><div class="stat-n" style="color:#ef4444">${rejected.length}</div><div class="stat-l">Odrzucone</div></div>
        </div>
      </div>

      <!-- Projekty: statsy -->
      <div class="form-card">
        <div class="form-title">🪂 Projekty</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
          <div class="stat"><div class="stat-n" style="color:var(--text)">${allProjects.length}</div><div class="stat-l">Wszystkie</div></div>
          <div class="stat"><div class="stat-n" style="color:#f59e0b">${projTodo.length}</div><div class="stat-l">TODO</div></div>
          <div class="stat"><div class="stat-n" style="color:#10b981">${projDone.length}</div><div class="stat-l">DONE</div></div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Pominięte: ${projSkip.length}</div>
        <div style="font-size:11px;color:var(--text3)">Ukryte: ${Object.values(airdropTasks).filter(p=>p.hidden).length}</div>
      </div>

      <!-- Aktywność: wpisy per dzień -->
      <div class="form-card" style="grid-column:span 2">
        <div class="form-title">📅 Aktywność — ostatnie 14 dni</div>
        <div style="display:flex;align-items:flex-end;gap:4px;height:80px;margin-bottom:6px">
          ${dayEntries.map(([day,cnt])=>`
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px" title="${day}: ${cnt} wpisów">
              <div style="font-size:9px;color:var(--text3)">${cnt||''}</div>
              <div style="width:100%;background:var(--neon);border-radius:2px 2px 0 0;opacity:.85;height:${Math.max(2,Math.round(cnt/maxDay*60))}px"></div>
            </div>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3)">
          <span>${dayEntries[0]?.[0]?.slice(5)}</span>
          <span>${dayEntries[dayEntries.length-1]?.[0]?.slice(5)}</span>
        </div>
      </div>

      <!-- Top konta -->
      <div class="form-card">
        <div class="form-title">👤 Top konta (aktywne wpisy)</div>
        ${topAccounts.map(([acc,cnt])=>`
          <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:var(--text)">@${acc}</span>
              <span style="color:var(--neon);font-weight:700">${cnt}</span>
            </div>
            ${bar(cnt, maxAcc)}
          </div>`).join('')}
      </div>

      <!-- Rozkład statusów projektów -->
      <div class="form-card">
        <div class="form-title">📋 Statusy projektów</div>
        ${statusEntries.map(([st,cnt])=>`
          <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:var(--text)">${st}</span>
              <span style="color:var(--neon4);font-weight:700">${cnt}</span>
            </div>
            ${bar(cnt, maxSt, (st.toUpperCase().startsWith('DONE')?'#10b981':st.toUpperCase().startsWith('TODO')?'#f59e0b':st==='Pominięty'?'#ef4444':'var(--neon)'))}
          </div>`).join('')}
      </div>

      <!-- Typy projektów -->
      <div class="form-card">
        <div class="form-title">🏷 Typy projektów</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${typeEntries.map(([t,cnt])=>`
            <div style="display:flex;align-items:center;gap:5px;background:var(--bg3);padding:5px 10px;border-radius:8px">
              <span style="font-size:12px;color:var(--text)">${t}</span>
              <span style="font-size:13px;font-weight:700;color:var(--neon)">${cnt}</span>
            </div>`).join('')}
        </div>
      </div>

    </div>`
}

// ── ARCHIWUM PROJEKTÓW ───────────────────────────────────────────
function renderArchProjekty() {
  const el = document.getElementById('archp-content')
  if (!el) return

  const hidden = Object.entries(airdropTasks)
    .filter(([,p]) => p.hidden)
    .sort(([,a],[,b]) => (b.excelRow||0) - (a.excelRow||0))

  // Statystyki ukrytych
  const byType   = {}
  const byStatus = {}
  hidden.forEach(([,p]) => {
    const t = p.type   || 'Brak'; byType[t]   = (byType[t]  ||0)+1
    const s = p.status || 'Brak'; byStatus[s] = (byStatus[s]||0)+1
  })

  if (!hidden.length) {
    el.innerHTML = '<div class="empty">Brak ukrytych projektów.</div>'
    return
  }

  el.innerHTML = `
    <!-- Statystyki -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:16px">
      <div class="form-card" style="padding:12px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:8px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Ukryte łącznie</div>
        <div style="font-size:28px;font-weight:700;color:var(--neon)">${hidden.length}</div>
      </div>
      <div class="form-card" style="padding:12px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Typy</div>
        ${Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([t,n])=>
          `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
            <span style="color:var(--text2)">${t}</span><span style="color:var(--neon);font-weight:700">${n}</span>
          </div>`).join('')}
      </div>
      <div class="form-card" style="padding:12px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Statusy</div>
        ${Object.entries(byStatus).sort((a,b)=>b[1]-a[1]).map(([s,n])=>
          `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
            <span style="color:var(--text2)">${s}</span><span style="color:var(--neon4);font-weight:700">${n}</span>
          </div>`).join('')}
      </div>
    </div>

    <!-- Akcje masowe -->
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-primary" onclick="restoreAllArchP()">👁 Przywróć wszystkie (${hidden.length})</button>
      <button class="btn btn-danger"  onclick="deleteAllArchP()">🗑 Usuń wszystkie na stałe</button>
    </div>

    <!-- Lista -->
    <div style="display:flex;flex-direction:column;gap:8px">
      ${hidden.map(([docId, p]) => `
        <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:var(--r);padding:10px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;opacity:.75">
          <span style="font-size:11px;color:var(--text3);min-width:36px;font-weight:700">#${p.excelRow||'—'}</span>
          <span style="font-weight:700;color:var(--text);flex:1;min-width:100px">${p.project||'(brak nazwy)'}</span>
          ${p.type   ? `<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid rgba(124,58,237,.3);font-weight:700">${p.type}</span>` : ''}
          ${p.status ? `<span style="font-size:10px;padding:2px 7px;border-radius:4px;font-weight:700;${atStatusStyle(p.status)}">${p.status}</span>` : ''}
          <div style="display:flex;gap:6px;margin-left:auto">
            <button class="btn btn-primary" style="font-size:11px;padding:3px 10px" onclick="restoreArchP('${docId}')">👁 Przywróć</button>
            <button class="btn btn-danger"  style="font-size:11px;padding:3px 10px" onclick="deleteArchP('${docId}')">🗑 Usuń</button>
          </div>
        </div>`).join('')}
    </div>`
}

async function restoreArchP(docId) {
  if (!airdropTasks[docId]) return
  airdropTasks[docId].hidden = false
  await updateDoc(doc(db, 'airdropTasks', docId), { hidden: false })
  renderArchProjekty(); updateBadges()
  toast('👁 Przywrócono projekt ✓')
}

async function deleteArchP(docId) {
  if (!confirm('Usunąć projekt na stałe?')) return
  await deleteDoc(doc(db, 'airdropTasks', docId))
  delete airdropTasks[docId]
  renderArchProjekty(); updateBadges()
  toast('Usunięto ✓')
}

async function restoreAllArchP() {
  const hidden = Object.entries(airdropTasks).filter(([,p]) => p.hidden)
  if (!hidden.length) return
  await Promise.all(hidden.map(([id]) => {
    airdropTasks[id].hidden = false
    return updateDoc(doc(db, 'airdropTasks', id), { hidden: false })
  }))
  renderArchProjekty(); updateBadges()
  toast(`👁 Przywrócono ${hidden.length} projektów ✓`)
}

async function deleteAllArchP() {
  const hidden = Object.entries(airdropTasks).filter(([,p]) => p.hidden)
  if (!hidden.length) return
  if (!confirm(`Usunąć na stałe ${hidden.length} ukrytych projektów? Tej operacji nie można cofnąć.`)) return
  await Promise.all(hidden.map(([id]) => deleteDoc(doc(db, 'airdropTasks', id))))
  hidden.forEach(([id]) => delete airdropTasks[id])
  renderArchProjekty(); updateBadges()
  toast(`Usunięto ${hidden.length} projektów ✓`)
}

// ── AI TOOLS ─────────────────────────────────────────────────────
const AI_CATEGORIES = ['Tekst','Obraz','Wideo','Audio','Kod','Analiza','Crypto/Web3','Inne']

let aiToolSearch = ''
let aiToolCat    = ''
let aiToolFree   = ''
let aiToolEditId = ''

function renderAiTools() {
  const el = document.getElementById('page-aitools')
  if (!el) return

  const searchEl = document.getElementById('ait-search')
  const catEl    = document.getElementById('ait-cat')
  const freeEl   = document.getElementById('ait-free')
  if (searchEl) aiToolSearch = searchEl.value.toLowerCase()
  if (catEl)    aiToolCat    = catEl.value
  if (freeEl)   aiToolFree   = freeEl.value

  const list = Object.entries(aiTools).filter(([,t]) => {
    if (aiToolCat  && t.category !== aiToolCat) return false
    if (aiToolFree === 'tak'  && !t.free) return false
    if (aiToolFree === 'nie'  &&  t.free) return false
    if (aiToolSearch) {
      const hay = [t.name, t.desc, t.tags, t.category].join(' ').toLowerCase()
      if (!hay.includes(aiToolSearch)) return false
    }
    return true
  }).sort(([,a],[,b]) => (b.addedAt||'').localeCompare(a.addedAt||''))

  const formEl = document.getElementById('ait-form')
  const cards  = document.getElementById('ait-cards')
  if (!cards) return

  if (!list.length) {
    cards.innerHTML = '<div class="empty">Brak narzędzi. Dodaj pierwsze!</div>'
    return
  }

  cards.innerHTML = list.map(([docId, t]) => `
    <div class="form-card" style="position:relative">
      <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
            <span style="font-size:15px;font-weight:700;color:var(--text)">${t.name}</span>
            <span style="font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(0,229,255,.1);color:var(--neon);border:1px solid rgba(0,229,255,.2);font-weight:700">${t.category||'Inne'}</span>
            <span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700;${t.free ? 'background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.25)' : 'background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.2)'}">${t.free ? '✓ Darmowe' : '$ Płatne'}</span>
            ${t.rating ? `<span style="font-size:12px;color:#f59e0b">${'★'.repeat(Math.min(5,t.rating))}${'☆'.repeat(5-Math.min(5,t.rating))}</span>` : ''}
          </div>
          <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:8px">${(t.desc||'').replace(/\n/g,'<br>')}</div>
          ${t.tags ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${t.tags.split(',').map(tag=>`<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:var(--bg3);color:var(--text3);border:1px solid var(--border)">${tag.trim()}</span>`).join('')}</div>` : ''}
          ${t.url ? `<a href="${t.url}" target="_blank" style="font-size:12px;color:var(--neon);text-decoration:none">🔗 ${t.url.replace(/^https?:\/\//,'').slice(0,50)}</a>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn" style="font-size:11px;padding:3px 8px" onclick="openAitEdit('${docId}')">✏️</button>
          <button class="btn btn-danger" style="font-size:11px;padding:3px 8px" onclick="deleteAiTool('${docId}')">✕</button>
        </div>
      </div>
    </div>`).join('')
}

function toggleAitForm(show) {
  const f = document.getElementById('ait-form')
  const b = document.getElementById('btn-add-ait')
  if (!f || !b) return
  if (show === undefined) show = f.style.display === 'none'
  f.style.display = show ? 'block' : 'none'
  b.textContent   = show ? '✕ Zamknij' : '+ Dodaj narzędzie'
  if (show && !aiToolEditId) {
    ;['ait-f-name','ait-f-desc','ait-f-url','ait-f-tags'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = ''
    })
    const cat = document.getElementById('ait-f-cat'); if (cat) cat.value = ''
    const fr  = document.getElementById('ait-f-free'); if (fr) fr.checked = true
    const rt  = document.getElementById('ait-f-rating'); if (rt) rt.value = '0'
    const tit = document.getElementById('ait-form-title'); if (tit) tit.textContent = 'Nowe narzędzie AI'
    aiToolEditId = ''
  }
}

function openAitEdit(docId) {
  const t = aiTools[docId]
  if (!t) return
  aiToolEditId = docId
  toggleAitForm(true)
  document.getElementById('ait-f-name').value  = t.name    || ''
  document.getElementById('ait-f-desc').value  = t.desc    || ''
  document.getElementById('ait-f-url').value   = t.url     || ''
  document.getElementById('ait-f-tags').value  = t.tags    || ''
  document.getElementById('ait-f-cat').value   = t.category|| ''
  document.getElementById('ait-f-free').checked = !!t.free
  document.getElementById('ait-f-rating').value = t.rating || '0'
  const tit = document.getElementById('ait-form-title'); if (tit) tit.textContent = 'Edytuj narzędzie'
  document.getElementById('ait-form').scrollIntoView({ behavior:'smooth', block:'start' })
}

async function saveAiTool() {
  const name = document.getElementById('ait-f-name')?.value.trim()
  if (!name) { toast('Podaj nazwę narzędzia!'); return }
  const docId = aiToolEditId || ('ait_' + uid())
  const entry = {
    id:       docId,
    name,
    desc:     document.getElementById('ait-f-desc')?.value.trim()    || '',
    url:      document.getElementById('ait-f-url')?.value.trim()     || '',
    tags:     document.getElementById('ait-f-tags')?.value.trim()    || '',
    category: document.getElementById('ait-f-cat')?.value            || 'Inne',
    free:     document.getElementById('ait-f-free')?.checked         ?? true,
    rating:   parseInt(document.getElementById('ait-f-rating')?.value)|| 0,
    addedAt:  aiToolEditId ? (aiTools[aiToolEditId]?.addedAt || nowStr()) : nowStr(),
  }
  await setDoc(doc(db, 'aiTools', docId), entry)
  aiTools[docId] = entry
  aiToolEditId = ''
  toggleAitForm(false)
  renderAiTools()
  toast(aiToolEditId ? 'Zaktualizowano ✓' : 'Dodano narzędzie ✓')
}

async function deleteAiTool(docId) {
  if (!confirm('Usunąć to narzędzie?')) return
  await deleteDoc(doc(db, 'aiTools', docId))
  delete aiTools[docId]
  renderAiTools()
  toast('Usunięto ✓')
}

// ── ZDJĘCIE → TEKST (Gemini Vision + Groq fallback) ──────────────
const IMAGE_PROMPT = `Przepisz DOKŁADNIE cały tekst widoczny na tym zdjęciu/screenshocie.
Zachowaj:
- oryginalne formatowanie (nowe linie, akapity, odstępy)
- wszystkie emoji, symbole, znaki specjalne
- oryginalną kolejność elementów
- wszystkie linki URL jeśli są widoczne
NIE dodawaj żadnych komentarzy ani opisów od siebie. Przepisz tylko sam tekst.`

async function extractTextFromImage(input) {
  const file = input.files?.[0]
  if (!file) return
  const statusEl = document.getElementById('img-extract-status')
  const btn      = document.getElementById('btn-img-extract')
  if (statusEl) statusEl.textContent = '⏳ Analizuję zdjęcie...'
  if (btn)      btn.disabled = true

  try {
    // Kompresuj obraz przed wysłaniem (max 1280px, jakość 85%)
    const base64 = await new Promise((res, rej) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const MAX = 1280
        let w = img.width, h = img.height
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX }
          else       { w = Math.round(w * MAX / h); h = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        res(dataUrl.split(',')[1])
      }
      img.onerror = rej
      img.src = url
    })
    const mimeType = 'image/jpeg' // zawsze jpeg po kompresji
    let text = ''

    // 1. Próbuj Gemini Vision
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (geminiKey) {
      try {
        if (statusEl) statusEl.textContent = '⏳ Gemini analizuje...'
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [
                { text: IMAGE_PROMPT },
                { inline_data: { mime_type: mimeType, data: base64 } }
              ]}]
            })
          }
        )
        if (res.status === 429) throw new Error('RATE_LIMIT')
        if (!res.ok) throw new Error('API_ERROR_' + res.status)
        const data = await res.json()
        text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } catch(e) {
        if (e.message === 'RATE_LIMIT') {
          console.warn('[Vision] Gemini rate limit — próbuję Groq...')
        } else { throw e }
      }
    }

    // 2. Fallback: Groq Vision
    if (!text.trim()) {
      const groqKey = import.meta.env.VITE_GROQ_API_KEY
      if (!groqKey) throw new Error('Brak kluczy API (Gemini/Groq). Dodaj klucze w Vercel.')
      if (statusEl) statusEl.textContent = '⏳ Groq analizuje...'
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: IMAGE_PROMPT },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
            ]
          }]
        })
      })
      if (res.status === 429) { trackGroq429(62); throw new Error('Oba modele wyczerpały limity. Spróbuj za chwilę.') }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(`Groq Vision error: ${res.status} — ${errBody?.error?.message || JSON.stringify(errBody)}`)
      }
      const data = await res.json()
      const visionToks = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0)
      trackGroqCall(visionToks)
      text = data.choices?.[0]?.message?.content || ''
    }

    if (!text.trim()) { toast('Nie udało się odczytać tekstu ze zdjęcia'); return }

    // Zapisz jako szkic do manualDrafts
    const docId = 'mdraft_' + uid()
    const entry = { id: docId, text: text.trim(), account: '', xLink: '', note: '', addedAt: nowStr(), fromImage: true }
    await setDoc(doc(db, 'manualDrafts', docId), entry)
    manualDrafts[docId] = entry
    renderManualDrafts()
    updateManualDraftsBadge()

    if (statusEl) statusEl.textContent = '✅ Szkic zapisany!'
    setTimeout(() => { if (statusEl) statusEl.textContent = '' }, 3000)
    toast('📸 Tekst ze zdjęcia zapisany jako szkic ✓')
  } catch(e) {
    console.error('[extractTextFromImage]', e)
    if (statusEl) statusEl.textContent = '❌ ' + e.message
    toast('Błąd: ' + e.message)
  } finally {
    if (btn) btn.disabled = false
    input.value = ''
  }
}

// ── MANUAL DRAFTS ─────────────────────────────────────────────────
function updateManualDraftsBadge() {
  const n = Object.keys(manualDrafts).length
  const b = document.getElementById('manual-drafts-badge')
  if (b) { b.textContent = n; b.style.display = n > 0 ? 'inline-block' : 'none' }
}

function renderManualDrafts() {
  const el = document.getElementById('manual-drafts-list')
  if (!el) return
  const list = Object.entries(manualDrafts)
    .sort(([,a],[,b]) => (b.addedAt||'').localeCompare(a.addedAt||''))
  updateManualDraftsBadge()
  if (!list.length) {
    el.innerHTML = '<div class="empty" style="margin-top:8px">Brak szkiców. Dodaj zdjęcie lub utwórz szkic ręcznie.</div>'
    return
  }
  el.innerHTML = list.map(([docId, d]) => {
    const editing = !!d._editing
    return `
    <div class="form-card" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="font-size:11px;color:var(--text3)">📅 ${d.addedAt||''}</span>
        ${d.fromImage ? '<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:rgba(0,229,255,.1);color:var(--neon);border:1px solid rgba(0,229,255,.2)">📸 Ze zdjęcia</span>' : ''}
        <div style="display:flex;gap:4px;margin-left:auto;flex-wrap:wrap">
          ${editing
            ? `<button class="btn btn-primary" style="font-size:11px;padding:3px 8px" onclick="saveDraftEdit('${docId}')">💾 Zapisz</button>
               <button class="btn" style="font-size:11px;padding:3px 8px" onclick="cancelDraftEdit('${docId}')">Anuluj</button>`
            : `<button class="btn" style="font-size:11px;padding:3px 8px" onclick="startDraftEdit('${docId}')">✏️ Edytuj</button>`
          }
          <button class="btn btn-success" style="font-size:11px;padding:3px 8px;white-space:nowrap" onclick="sendDraftToWpisy('${docId}')">✉ Wyślij do Wpisów</button>
          <button class="btn btn-danger" style="font-size:11px;padding:3px 8px" onclick="deleteDraft('${docId}')">✕</button>
        </div>
      </div>
      ${editing ? `
        <div style="display:flex;flex-direction:column;gap:8px">
          <textarea class="form-textarea" id="draft-text-${docId}" style="min-height:100px;white-space:pre-wrap">${d.text||''}</textarea>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <input class="form-input" id="draft-account-${docId}" placeholder="Konto / źródło (bez @)" value="${d.account||''}">
            <input class="form-input" id="draft-link-${docId}" placeholder="Link (opcjonalnie)" value="${d.xLink||''}">
          </div>
          <input class="form-input" id="draft-note-${docId}" placeholder="Notatka (opcjonalnie)" value="${d.note||''}">
        </div>` : `
        <div style="font-size:13px;color:var(--text2);line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:120px;overflow:hidden" id="draft-preview-${docId}">${d.text||''}</div>
        ${(d.text||'').length > 300 ? `<button class="at-expand-btn" onclick="toggleDraftPreview('${docId}')"><span class="at-expand-icon">▼</span> więcej</button>` : ''}
        ${d.account ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">@${d.account}</div>` : ''}
      `}
    </div>`
  }).join('')
}

function startDraftEdit(docId)  { if (manualDrafts[docId]) { manualDrafts[docId]._editing = true;  renderManualDrafts() } }
function cancelDraftEdit(docId) { if (manualDrafts[docId]) { manualDrafts[docId]._editing = false; renderManualDrafts() } }

async function saveDraftEdit(docId) {
  const d = manualDrafts[docId]; if (!d) return
  d.text    = document.getElementById(`draft-text-${docId}`)?.value    || ''
  d.account = document.getElementById(`draft-account-${docId}`)?.value.trim() || ''
  d.xLink   = document.getElementById(`draft-link-${docId}`)?.value.trim()    || ''
  d.note    = document.getElementById(`draft-note-${docId}`)?.value.trim()    || ''
  d._editing = false
  const save = {...d}; delete save._editing
  await setDoc(doc(db, 'manualDrafts', docId), save)
  renderManualDrafts()
  toast('Szkic zaktualizowany ✓')
}

async function sendDraftToWpisy(docId) {
  const d = manualDrafts[docId]; if (!d) return
  if (!d.text?.trim()) { toast('Szkic nie ma treści!'); return }
  const id  = 'manual_' + uid()
  const now = nowStr()
  const post = {
    id, account: d.account || 'ręczny',
    xDate: now, xLink: d.xLink || '',
    text: d.text.trim(),
    links: [], imgs: [], isRT: false,
    para: '', note: d.note || '',
    status: 'Nowy', addedAt: now, manualEntry: true
  }
  await setDoc(doc(db, 'posts', id), post)
  posts[id] = post
  await deleteDoc(doc(db, 'manualDrafts', docId))
  delete manualDrafts[docId]
  renderManualDrafts()
  renderMain(); updateStats(); updateBadges()
  toast('✉ Wysłano do Wpisów ✓')
}

async function deleteDraft(docId) {
  if (!confirm('Usunąć ten szkic?')) return
  await deleteDoc(doc(db, 'manualDrafts', docId))
  delete manualDrafts[docId]
  renderManualDrafts()
  toast('Usunięto szkic ✓')
}

function toggleDraftPreview(docId) {
  const el  = document.getElementById(`draft-preview-${docId}`)
  const btn = el?.nextElementSibling
  if (!el) return
  const collapsed = el.style.maxHeight !== 'none'
  el.style.maxHeight = collapsed ? 'none' : '120px'
  if (btn) btn.innerHTML = collapsed
    ? '<span class="at-expand-icon">▲</span> mniej'
    : '<span class="at-expand-icon">▼</span> więcej'
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
      <button class="tab"        data-tab="notatki" onclick="switchTab('notatki')">Notatki <span class="tab-badge" id="tab-notes-badge">0</span></button>
      <button class="tab"        data-tab="ref"     onclick="switchTab('ref')">Linki ref <span class="tab-badge" id="tab-ref-badge">0</span></button>
      <button class="tab"        data-tab="konta"   onclick="switchTab('konta')">👤 Konta <span class="tab-badge" id="tab-konta-badge" style="background:rgba(16,185,129,.2);color:#10b981">0</span></button>
      <button class="tab"        data-tab="manual"  onclick="switchTab('manual')">✍ Dodaj ręcznie</button>
      <button class="tab"        data-tab="airdrop" onclick="switchTab('airdrop')">🪂 Projekty <span class="tab-badge" id="tab-airdrop-badge" style="background:rgba(124,58,237,.2);color:#a78bfa">0</span></button>
      <button class="tab"        data-tab="stats"   onclick="switchTab('stats')">📊 Statystyki</button>
      <button class="tab"        data-tab="aitools" onclick="switchTab('aitools')">🤖 AI</button>
      <button class="tab"        data-tab="wiecej"  onclick="switchTab('wiecej')">Więcej ▾ <span class="tab-badge" id="tab-wiecej-badge" style="background:rgba(245,158,11,.2);color:#f59e0b">0</span></button>
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
          <option>Nowy</option><option>ZROBIĆ</option><option>Do zrobienia</option><option>W toku</option>
        </select>
        <select id="f-type" onchange="renderMain()">
          <option value="">Posty i RT</option>
          <option value="post">Tylko posty</option>
          <option value="rt">Tylko RT</option>
        </select>
        <input id="f-search" placeholder="Szukaj w treści..." oninput="renderMain()" style="flex:1;min-width:140px">
        <input id="f-exclude" placeholder="🚫 Wyklucz słowa..." oninput="renderMain()" style="flex:1;min-width:140px">
        <select id="f-exclude-mode" onchange="renderMain()" title="Tryb wykluczania słów">
          <option value="any">LUB</option>
          <option value="all">I</option>
        </select>
      </div>
      <!-- Przycisk panelu szybkiego przeglądu -->
      <div style="margin-bottom:8px">
        <button id="btn-filter-panel" onclick="toggleFilterPanel()" class="btn" style="font-size:12px;padding:5px 12px">🔍 Szybki przegląd ▼</button>
      </div>

      <!-- Panel szybkiego przeglądu -->
      <div id="main-filter-panel" style="display:none;margin-bottom:12px;padding:14px;background:var(--bg2);border:1px solid var(--border2);border-radius:var(--rl)">
        <div style="font-size:12px;font-weight:700;color:var(--neon);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em">🔍 Szybki przegląd — filtry zaawansowane</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:12px">

          <!-- Min. linie -->
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:3px">Min. linii</div>
            <input id="f-min-lines" type="number" min="1" max="50" placeholder="np. 10"
              oninput="renderMain()"
              style="width:80px;padding:5px 8px;border:1px solid var(--border2);border-radius:var(--r);background:var(--bg3);color:var(--text);font-size:13px">
          </div>

          <!-- Maks. linie -->
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:3px">Maks. linii</div>
            <input id="f-max-lines" type="number" min="1" max="50" placeholder="np. 3"
              oninput="renderMain()"
              style="width:80px;padding:5px 8px;border:1px solid var(--border2);border-radius:var(--r);background:var(--bg3);color:var(--text);font-size:13px">
          </div>

          <!-- Maks. znaki -->
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:3px">Maks. znaków</div>
            <input id="f-max-chars" type="number" min="1" placeholder="np. 200"
              oninput="renderMain()"
              style="width:90px;padding:5px 8px;border:1px solid var(--border2);border-radius:var(--r);background:var(--bg3);color:var(--text);font-size:13px">
          </div>

          <!-- Starsze niż X dni -->
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:3px">Starsze niż (dni)</div>
            <input id="f-older-days" type="number" min="1" placeholder="np. 7"
              oninput="renderMain()"
              style="width:90px;padding:5px 8px;border:1px solid var(--border2);border-radius:var(--r);background:var(--bg3);color:var(--text);font-size:13px">
          </div>

          <!-- Szybkie przyciski dat -->
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:3px">Szybka data</div>
            <div style="display:flex;gap:4px">
              <button id="fdb-today" class="btn f-date-btn" onclick="setDateFilter('today')" style="font-size:11px;padding:4px 8px;white-space:nowrap">Dziś</button>
              <button id="fdb-yesterday" class="btn f-date-btn" onclick="setDateFilter('yesterday')" style="font-size:11px;padding:4px 8px;white-space:nowrap">Wczoraj+dziś</button>
              <button id="fdb-week" class="btn f-date-btn" onclick="setDateFilter('week')" style="font-size:11px;padding:4px 8px;white-space:nowrap">Ten tydzień</button>
            </div>
          </div>

          <!-- Data od/do ręcznie -->
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:3px">Data od</div>
            <input id="f-date-from" type="date" onchange="renderMain()"
              style="padding:5px 8px;border:1px solid var(--border2);border-radius:var(--r);background:var(--bg3);color:var(--text);font-size:13px">
          </div>
          <div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:3px">Data do</div>
            <input id="f-date-to" type="date" onchange="renderMain()"
              style="padding:5px 8px;border:1px solid var(--border2);border-radius:var(--r);background:var(--bg3);color:var(--text);font-size:13px">
          </div>

          <!-- Checkboxy -->
          <div style="display:flex;flex-direction:column;gap:6px;padding-bottom:2px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text2)">
              <input type="checkbox" id="f-no-links" onchange="renderMain()" style="width:14px;height:14px;accent-color:var(--neon);cursor:pointer">
              Tylko bez linków
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text2)">
              <input type="checkbox" id="f-no-media" onchange="renderMain()" style="width:14px;height:14px;accent-color:var(--neon);cursor:pointer">
              Tylko bez mediów
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text2)">
              <input type="checkbox" id="f-dupes" onchange="renderMain()" style="width:14px;height:14px;accent-color:var(--neon4);cursor:pointer">
              <span style="color:#f59e0b">Tylko duplikaty</span>
            </label>
          </div>

        </div>

        <!-- Akcje masowe -->
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:10px">
          <span id="main-panel-count" style="font-size:12px;color:var(--text3)"></span>
          <button class="btn btn-primary" onclick="selectAllVisible()" style="font-size:12px;padding:5px 14px;white-space:nowrap">
            ☑ Zaznacz wszystkie widoczne
          </button>
          <button class="btn" onclick="resetFilterPanel()" style="font-size:12px;padding:5px 14px;white-space:nowrap">
            ✕ Wyczyść filtry panelu
          </button>
        </div>
      </div>

      <!-- Bulk bar — pojawia się gdy zaznaczone wpisy -->
      <div id="main-bulk-bar" style="display:none;align-items:center;gap:8px;padding:9px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:var(--r);margin-bottom:10px;flex-wrap:wrap">
        <span id="main-bulk-count" style="font-size:13px;font-weight:700;color:var(--neon4)"></span>
        <button class="btn btn-danger" style="font-size:12px;padding:5px 12px;white-space:nowrap" onclick="deleteMainSelected()">Odrzuć zaznaczone</button>
        <button class="btn" style="font-size:12px;padding:5px 12px;white-space:nowrap" onclick="mainSelected.clear();updateMainBulkBar();renderMain()">✕ Odznacz</button>
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

    <!-- DODAJ RĘCZNIE -->
    <div id="page-manual" class="page">
      <div class="section-header">
        <span style="font-size:13px;color:var(--text2)">Dodaj post ręcznie — pojawi się w zakładce Wpisy</span>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <label class="btn btn-primary" style="cursor:pointer;position:relative;white-space:nowrap" id="btn-img-extract">
            📸 Dodaj ze zdjęcia
            <input type="file" accept="image/*" style="position:absolute;inset:0;opacity:0;cursor:pointer" onchange="extractTextFromImage(this)">
          </label>
          <span id="img-extract-status" style="font-size:12px;color:var(--neon)"></span>
          <button class="btn-add" id="btn-add-manual" onclick="toggleManualForm()">+ Dodaj ręcznie</button>
        </div>
      </div>
      <div id="manual-form" style="display:none">
        <div class="form-card">
          <div class="form-title">Nowy post ręczny</div>
          <div class="form-row full">
            <div>
              <div class="form-label">Treść posta *</div>
              <textarea class="form-textarea" id="manual-text" style="min-height:120px" placeholder="Wklej lub wpisz treść posta..."></textarea>
            </div>
          </div>
          <div class="form-row">
            <div>
              <div class="form-label">Konto / źródło</div>
              <input class="form-input" id="manual-account" placeholder="np. elonmusk (bez @)">
            </div>
            <div>
              <div class="form-label">Data posta</div>
              <input class="form-input" type="datetime-local" id="manual-date">
            </div>
          </div>
          <div class="form-row">
            <div>
              <div class="form-label">Link do posta (opcjonalnie)</div>
              <input class="form-input" id="manual-link" placeholder="https://x.com/...">
            </div>
            <div>
              <div class="form-label">Notatka</div>
              <input class="form-input" id="manual-note" placeholder="np. źródło, kontekst...">
            </div>
          </div>
          <div class="form-btns">
            <button class="btn btn-primary" onclick="addManualPost()">Dodaj do Wpisów</button>
            <button class="btn" onclick="toggleManualForm(false)">Anuluj</button>
          </div>
        </div>
      </div>
      <div style="margin-top:20px">
        <!-- MOD 4: Import z linku X -->
        <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:var(--rl);padding:14px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:var(--neon);margin-bottom:10px">📥 Importuj wpis z X</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input id="import-x-url" class="form-input" style="flex:1;min-width:200px" placeholder="https://x.com/user/status/...">
            <button id="btn-import-x" class="btn btn-primary" style="white-space:nowrap" onclick="importFromX()">📥 Pobierz z X</button>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:6px">Wpis zostanie pobrany przez VPS i pojawi się bezpośrednio w zakładce Wpisy.</div>
        </div>

        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <span style="font-size:14px;font-weight:700;color:var(--text)">Szkice</span>
          <span id="manual-drafts-badge" style="display:none;font-size:11px;padding:1px 7px;border-radius:8px;background:rgba(0,229,255,.12);color:var(--neon);border:1px solid rgba(0,229,255,.25);font-weight:700">0</span>
          <span style="font-size:12px;color:var(--text3)">— wpisy ze zdjęć czekające na wysłanie do Wpisów</span>
        </div>
        <div id="manual-drafts-list"></div>
      </div>
    </div>

    <!-- PROJEKTY AIRDROP/TESTNET -->
    <div id="page-airdrop" class="page">
      <div class="at-page-inner">
      <!-- Statystyki -->
      <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:14px">
        <div class="stat"><div class="stat-n" id="at-stats-all"  style="color:var(--text)">0</div><div class="stat-l">Wszystkich</div></div>
        <div class="stat"><div class="stat-n" id="at-stats-todo" style="color:var(--neon4)">0</div><div class="stat-l">TODO</div></div>
        <div class="stat"><div class="stat-n" id="at-stats-done" style="color:var(--neon3)">0</div><div class="stat-l">DONE</div></div>
      </div>

      <!-- Pasek narzędzi -->
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary" id="btn-add-at" onclick="toggleAtForm()" style="white-space:nowrap">+ Dodaj projekt</button>
        <div style="display:flex;gap:0;border:1px solid var(--border2);border-radius:var(--r);overflow:hidden;flex-shrink:0">
          <button class="at-view-btn active" data-view="table" onclick="toggleAtView('table')" style="padding:5px 12px;font-size:12px;border:none;background:var(--bg3);color:var(--text);cursor:pointer;font-family:inherit;white-space:nowrap">☰ Tabela</button>
          <button class="at-view-btn" data-view="cards" onclick="toggleAtView('cards')" style="padding:5px 12px;font-size:12px;border:none;background:transparent;color:var(--text2);cursor:pointer;font-family:inherit;white-space:nowrap;border-left:1px solid var(--border2)">▦ Karty</button>
        </div>
        <button class="btn" id="btn-show-hidden" onclick="toggleAtShowHidden()" style="white-space:nowrap">👁 Pokaż ukryte</button>
        <label class="btn" style="cursor:pointer;position:relative;white-space:nowrap;flex-shrink:0">
          📥 Import .xlsx
          <input type="file" accept=".xlsx,.xls" style="position:absolute;inset:0;opacity:0;cursor:pointer" onchange="importAtXlsx(this)">
        </label>
        <button class="btn" style="white-space:nowrap" onclick="exportAtCsv()">📤 Eksport CSV</button>
        <span id="at-import-status" style="font-size:12px;color:var(--text3)"></span>
      </div>

      <!-- Pasek masowych akcji (pojawia się gdy coś zaznaczone) -->
      <div id="at-bulk-bar" style="display:none;align-items:center;gap:8px;padding:9px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:var(--r);margin-bottom:10px;flex-wrap:wrap">
        <span id="at-bulk-count" style="font-size:13px;font-weight:700;color:var(--neon4)"></span>
        <button class="btn btn-info" style="font-size:12px;padding:5px 12px;white-space:nowrap" onclick="hideAtSelected()">🙈 Ukryj zaznaczone</button>
        <button class="btn btn-danger" style="font-size:12px;padding:5px 12px;white-space:nowrap" onclick="deleteAtSelected()">🗑 Usuń zaznaczone</button>
        <button class="btn" style="font-size:12px;padding:5px 12px;white-space:nowrap" onclick="atSelected.clear();renderAirdrop()">✕ Odznacz</button>
      </div>

      <!-- Filtry -->
      <div class="filters" style="margin-bottom:12px">
        <input id="at-search" placeholder="🔍 Szukaj projektu, zadań..." oninput="renderAirdrop()" style="flex:1;min-width:160px">
        <select id="at-status" onchange="renderAirdrop()">
          <option value="">Wszystkie statusy</option>
          ${AT_STATUSES.map(s=>`<option>${s}</option>`).join('')}
        </select>
        <select id="at-type" onchange="renderAirdrop()">
          <option value="">Wszystkie typy</option>
          ${AT_TYPES.map(t=>`<option>${t}</option>`).join('')}
        </select>
      </div>

      <!-- Formularz dodawania / edycji -->
      <div id="at-form" style="display:none;margin-bottom:16px">
        <div class="form-card">
          <div class="form-title" id="at-form-title">Nowy projekt</div>
          <input type="hidden" id="at-edit-id">
          <div class="form-row">
            <div>
              <div class="form-label">Projekt / nazwa *</div>
              <input class="form-input" id="at-f-project" placeholder="np. Initia, Monad, Babylon...">
            </div>
            <div>
              <div class="form-label">Typ</div>
              <select class="form-select" id="at-f-type">
                <option value="">— wybierz —</option>
                ${AT_TYPES.map(t=>`<option>${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div>
              <div class="form-label">Status</div>
              <select class="form-select" id="at-f-status">
                ${AT_STATUSES.map(s=>`<option>${s}</option>`).join('')}
              </select>
            </div>
            <div>
              <div class="form-label">Data działań</div>
              <input class="form-input" id="at-f-date" placeholder="np. 2025-01, Q1 2026...">
            </div>
          </div>
          <div class="form-row full">
            <div>
              <div class="form-label">Zadania (co robiłeś)</div>
              <textarea class="form-textarea" id="at-f-tasks" style="min-height:90px" placeholder="np. Wykonaj swapy tokenów&#10;Zapewnij płynność&#10;Wypełnij formularz"></textarea>
            </div>
          </div>
          <div class="form-row">
            <div>
              <div class="form-label">Link do socjali (Twitter, Discord...)</div>
              <input class="form-input" id="at-f-social" placeholder="https://twitter.com/...">
            </div>
            <div>
              <div class="form-label">Portfel (Rabby, Phantom, Unisat...)</div>
              <input class="form-input" id="at-f-wallet" placeholder="np. Rabby, Phantom">
            </div>
          </div>
          <div class="form-row full">
            <div>
              <div class="form-label">Linki do testnet/działań (każdy w nowej linii)</div>
              <textarea class="form-textarea" id="at-f-testnet" style="min-height:70px" placeholder="https://app.przykład.xyz&#10;https://quest.przykład.xyz"></textarea>
            </div>
          </div>
          <div class="form-row">
            <div>
              <div class="form-label">Notatka</div>
              <input class="form-input" id="at-f-note" placeholder="Dodatkowe informacje...">
            </div>
            <div>
              <div class="form-label">URL zdjęcia (screenshot, Cloudinary...)</div>
              <input class="form-input" id="at-f-imgurl" placeholder="https://...">
            </div>
          </div>
          <div class="form-btns">
            <button class="btn btn-primary" onclick="saveAt()">Zapisz</button>
            <button class="btn" onclick="toggleAtForm(false)">Anuluj</button>
          </div>
        </div>
      </div>

      <!-- Treść tabeli / karty -->
      </div><!-- /at-page-inner -->
      <div id="airdrop-content" style="padding:0 1rem"><div class="loading">Ładowanie...</div></div>
    </div>

    <!-- STATYSTYKI -->
    <div id="page-stats" class="page">
      <div id="stats-content"><div class="loading">Ładowanie statystyk...</div></div>
    </div>

    <!-- AI TOOLS -->
    <div id="page-aitools" class="page">
      <!-- Toolbar -->
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary" id="btn-add-ait" onclick="toggleAitForm()" style="white-space:nowrap">+ Dodaj narzędzie</button>
        <input id="ait-search" placeholder="🔍 Szukaj narzędzia..." oninput="renderAiTools()" style="flex:1;min-width:160px;padding:6px 10px;border:1px solid var(--border2);border-radius:var(--r);background:var(--bg3);color:var(--text);font-size:13px">
        <select id="ait-cat" onchange="renderAiTools()" style="padding:6px 10px;border:1px solid var(--border2);border-radius:var(--r);background:var(--bg3);color:var(--text);font-size:13px">
          <option value="">Wszystkie kategorie</option>
          ${AI_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}
        </select>
        <select id="ait-free" onchange="renderAiTools()" style="padding:6px 10px;border:1px solid var(--border2);border-radius:var(--r);background:var(--bg3);color:var(--text);font-size:13px">
          <option value="">Darmowe i płatne</option>
          <option value="tak">Tylko darmowe</option>
          <option value="nie">Tylko płatne</option>
        </select>
      </div>

      <!-- Formularz -->
      <div id="ait-form" style="display:none;margin-bottom:16px">
        <div class="form-card">
          <div class="form-title" id="ait-form-title">Nowe narzędzie AI</div>
          <div class="form-row">
            <div>
              <div class="form-label">Nazwa *</div>
              <input class="form-input" id="ait-f-name" placeholder="np. ChatGPT, Midjourney...">
            </div>
            <div>
              <div class="form-label">Kategoria</div>
              <select class="form-select" id="ait-f-cat">
                <option value="">— wybierz —</option>
                ${AI_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row full">
            <div>
              <div class="form-label">Opis — co robi, jak używasz, uwagi</div>
              <textarea class="form-textarea" id="ait-f-desc" style="min-height:80px" placeholder="Opisz do czego służy, jak go używasz, wskazówki..."></textarea>
            </div>
          </div>
          <div class="form-row">
            <div>
              <div class="form-label">Link (URL)</div>
              <input class="form-input" id="ait-f-url" placeholder="https://...">
            </div>
            <div>
              <div class="form-label">Tagi (oddzielone przecinkami)</div>
              <input class="form-input" id="ait-f-tags" placeholder="np. GPT, chat, pisanie">
            </div>
          </div>
          <div class="form-row">
            <div style="display:flex;align-items:center;gap:10px;padding-top:22px">
              <input type="checkbox" id="ait-f-free" checked style="width:16px;height:16px;accent-color:var(--neon);cursor:pointer">
              <label for="ait-f-free" style="font-size:13px;color:var(--text);cursor:pointer">Darmowe (lub ma free tier)</label>
            </div>
            <div>
              <div class="form-label">Ocena (1-5)</div>
              <select class="form-select" id="ait-f-rating">
                <option value="0">— brak oceny —</option>
                <option value="1">★ 1</option>
                <option value="2">★★ 2</option>
                <option value="3">★★★ 3</option>
                <option value="4">★★★★ 4</option>
                <option value="5">★★★★★ 5</option>
              </select>
            </div>
          </div>
          <div class="form-btns">
            <button class="btn btn-primary" onclick="saveAiTool()">Zapisz</button>
            <button class="btn" onclick="toggleAitForm(false)">Anuluj</button>
          </div>
        </div>
      </div>

      <!-- Karty narzędzi -->
      <div id="ait-cards"><div class="loading">Ładowanie...</div></div>
    </div>

    <!-- WIĘCEJ (mega-zakładka z podzakładkami) -->
    <div id="page-wiecej" class="page">
      <div class="subnav">
        <button class="subtab active" data-subtab="archiwum"  onclick="switchSubTab('archiwum')">Archiwum <span class="tab-badge" id="tab-arch-badge" style="background:rgba(0,229,255,.1);color:var(--neon)">0</span></button>
        <button class="subtab"        data-subtab="tgsygnaly" onclick="switchSubTab('tgsygnaly')">📡 TG Sygnały <span class="tab-badge" id="tab-tgsig-badge" style="background:rgba(245,158,11,.25);color:#f59e0b">0</span></button>
        <button class="subtab"        data-subtab="tgwpisy"   onclick="switchSubTab('tgwpisy')">📋 TG Wpisy <span class="tab-badge" id="tab-tgwpisy-badge" style="background:rgba(124,58,237,.25);color:#a78bfa">0</span></button>
        <button class="subtab"        data-subtab="kalendarz"   onclick="switchSubTab('kalendarz')">Kalendarz</button>
        <button class="subtab"        data-subtab="ustawienia"  onclick="switchSubTab('ustawienia')">⚙️ Ustawienia</button>
        <button class="subtab"        data-subtab="archprojekty" onclick="switchSubTab('archprojekty')">📦 Archiwum projektów</button>
      </div>

      <!-- ARCHIWUM (podzakładka) -->
      <div id="sub-archiwum" class="subpage active">
        <div style="font-size:13px;color:var(--text2);margin-bottom:12px">Opublikowane wpisy. Przywróć do głównej zakładki jeśli potrzeba.</div>
        <div id="arch-cards"></div>
      </div>

      <!-- TG SYGNAŁY (podzakładka) -->
      <div id="sub-tgsygnaly" class="subpage">
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
          <button class="btn" style="white-space:nowrap;background:rgba(0,229,255,.1);border-color:rgba(0,229,255,.3)" onclick="tgSelectAll(tgSigSelected,'tgsig',()=>updateTgBulkBar(tgSigSelected,'tgsig-bulk-bar','tgsig-bulk-count'),renderTgSygnaly)">☑ Zaznacz widoczne</button>
          <button id="btn-refresh-tgsig" class="btn btn-primary" style="white-space:nowrap" onclick="refreshTgData('signals')">🔄 Odśwież</button>
        </div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:10px;padding:0 2px">
          ⚡ Sygnały filtrowane według słów kluczowych zdefiniowanych w <code style="background:var(--bg3);padding:1px 5px;border-radius:3px">tg_sygnaly.txt</code> na VPS
        </div>
        <div id="tgsig-bulk-bar" style="display:none;align-items:center;gap:8px;padding:9px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:var(--r);margin-bottom:10px;flex-wrap:wrap">
          <span id="tgsig-bulk-count" style="font-size:13px;font-weight:700;color:var(--neon4)"></span>
          <button class="btn btn-danger" style="font-size:12px;padding:5px 12px;white-space:nowrap" onclick="tgRejectSelected(tgSigSelected,'tgSignals',()=>updateTgBulkBar(tgSigSelected,'tgsig-bulk-bar','tgsig-bulk-count'),renderTgSygnaly)">Odrzuć zaznaczone</button>
          <button class="btn" style="font-size:12px;padding:5px 12px;white-space:nowrap" onclick="tgSigSelected.clear();updateTgBulkBar(tgSigSelected,'tgsig-bulk-bar','tgsig-bulk-count');renderTgSygnaly()">✕ Odznacz</button>
        </div>
        <div id="tgsig-cards"><div class="loading">Ładowanie...</div></div>
      </div>

      <!-- TG WPISY (podzakładka) -->
      <div id="sub-tgwpisy" class="subpage">
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
          <button class="btn" style="white-space:nowrap;background:rgba(0,229,255,.1);border-color:rgba(0,229,255,.3)" onclick="tgSelectAll(tgWpiSelected,'tgwpisy',()=>updateTgBulkBar(tgWpiSelected,'tgwpisy-bulk-bar','tgwpisy-bulk-count'),renderTgWpisy)">☑ Zaznacz widoczne</button>
          <button id="btn-refresh-tgwpisy" class="btn btn-primary" style="white-space:nowrap" onclick="refreshTgData('wpisy')">🔄 Odśwież</button>
        </div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:10px;padding:0 2px">
          📋 Wszystkie wiadomości z kanałów zdefiniowanych w <code style="background:var(--bg3);padding:1px 5px;border-radius:3px">tg_wpisy.txt</code> na VPS
        </div>
        <div id="tgwpisy-bulk-bar" style="display:none;align-items:center;gap:8px;padding:9px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:var(--r);margin-bottom:10px;flex-wrap:wrap">
          <span id="tgwpisy-bulk-count" style="font-size:13px;font-weight:700;color:var(--neon4)"></span>
          <button class="btn btn-danger" style="font-size:12px;padding:5px 12px;white-space:nowrap" onclick="tgRejectSelected(tgWpiSelected,'tgWpisy',()=>updateTgBulkBar(tgWpiSelected,'tgwpisy-bulk-bar','tgwpisy-bulk-count'),renderTgWpisy)">Odrzuć zaznaczone</button>
          <button class="btn" style="font-size:12px;padding:5px 12px;white-space:nowrap" onclick="tgWpiSelected.clear();updateTgBulkBar(tgWpiSelected,'tgwpisy-bulk-bar','tgwpisy-bulk-count');renderTgWpisy()">✕ Odznacz</button>
        </div>
        <div id="tgwpisy-cards"><div class="loading">Ładowanie...</div></div>
      </div>

      <!-- KALENDARZ (podzakładka) -->
      <div id="sub-kalendarz" class="subpage">
      </div>

      <div id="sub-ustawienia" class="subpage">
        <div class="loading">Ładowanie ustawień...</div>
      </div>

      <div id="sub-archprojekty" class="subpage">
        <div id="archp-content"><div class="loading">Ładowanie...</div></div>
      </div>

    </div><!-- /page-wiecej -->

    <!-- NOTATKI -->
    <div id="page-notatki" class="page">
      <div class="form-card" style="margin-bottom:16px">
        <div class="form-title">Nowa notatka</div>
        <textarea class="note-input" id="new-note" placeholder="Zapisz coś — pomysł, link, przypomnienie..."></textarea>
        <div style="margin-top:8px"><button class="btn btn-primary" onclick="addNote()">Zapisz notatkę</button></div>
      </div>
      <div class="filters" style="margin-bottom:12px">
        <input id="note-search" placeholder="🔍 Szukaj w notatkach..." oninput="renderNotes()" style="flex:1">
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
  const el = document.getElementById('sub-kalendarz')
  if (!el) return

  // Zbierz wszystkie opublikowane wpisy z posts i myPosts
  const published = []

  Object.values(posts).forEach(p => {
    if (p.status === 'Opublikowane') {
      const raw = p.archivedAt || p.xDate || ''
      const dateStr = parseDateStr(raw)
      if (dateStr) published.push({ date: dateStr, source: 'wpisy', text: p.text, account: '@' + p.account, xLink: p.xLink || '', para: p.para || '' })
    }
  })

  Object.values(myPosts).forEach(p => {
    if (p.status === 'Opublikowane') {
      const raw = p.published || p.created || ''
      const dateStr = parseDateStr(raw)
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

  // Heatmapa — ostatnie 8 tygodni (56 dni), wyrównana do poniedziałku
  const heatmapDays = 56
  const heatEnd = new Date(today)
  // Znajdź ostatnią niedzielę (koniec tygodnia)
  const dayOfWeek = (heatEnd.getDay() + 6) % 7 // 0=Pn, 6=Nd
  const heatStart = new Date(heatEnd)
  heatStart.setDate(heatStart.getDate() - dayOfWeek - (heatmapDays - 7))

  const heatmap = []
  for (let i = 0; i < heatmapDays; i++) {
    const d = new Date(heatStart); d.setDate(d.getDate() + i)
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

  // Aktywność per miesiąc — ostatnie 12 miesięcy
  const byMonth = {}
  published.forEach(p => {
    const m = p.date.slice(0, 7)
    byMonth[m] = (byMonth[m] || 0) + 1
  })
  const months = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12)
  const maxMonth = Math.max(...months.map(m => m[1]), 1)

  // Formatuj miesiąc czytelnie: "2025-04" → "Kwi 2025"
  const MIESIAC = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru']
  function formatMonth(ym) {
    const [y, m] = ym.split('-')
    return `${MIESIAC[parseInt(m,10)-1]} ${y}`
  }

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:20px">
      <div class="stat"><div class="stat-n" style="color:var(--neon)">${total}</div><div class="stat-l">Opublikowanych</div></div>
      <div class="stat"><div class="stat-n" style="color:var(--neon3)">${totalDays}</div><div class="stat-l">Aktywnych dni</div></div>
      <div class="stat"><div class="stat-n" style="color:var(--neon4)">${avgPerDay}</div><div class="stat-l">Śr. dziennie</div></div>
      <div class="stat"><div class="stat-n" style="color:var(--neon2)">${streak}</div><div class="stat-l">Dni z rzędu</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">

      <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:var(--rl);padding:14px">
        <div style="font-size:12px;font-weight:700;color:var(--neon);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em">Aktywność — ostatnie 8 tygodni</div>
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
            <span style="font-size:12px;color:var(--text2);min-width:72px;white-space:nowrap">${formatMonth(m)}</span>
            <div style="flex:1;height:14px;background:var(--bg3);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${Math.round(cnt/maxMonth*100)}%;background:var(--neon);border-radius:3px;transition:width .3s"></div>
            </div>
            <span style="font-size:12px;color:var(--neon);min-width:24px;text-align:right">${cnt}</span>
          </div>`).join('') : '<div style="color:var(--text3);font-size:13px">Brak danych</div>'}
      </div>

    </div>

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

// ── MOD 4: IMPORT Z LINKU X ──────────────────────────────────────
async function importFromX() {
  const input = document.getElementById('import-x-url')
  const url = input?.value.trim()
  if (!url || !url.includes('/status/')) {
    toast('Podaj poprawny link do tweeta (x.com/user/status/...)')
    return
  }
  const btn = document.getElementById('btn-import-x')
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Pobieranie...' }
  try {
    const res = await fetch(vpsUrl('/fetch-tweet'), {
      method: 'POST',
      headers: vpsHeaders(),
      body: JSON.stringify({ url })
    })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data.detail || data.error || 'Nieznany błąd')
    if (input) input.value = ''
    toast('✅ Pobrano wpis od ' + data.account)
    renderMain(); updateBadges()
  } catch(err) {
    toast('❌ Błąd importu: ' + err.message)
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📥 Pobierz z X' }
  }
}

// ── MOD 8: ZARZĄDZANIE KONTAMI VPS ───────────────────────────────
async function loadVpsAccounts() {
  if (!import.meta.env.VITE_VPS_URL) return
  try {
    const [rx, rs, rw] = await Promise.all([
      fetch(vpsUrl('/accounts/x'),           { headers: vpsHeaders() }),
      fetch(vpsUrl('/accounts/tg/signals'),  { headers: vpsHeaders() }),
      fetch(vpsUrl('/accounts/tg/wpisy'),    { headers: vpsHeaders() }),
    ])
    if (rx.ok) { const d = await rx.json(); vpsAccountsX = d.accounts || [] }
    if (rs.ok) { const d = await rs.json(); vpsTgSignals = d.channels || [] }
    if (rw.ok) { const d = await rw.json(); vpsTgWpisy   = d.channels || [] }
  } catch(e) { console.warn('loadVpsAccounts:', e) }
}

async function vpsAddAccountX() {
  const inp = document.getElementById('vps-x-input')
  const acc = inp?.value.trim().replace(/^@/, '')
  if (!acc) { toast('Podaj nazwę konta (bez @)'); return }
  try {
    const res = await fetch(vpsUrl('/accounts/x/add'), {
      method: 'POST', headers: vpsHeaders(), body: JSON.stringify({ account: acc })
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.detail || 'Błąd')
    inp.value = ''; await loadVpsAccounts(); renderAtSettings()
    toast('✅ Dodano konto: @' + acc)
  } catch(e) { toast('❌ ' + e.message) }
}

async function vpsRemoveAccountX(acc) {
  try {
    const res = await fetch(vpsUrl('/accounts/x/remove'), {
      method: 'DELETE', headers: vpsHeaders(), body: JSON.stringify({ account: acc })
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.detail || 'Błąd')
    await loadVpsAccounts(); renderAtSettings()
    toast('✅ Usunięto: @' + acc)
  } catch(e) { toast('❌ ' + e.message) }
}

async function vpsAddTg(type) {
  const inp = document.getElementById(`vps-tg-${type}-input`)
  const ch = inp?.value.trim()
  if (!ch) { toast('Podaj nazwę/ID kanału'); return }
  try {
    const res = await fetch(vpsUrl('/accounts/tg/add'), {
      method: 'POST', headers: vpsHeaders(), body: JSON.stringify({ channel: ch, type })
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.detail || 'Błąd')
    inp.value = ''; await loadVpsAccounts(); renderAtSettings()
    toast('✅ Dodano kanał')
  } catch(e) { toast('❌ ' + e.message) }
}

async function vpsRemoveTg(type, ch) {
  try {
    const res = await fetch(vpsUrl('/accounts/tg/remove'), {
      method: 'DELETE', headers: vpsHeaders(), body: JSON.stringify({ channel: ch, type })
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.detail || 'Błąd')
    await loadVpsAccounts(); renderAtSettings()
    toast('✅ Usunięto kanał')
  } catch(e) { toast('❌ ' + e.message) }
}

// ── KONIEC: MOD 4/8 ──────────────────────────────────────────────

// ── EXPOSE ────────────────────────────────────────────────────────
Object.assign(window, {
  loginGoogle, logout, switchTab, switchSubTab, syncSheets,
  renderMain, setPostStatus, savePara, savePostNote, toggleExpand, copyText, addToProjects, callAIJson,
  mainToggleOne, updateMainBulkBar, deleteMainSelected,
  toggleFilterPanel, resetFilterPanel, selectAllVisible, setDateFilter,
  showAccountPanel, closeAccountPanel,
  renderMoje, toggleMyExpand, startMyEdit, cancelMyEdit, saveMyEdit,
  addMyPost, toggleMyForm, publishMyPost, deleteMyPost, saveMyNote,
  renderArchive, restorePost, toggleArchExpand,
  addNote, deleteNote, startNoteEdit, cancelNoteEdit, saveNoteEdit, copyNoteText,
  renderRef, toggleRefForm, addRef, startRefEdit, cancelRefEdit, saveRefEdit, deleteRef,
  toggleEmojiPanel, addEmoji, emojiClick, removeEmoji,
  copyRefToParaphrase, copyRefFromSelect,
  renderKalendarz, toggleDayPosts, showDayPosts, toggleKPost,
  renderTgSygnaly, renderTgWpisy, setTgStatus, saveTgPara, saveTgNote, toggleTgExpand,
  renderKonta, toggleKatForm, addKategoria, startKatEdit, cancelKatEdit, saveKatEdit, deleteKategoria,
  addAccount, startAccEdit, cancelAccEdit, saveAccEdit, deleteAccount,
  triggerAIPara,
  renderArchProjekty, restoreArchP, deleteArchP, restoreAllArchP, deleteAllArchP,
  toggleManualForm, addManualPost, extractTextFromImage,
  renderManualDrafts, updateManualDraftsBadge, startDraftEdit, cancelDraftEdit, saveDraftEdit, sendDraftToWpisy, deleteDraft, toggleDraftPreview,
  renderAiTools, toggleAitForm, openAitEdit, saveAiTool, deleteAiTool,
  renderStats,
  renderAirdrop, toggleAtView, toggleAtForm, openAtEdit, saveAt, deleteAt, setAtStatus, setAtField, importAtXlsx,
  exportAtCsv, duplicateAt, atSetSort,
  renderAtSettings, addAtStatus, removeAtStatus, saveAtStatuses, addAtType, removeAtType, saveAtTypes,
  checkGroqStatus, renderGroqStatusCard, resetGroqCounter,
  atToggleOne, atToggleAll, updateAtBulkBar, deleteAtSelected, hideAtSelected, toggleAtHide, toggleAtShowHidden, atExpandCell, atLinkify,
  importFromX, refreshTgData, tgToggleOne, updateTgBulkBar, tgSelectAll, tgRejectSelected,
  loadVpsAccounts, vpsAddAccountX, vpsRemoveAccountX, vpsAddTg, vpsRemoveTg,
})

// ── MOD 5: PWA — Service Worker ───────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW:', e))
  })
}

// ── INIT ──────────────────────────────────────────────────────────
buildApp()

onAuthStateChanged(auth, async user => {
  window._currentUser = user || null
  if (user) {
    showMainApp(user)
    await loadAll()
    await loadEmojis()
    renderEmojiPanel()
    renderMain(); renderMoje(); renderNotes(); renderRef(); renderKonta(); renderAirdrop(); renderAiTools(); renderManualDrafts()
    updateStats(); updateBadges()
    await syncSheets()
    setInterval(syncSheets, 5 * 60 * 1000)
    // TG dane — brak automatycznego pollingu (TGBot zapisuje bezpośrednio do Firestore)
    // Użytkownik odświeża ręcznie przyciskiem w zakładce TG
  } else {
    showAuthScreen()
  }
})
