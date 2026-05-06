# CONTEXT.md — XPost Manager + XParafBot + TGBot
> Plik kontekstowy dla kolejnych sesji AI. Ostatnia aktualizacja: Maj 2026.

---

## 1. CZYM JEST APLIKACJA

Zintegrowany system do zarządzania treścią na platformie X (Twitter) i Telegram, składający się z trzech komponentów:

1. **XParafBot** — bot Python na VPS, scrappuje posty X przez Playwright/GraphQL, zapisuje do Google Sheets i Firebase
2. **TGBot** — bot Python na VPS, monitoruje publiczne kanały Telegram przez Telethon, zapisuje do Firebase
3. **XPost Manager** — webowa aplikacja (Vite + vanilla JS, Vercel), zarządza wszystkimi wpisami, podłączona do Firebase i Google Sheets

**Cel użytkownika:** Agregować treści z X i Telegrama, parafrazować je (ręcznie lub przez AI), publikować na własnym koncie X. Zarządzać kontami, linkami ref, notatkami i sygnałami tradingowymi z Telegrama.

---

## 2. STACK TECHNOLOGICZNY

### Frontend (XPost Manager)
- **Framework:** Vite + vanilla JS (bez frameworka)
- **Baza danych:** Firebase Firestore (projekt: `xpost-manager`)
- **Auth:** Firebase Google Auth (`signInWithPopup` TYLKO — nigdy `getRedirectResult`)
- **Hosting zdjęć:** Cloudinary (`dvdud5uxy`)
- **Deploy:** GitHub → Vercel (auto-deploy przy push)
- **Theme:** Dark neon — `--neon:#00e5ff`, `--bg:#484862`

### Backend Bot X (XParafBot)
- **Język:** Python 3.12
- **Scraping:** Playwright (headless Chromium) + przechwyt GraphQL
- **Arkusz:** gspread → Google Sheets API
- **Obrazy:** Cloudinary REST API
- **Powiadomienia:** Telegram Bot API
- **Harmonogram:** CRON co 50 minut

### Backend Bot TG (TGBot)
- **Język:** Python 3.12
- **Telegram:** Telethon (MTProto, konto osobiste — NIE bot token)
- **Firebase:** firebase-admin (Admin SDK, omija reguły Firestore)
- **Powiadomienia:** ten sam Telegram Bot Token co XParafBot
- **Harmonogram:** CRON co 30 minut
- **Sesja:** plik `tgbot_session.session` — logowanie przez `login_tg.py`

### Infrastruktura
- **VPS:** IP `185.202.239.239`, Ubuntu 24, Node v22, PM2
- **Firebase projekt:** `xpost-manager`
- **Firestore reguły:** `allow read, write: if true` (świadoma decyzja)
- **Telegram API:** `api_id=21596975`, `api_hash=e9cf842e116bccd385c4ace41df306e6`

---

## 3. STRUKTURA PLIKÓW

### Repo GitHub (`xpost-manager/`)
```
xpost-manager/
├── src/
│   ├── main.js        ← CAŁA logika aplikacji (najważniejszy plik)
│   ├── style.css      ← style dark neon
│   └── firebase.js    ← inicjalizacja Firebase + Auth
├── index.html
├── package.json       ← "firebase": "^10.7.0", "vite": "^5.0.0"
├── vite.config.js
├── vercel.json
└── .env               ← NIE wgrywać na GitHub
```

### VPS — XParafBot (`/root/xparafbot/`)
```
/root/xparafbot/
├── xparafbot.py           ← główny bot (Playwright + GraphQL)
├── login_x.py             ← jednorazowe logowanie (twscrape)
├── observed_accounts.txt  ← lista kont X do obserwowania
├── last_seen.json         ← stan ostatnich ID per konto
├── x_cookies.json         ← cookies z EditThisCookie (Chrome)
├── google_credentials.json← klucz serwisowy Google
└── .env
```

### VPS — TGBot (`/root/tgbot/`)
```
/root/tgbot/
├── tgbot.py               ← główny bot Telegram
├── login_tg.py            ← jednorazowe logowanie Telethon
├── tg_sygnaly.txt         ← kanały + słowa kluczowe (filtrowane)
├── tg_wpisy.txt           ← kanały bez filtrów (wszystkie wiadomości)
├── tg_last_seen.json      ← stan ostatnich ID per kanał
├── tgbot_session.session  ← sesja Telethon (konto osobiste)
├── firebase_service_key.json ← klucz Admin SDK Firebase
└── .env
```

---

## 4. FIREBASE FIRESTORE — KOLEKCJE

| Kolekcja | Źródło danych | Opis |
|---|---|---|
| `posts` | Google Sheets (sync co 5 min) + ręczne dodawanie | Wpisy z X/bota + posty ręczne |
| `myPosts` | Użytkownik | Własne wpisy do publikacji |
| `refLinks` | Użytkownik | Linki referencyjne do projektów |
| `notes` | Użytkownik | Notatki tekstowe |
| `emojis` | Użytkownik | Panel emotikonów (doc 'list', pole 'items') |
| `tgSignals` | TGBot | Wiadomości TG filtrowane słowami kluczowymi |
| `tgWpisy` | TGBot | Wszystkie wiadomości TG bez filtrów |
| `konta` | Użytkownik | Kategorie kont (Twitter, TG, Email...) |

### Struktura dokumentu `posts`
```json
{
  "id": "string (ID posta X lub 'manual_' + uid)",
  "account": "string (@nick lub 'nick RT @autor')",
  "xDate": "string (data posta na X)",
  "xLink": "string (URL do X)",
  "text": "string",
  "links": ["array URL"],
  "imgs": ["array URL Cloudinary/X"],
  "isRT": "boolean",
  "para": "string (parafraza użytkownika lub wygenerowana przez AI)",
  "note": "string (notatka użytkownika)",
  "status": "Nowy|Do zrobienia|W toku|Opublikowane|Odrzucone",
  "addedAt": "string (data dodania do Firebase)",
  "manualEntry": "boolean (true tylko dla postów dodanych ręcznie — pole opcjonalne)"
}
```
> Posty z `manualEntry: true` mają ID w formacie `manual_abc123xyz` i wyświetlają
> zielony badge "✍ Ręczny" w zakładce Wpisy.

### Struktura dokumentu `tgSignals` / `tgWpisy`
```json
{
  "id": "string (ID wiadomości TG)",
  "channel": "string (nazwa kanału)",
  "text": "string",
  "tgDate": "YYYY-MM-DD HH:MM:SS",
  "link": "https://t.me/kanal/id",
  "views": "number",
  "status": "Nowy|Do zrobienia|W toku|Opublikowane|Odrzucone",
  "para": "string",
  "note": "string",
  "keywords": ["array — tylko tgSignals"],
  "addedAt": "string"
}
```
> ⚠️ WAŻNE: Klucz dokumentu Firestore dla TG to np. `tgs_kanal_12345` (NIE samo `p.id`).
> Funkcje `setTgStatus`, `saveTgPara`, `saveTgNote` muszą używać `docId` (klucz Firestore), nie `p.id`.

### Struktura dokumentu `konta`
```json
{
  "id": "string",
  "name": "string (np. Twitter)",
  "icon": "string (emoji)",
  "note": "string",
  "accounts": [
    { "name": "string (@nick)", "note": "string" }
  ],
  "addedAt": "string"
}
```

---

## 5. ZAKŁADKI APLIKACJI (UI)

### Główny pasek zakładek (7 zakładek)

| Zakładka | ID strony | Funkcja render | Dane z |
|---|---|---|---|
| Wpisy | `page-main` | `renderMain()` | Firestore `posts` |
| Moje wpisy | `page-moje` | `renderMoje()` | Firestore `myPosts` |
| Notatki | `page-notatki` | `renderNotes()` | Firestore `notes` |
| Linki ref | `page-ref` | `renderRef()` | Firestore `refLinks` |
| 👤 Konta | `page-konta` | `renderKonta()` | Firestore `konta` |
| ✍ Dodaj ręcznie | `page-manual` | `toggleManualForm()` / `addManualPost()` | Firestore `posts` |
| Więcej ▾ | `page-wiecej` | `switchSubTab()` | — |

### Zakładka "Więcej ▾" — 4 podzakładki

| Podzakładka | ID substrony | Funkcja render | Dane z |
|---|---|---|---|
| Archiwum | `sub-archiwum` | `renderArchive()` | Firestore `posts` (status=Opublikowane) |
| 📡 TG Sygnały | `sub-tgsygnaly` | `renderTgSygnaly()` | Firestore `tgSignals` |
| 📋 TG Wpisy | `sub-tgwpisy` | `renderTgWpisy()` | Firestore `tgWpisy` |
| Kalendarz | `sub-kalendarz` | `renderKalendarz()` | Firestore `posts` + `myPosts` |

> Podzakładki: klasa `.subtab` / `.subpage`, atrybut `data-subtab`, przełączane przez `switchSubTab(name)`.
> Badge na "Więcej" = suma nowych TG Sygnałów + TG Wpisów.

### Cechy wspólne kart (Wpisy, TG Sygnały, TG Wpisy)
- Pole **Oryginał** (div) + pole **Parafraza** (textarea, zapis onblur)
- Przycisk **✨ AI** — generuje parafrazę przez AI (system rotacji modeli), zapisuje do Firebase
- Pole **Notatka** (input inline, zapis onblur) — klasa `note-inline`, `card-note`
- Select statusu (zmiana natychmiastowa → Firebase)
- Przycisk "Odrzuć" → status Odrzucone → znika z widoku
- Opublikowane → przenosi do Archiwum (podzakładka w "Więcej")
- Filtry: konto/kanał, status, typ, szukaj w treści, wyklucz słowa (LUB/I)

---

## 6. FLOW DANYCH

```
X (Twitter profiles)
    ↓ Playwright GraphQL (co 50 min)
XParafBot (VPS)
    ↓ gspread
Google Sheets ←→ XPost Manager (sync co 5 min, tylko odczyt)
    ↓ Firebase Firestore ←→ XPost Manager (read/write)

Telegram (publiczne kanały)
    ↓ Telethon MTProto (co 30 min)
TGBot (VPS)
    ↓ firebase-admin (Admin SDK)
Firebase Firestore ←→ XPost Manager (read/write)

Użytkownik
    ↓ XPost Manager (Vercel)
    ↓ Google Auth (signInWithPopup)
Firebase Firestore (myPosts, notes, refLinks, konta, emojis)

Użytkownik (ręczne dodawanie)
    ↓ Zakładka "✍ Dodaj ręcznie"
Firebase Firestore posts (manualEntry: true)
```

### Sheets → Firebase sync (syncSheets)
- Co 5 minut (`setInterval`)
- Range: `${SHEET_TAB}!A2:I` (do kolumny I = typ)
- `COL = { date:0, account:1, text:2, link:3, links:4, id:5, img:7, type:8 }`
- Duplikaty sprawdzane po `id` (col F)
- Nowe wpisy dostają status `Nowy`

### Sortowanie
- Zakładka **Wpisy**: po `xDate` (data posta X) malejąco
- Zakładka **Moje wpisy**: nieopublikowane na górze (po `created` malejąco), opublikowane na dole (po `created` malejąco)
- Zakładka **Notatki**: po `created` malejąco — używa `parseDateStr()` bo format daty może być PL (`dd.mm.yyyy`) lub ISO
- Zakładka **TG**: po `addedAt` malejąco

---

## 7. AI PARAFRAZA — SYSTEM ROTACJI MODELI

Każdy wpis w zakładce Wpisy ma przycisk **✨ AI** generujący parafrazę.

### Kolejność modeli (fallback od góry)
| # | Model | Zmienna env | Reset limitu |
|---|---|---|---|
| 1 | Groq llama-3.3-70b-versatile | `VITE_GROQ_API_KEY` | ~62 sek |
| 2 | Gemini 2.0 Flash | `VITE_GEMINI_API_KEY` | ~62 sek |
| 3 | Cerebras llama3.1-8b | `VITE_CEREBRAS_API_KEY` | ~60 min |
| 4 | SambaNova Meta-Llama-3.1-70B | `VITE_SAMBANOVA_API_KEY` | ~60 min |
| 5 | OpenRouter DeepSeek-R1 free | `VITE_OPENROUTER_API_KEY` | ~60 min |
| 6 | OpenRouter Llama-3.3-70b free | `VITE_OPENROUTER_API_KEY` | ~60 min |
| 7 | Groq mixtral-8x7b-32768 | `VITE_GROQ_API_KEY` | ~62 sek |

### Zasady działania
- Błąd 429/503 → model oznaczany jako wyczerpany (`_modelExhausted`), przejście do następnego
- Stan wyczerpania trzymany w pamięci — resetuje się przy odświeżeniu strony
- Brak klucza VITE_* → model automatycznie pomijany
- Wynik zapisuje się do `posts/{id}.para` w Firebase natychmiast po wygenerowaniu
- Pod przyciskiem wyświetla się nazwa użytego modelu (`✅ Groq llama-3.3-70b`) lub błąd
- Parametry API: `max_tokens: 2048`, `temperature: 0.7`

### Prompt (PARA_PROMPT)
Pełny prompt "THE WORLD-CLASS X POST PARAPHRASER & THREAD GENERATOR" z zasadami:
- Parafraza kompletna (zero verbatim), zachowanie tickers/URL/dat
- Domyślnie jeden długi post (X Pro, limit 25 000 znaków)
- Maks. 1 emoji na sekcję, tylko z zatwierdzonego zestawu
- Każda sekcja oddzielona pustą linią, `🔗` przed każdym URL
- Hashtagi na osobnej linii po pustej linii na końcu

---

## 8. KONFIGURACJA BOTÓW

### tg_sygnaly.txt — format
```
# Komentarze ignorowane
@NazwaKanalu: slowo1, slowo2, slowo3
-1001234567890: slowo1, slowo2        ← ID z -100 prefixem
```
> ⚠️ Kanały po numerycznym ID muszą mieć prefix `-100`. Bot musi być zalogowany
> na koncie które należy do tych kanałów.

### tg_wpisy.txt — format
```
@NazwaKanalu
-1001234567890
```

### XParafBot — Google Sheets struktura (kolumny A-I)
```
A=Data posta X | B=Konto (@) lub "Konto RT @autor" | C=Tekst
D=Link do X    | E=Linki z posta | F=ID posta
G=Zrobione (checkbox) | H=Zdjęcia (Cloudinary URL) | I=Typ (Post/RT)
```

---

## 9. HISTORIA ZMIAN

### Sesja — wcześniej (TGBot + zakładki TG)
1. ✅ **TGBot v1.0** — nowy bot Python do monitorowania Telegrama
2. ✅ **Zakładki TG Sygnały i TG Wpisy** w XPost Manager (badge'e żółte i fioletowe, auto-refresh co 2 min)
3. ✅ **Naprawa sortowania Wpisy** — po `xDate` (nie `addedAt`)
4. ✅ **Pole Notatka** w zakładkach: Wpisy, Moje wpisy, TG Sygnały, TG Wpisy
5. ✅ **Notatka w Linki ref** — pole notatki w edycji linku
6. ✅ **Zakładka Konta** — kategorie kont z kopiowaniem jednym kliknięciem, Firebase `konta`
7. ✅ **Naprawa bug TG** — `setTgStatus`/`saveTgPara`/`saveTgNote` używały `p.id` zamiast `docId`

### Sesja 03.05.2026 — AI Parafraza + Filtr wykluczeń
8. ✅ **AI Parafraza (✨ AI)** w zakładce Wpisy
   - Przycisk przy każdym wpisie, system rotacji 7 modeli z auto-fallback
   - Zapis do `posts/{id}.para` natychmiast po wygenerowaniu
   - Wyświetla nazwę użytego modelu lub komunikat błędu
   - Klucze API jako VITE_* w Vercel, brak klucza = model pomijany
   - Nowe klasy CSS: `.btn-ai-para`, `.ai-para-info`

9. ✅ **Filtr wykluczeń** w zakładce Wpisy
   - Pole "🚫 Wyklucz słowa..." — wiele słów oddzielonych spacją, działa live
   - Przełącznik **LUB** (ukryj jeśli ma którekolwiek słowo) / **I** (ukryj jeśli ma wszystkie)
   - Zmienne stanu: `fExclude`, `fExcludeMode` ('any' | 'all')

### Sesja Maj 2026 — Refaktoryzacja UI + naprawki
10. ✅ **Refaktoryzacja zakładek** — skrócenie paska z 9 do 7 zakładek
    - Archiwum, TG Sygnały, TG Wpisy, Kalendarz → mega-zakładka **Więcej ▾** z podzakładkami
    - Nowe klasy CSS: `.subnav`, `.subtab`, `.subpage`
    - Nowa funkcja `switchSubTab(name)`

11. ✅ **Zakładka "✍ Dodaj ręcznie"** — ręczne dodanie posta do zakładki Wpisy
    - Formularz: treść, konto/źródło, data, link, notatka
    - Zapisuje do `posts` z `manualEntry: true`, ID = `manual_` + uid()
    - Zielony badge "✍ Ręczny" w zakładce Wpisy
    - Funkcje: `toggleManualForm()`, `addManualPost()`

12. ✅ **Naprawa sortowania Moje wpisy** — nieopublikowane na górze, opublikowane na dole

13. ✅ **Naprawa sortowania Notatki** — helper `parseDateStr()` obsługuje format PL i ISO

14. ✅ **Naprawa Kalendarza** — korzeń: `archivedAt` w formacie PL (`dd.mm.yyyy`)
    - Heatmapa była pusta (klucze `byDate` w formacie PL, heatmapa szukała ISO)
    - "Aktywność miesięczna" wyświetlała "undefined" (`split('-')` nie działał na formacie PL)
    - Naprawka: `parseDateStr()` przy budowaniu listy published
    - Heatmapa rozszerzona z 4 do 8 tygodni, wyrównana do poniedziałku
    - Aktywność miesięczna: 12 miesięcy (było 6), czytelny format "Kwi 2026" (było "2026-04")
    - Usunięto sekcję "Top źródła wpisów"

---

## 10. AKTUALNY STAN

### Działa ✅
- XParafBot — scraping X → Sheets → Firebase
- XPost Manager — wszystkie zakładki (7 głównych + 4 podzakładki w "Więcej")
- Sync Sheets → Firebase (co 5 min)
- TGBot — instalacja, sesja, zapis do Firebase
- Kanały TG z nazwą (`@kanal`) i ID (`-100XXXXXXXXX`)
- AI Parafraza z rotacją 7 modeli
- Filtr wykluczeń (LUB/I)
- Dodawanie postów ręcznie
- Kalendarz (heatmapa, miesięczna aktywność, historia publikacji)

### Wymaga uwagi ⚠️
- **Sesja TGBot** — zalogowana na innym numerze niż docelowy.
  Należy: `rm /root/tgbot/tgbot_session.session` → `python3 login_tg.py`
  i zalogować się numerem który należy do monitorowanych kanałów
- **Cookies XParafBot** — ważność sprawdzana automatycznie, ostrzeżenie na Telegram < 5 dni

### Nie zaimplementowano ❌
- Archiwum dla TG Sygnałów i TG Wpisów (Opublikowane znikają z widoku, brak dedykowanej zakładki archiwum TG)

---

## 11. KONWENCJE KODU

### JS (main.js)
- Vanilla JS, bez frameworka, bez TypeScript
- State globalny: `posts`, `myPosts`, `refLinks`, `notes`, `tgSignals`, `tgWpisy`, `konta`
- Renderowanie przez `innerHTML` (nie virtual DOM)
- Firestore: `setDoc` dla nowych/nadpisania, `updateDoc` dla częściowych zmian
- ID dokumentów TG: `tgs_{kanal}_{msgId}` (sygnały), `tgw_{kanal}_{msgId}` (wpisy)
- ID postów ręcznych: `manual_` + uid()
- Kopiowanie: `navigator.clipboard.writeText` (czysty tekst, bez HTML)
- Filtry: odczyt z DOM w funkcji render (nie osobne zmienne)
- **NIGDY** nie używać `getRedirectResult` — tylko `signInWithPopup`
- Sortowanie kart TG: `Object.entries()` (nie `values()`!) żeby mieć `docId`
- **Daty:** `nowStr()` zapisuje format PL `dd.mm.yyyy hh:mm:ss`. Do porównań i dat kalendarza używaj `parseDateStr(s)` — obsługuje oba formaty (PL i ISO → zwraca `YYYY-MM-DD`)
- **Podzakładki:** `.subtab` / `.subpage`, `data-subtab`, przełączane przez `switchSubTab(name)`, kontenery `id="sub-{name}"`

### CSS
- CSS variables: `--neon:#00e5ff`, `--bg:#484862`, `--bg2:#54546f`, `--bg3:#60607e`
- Klasy kart: `card`, `card-head`, `card-body`, `card-foot`, `card-note`
- Badge TG Sygnały: żółty (`#f59e0b`), TG Wpisy: fioletowy (`#a78bfa`)
- Badge Konta: zielony (`#10b981`), Badge Ręczny: zielony (`#10b981`)
- AI: `.btn-ai-para` (gradient fiolet→cyan), `.ai-para-info` (info o modelu)
- Subnav: `.subnav`, `.subtab`, `.subpage`

### Deployment
- **Zawsze edytuj istniejące pliki** — nie pisz od nowa
- Zmiany w `src/main.js` i/lub `src/style.css` → push GitHub → Vercel auto-deploy
- Pliki na VPS: upload przez WinSCP
- Logi bota X: `/root/xparafbot/xparafbot.log`
- Logi bota TG: `/root/tgbot/tgbot.log`

### Python (boty)
- `--break-system-packages` przy pip install (Ubuntu 24, root)
- `asyncio.run()` jako entry point
- `dotenv` + `.env` dla konfiguracji
- `errors='replace'` przy czytaniu plików txt (encoding safety)

---

## 12. PRZYDATNE KOMENDY VPS

```bash
# XParafBot
cd /root/xparafbot && python3 xparafbot.py          # ręczny test
tail -50 /root/xparafbot/xparafbot.log              # logi

# TGBot
cd /root/tgbot && python3 tgbot.py                  # ręczny test
tail -50 /root/tgbot/tgbot.log                      # logi
python3 login_tg.py                                 # ponowne logowanie TG

# CRON
crontab -e                                          # edycja
crontab -l                                          # podgląd

# Aktualne wpisy CRON:
# */50 * * * * cd /root/xparafbot && python3 xparafbot.py >> /root/xparafbot/xparafbot.log 2>&1
# */30 * * * * cd /root/tgbot && python3 tgbot.py >> /root/tgbot/tgbot.log 2>&1

# Pip install (Ubuntu 24 root)
pip install PAKIET --break-system-packages

# Sprawdź biblioteki
python3 -c "import telethon; print('OK')"
python3 -c "import firebase_admin; print('OK')"
```

---

## 13. ZMIENNE ŚRODOWISKOWE

### `/root/xparafbot/.env`
```
GOOGLE_SHEET_ID=...
GOOGLE_SHEET_URL=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
GROQ_API_KEY=...
CLOUDINARY_CLOUD=dvdud5uxy
CLOUDINARY_KEY=297745586692791
CLOUDINARY_SECRET=mK-ylzSqoDUoW0Ou620
```

### `/root/tgbot/.env`
```
TG_API_ID=21596975
TG_API_HASH=e9cf842e116bccd385c4ace41df306e6
FIREBASE_SERVICE_KEY=/root/tgbot/firebase_service_key.json
TELEGRAM_BOT_TOKEN=...       ← ten sam co XParafBot
TELEGRAM_CHAT_ID=...         ← ten sam co XParafBot
```

### Vercel (XPost Manager) — zmienne VITE_*
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID      = xpost-manager
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_SHEET_ID
VITE_SHEET_TAB
VITE_SHEETS_API_KEY
VITE_GROQ_API_KEY             ← AI Parafraza (modele 1 i 7)
VITE_GEMINI_API_KEY           ← AI Parafraza (model 2)
VITE_CEREBRAS_API_KEY         ← AI Parafraza (model 3)
VITE_SAMBANOVA_API_KEY        ← AI Parafraza (model 4)
VITE_OPENROUTER_API_KEY       ← AI Parafraza (modele 5 i 6)
```

---

## PROMPT STARTOWY

Wklej poniższy blok jako pierwszą wiadomość w nowym czacie:

---

```
Cześć! Pracuję nad projektem XPost Manager — zintegrowanym systemem do zarządzania treścią X/Telegram. Wgrywam pliki — traktuj je jako jedyne źródło prawdy. ZAWSZE edytuj wgrane pliki, nigdy nie pisz od nowa.

SYSTEM SKŁADA SIĘ Z 3 KOMPONENTÓW:

1. XParafBot (Python, /root/xparafbot/) — scrappuje posty X przez Playwright/GraphQL, zapisuje do Google Sheets i Firebase Firestore. CRON co 50 min.

2. TGBot (Python, /root/tgbot/) — monitoruje publiczne kanały Telegram przez Telethon (konto osobiste, NIE bot), zapisuje do Firebase. CRON co 30 min. api_id=21596975. Kanały numeryczne wymagają prefixu -100.

3. XPost Manager (Vite + vanilla JS, Vercel, Firebase projekt: xpost-manager) — webowa aplikacja.

STRUKTURA ZAKŁADEK (7 głównych):
Wpisy | Moje wpisy | Notatki | Linki ref | Konta | ✍ Dodaj ręcznie | Więcej ▾

ZAKŁADKA "WIĘCEJ" ma 4 podzakładki:
Archiwum | TG Sygnały | TG Wpisy | Kalendarz
Podzakładki: ID="sub-{name}", klasa .subpage, przełączane przez switchSubTab(name)

FIREBASE KOLEKCJE: posts, myPosts, refLinks, notes, emojis, tgSignals, tgWpisy, konta.

KLUCZOWE ZASADY KODU:
- Auth: signInWithPopup TYLKO (nigdy getRedirectResult)
- TG karty: renderować przez Object.entries() (nie values()) — klucz dokumentu to docId np. tgs_kanal_123, NIE p.id
- Sortowanie Wpisy: po xDate malejąco
- Sortowanie Moje wpisy: nieopublikowane na górze, opublikowane na dole
- Sortowanie Notatki: używaj parseDateStr() — daty mogą być w formacie PL (dd.mm.yyyy) lub ISO
- Kopiowanie: navigator.clipboard.writeText (czysty tekst)
- Filtry: odczyt z DOM w funkcji render
- Dark neon theme: --neon:#00e5ff, --bg:#484862
- Deploy: push GitHub → Vercel auto-deploy
- VPS upload: WinSCP
- Posty ręczne: ID zaczyna się od "manual_", pole manualEntry:true, badge "✍ Ręczny" w Wpisach
- AI Parafraza: system rotacji 7 modeli (Groq→Gemini→Cerebras→SambaNova→OpenRouter×2→Groq), klucze VITE_* w Vercel

STAN: TGBot wymaga ponownego logowania (rm tgbot_session.session && python3 login_tg.py) na właściwym numerze telefonu (tym który należy do monitorowanych kanałów).
```

---

*CONTEXT.md wygenerowany automatycznie na podstawie sesji. Aktualizuj po każdej większej zmianie.*
