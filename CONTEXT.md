# CONTEXT.md — XPost Manager + XParafBot + TGBot
> Plik kontekstowy dla kolejnych sesji AI. Ostatnia aktualizacja: Maj 2026.

---
----

## ⚠️ GLOBALNE ZASADY BEZPIECZEŃSTWA — CZYTAJ PRZED KAŻDĄ ZMIANĄ

### NAJWAŻNIEJSZA ZAKŁADKA — "Wpisy"
Zakładka "Wpisy" jest najważniejszą częścią aplikacji XPost Manager.
Wszelkie zmiany w main.js muszą być weryfikowane pod kątem wpływu
na tę zakładkę. Po każdej zmianie w main.js Claude sprawdza czy
następujące elementy są nienaruszone:
PARA_PROMPT, card-body, col-orig, col-para, orig-text, para-area,
card-note, note-inline, bexp, triggerAIPara, card-foot, linksH,
imgsH, refLinksHtml

### PARA_PROMPT — ABSOLUTNY ZAKAZ MODYFIKACJI
PARA_PROMPT (prompt do generowania parafrazy AI) działa perfekcyjnie
i nie może być w żaden sposób modyfikowany, skracany ani zmieniany
— chyba że użytkownik wyraźnie o to poprosi.

### ŚWIĘTE PLIKI — NIE MODYFIKOWAĆ bez wyraźnego polecenia
- `tgbot.py` — NIE MODYFIKOWAĆ (osobny projekt)
- `xparafbot.py` — tylko na wyraźne polecenie użytkownika
- Zakładka "Wpisy" w main.js — weryfikować diff po każdej zmianie

### PRZED KAŻDĄ ZMIANĄ — OBOWIĄZKOWE PYTANIA

Claude musi odpowiedzieć na każde pytanie ZANIM napisze kod:

1. Czy ta zmiana może wpłynąć na zakładkę "Wpisy"?
2. Czy ta zmiana może wpłynąć na dane w Firebase (duplikaty/utrata)?
3. Czy ta zmiana wpływa na funkcje które ładują lub zapisują dane?
4. Co się stanie jeśli jakaś zmienna będzie pusta lub niekompletna?
5. Czy istnieje ryzyko że funkcja wywoła się wielokrotnie?

Jeśli odpowiedź na którekolwiek pytanie brzmi TAK lub NIE WIEM
— Claude zatrzymuje się, wyjaśnia ryzyko i czeka na decyzję
użytkownika zanim napisze jakikolwiek kod.

### KRYTYCZNA ZASADA — syncSheets i posts
syncSheets() sprawdza duplikaty przez `if (!id || posts[id]) continue`.
posts MUSI zawierać wpisy ze statusem Odrzucone w pamięci — inaczej
syncSheets potraktuje je jako nowe i doda ponownie (tysiące duplikatów!).

NIGDY nie dodawaj where('status','!=','Odrzucone') do query posts w loadAll.
NIGDY nie limituj kolekcji posts bez upewnienia się że syncSheets nadal
widzi Odrzucone w pamięci.

### ZASADA PODGLĄDU PRZED MODYFIKACJĄ DANYCH
Każdy skrypt który modyfikuje dane w Firebase lub na VPS musi:
1. Najpierw pokazać CO zostanie zmienione (tryb podglądu)
2. Pokazać liczbę rekordów których dotyczy zmiana
3. Pokazać przykłady pierwszych i ostatnich rekordów
4. Czekać na wyraźne potwierdzenie użytkownika ("tak")
Nigdy nie modyfikuj danych bez pełnego podglądu i potwierdzenia.

### SKRYPTY VPS KOSZTUJĄ READS
Każdy skrypt Python który wywołuje `.stream()` na kolekcji posts
pobiera WSZYSTKIE dokumenty = ~3872+ odczytów Firebase za jednym razem.
Używaj skryptów diagnostycznych oszczędnie — tylko gdy konieczne.
Preferuj COUNT zamiast stream() gdy potrzebujesz tylko liczby.

### ZASADA JEDNEJ ZMIANY NA SESJĘ
Jedna sesja = jedna funkcjonalność lub jedna poprawka.
Nie łączyć wielu zmian w jednej sesji — każda zmiana
testowana i potwierdzona przed przejściem do następnej.

### BACKUP PRZED KAŻDĄ SESJĄ Z MODYFIKACJAMI
Przed wprowadzeniem jakichkolwiek zmian Claude przypomina o:
- Wykonaniu Git tag/release na GitHubie
- Zrobieniu screenshota aktualnego stanu aplikacji (liczba Nowych wpisów)
- Lokalnym backupie modyfikowanych plików

### ZASADA OSTROŻNOŚCI
Jeśli coś działa poprawnie — nie naprawiaj tego bez wyraźnej
potrzeby. Każda optymalizacja musi być poprzedzona pełną analizą
skutków ubocznych dla wszystkich funkcji które używają
modyfikowanych danych.

### KOMUNIKACJA Z UŻYTKOWNIKIEM
Claude zawsze informuje użytkownika o:
- Potencjalnych ryzykach przed wprowadzeniem zmiany
- Tym co dokładnie zostanie zmienione i dlaczego
- Możliwych skutkach ubocznych dla innych funkcji
Użytkownik nie jest programistą — wyjaśnienia muszą być
zrozumiałe i uczciwe, bez ukrywania ryzyka.

### JEŚLI COŚ PÓJDZIE NIE TAK — PLAN AWARYJNY
1. Natychmiast zakomentuj syncSheets w main.js (2 linie)
2. Poczekaj na deploy Vercel
3. NIE odświeżaj aplikacji
4. Dopiero potem naprawiaj skryptami
5. Duplikaty oznaczaj jako Odrzucone (NIE usuwaj) — chronią przed ponownym dodaniem

----

## WERSJONOWANIE main.js

### Aktualna wersja
main.js: v2.15 (2026-05-20)
Git tag: v2.15
Zmiany: VPS-API, Daily TODO, PWA, MOD1-8, _appInitialized,
        bulk TG, refreshTgData, copyAndOpenX, tgAutoLoad,
        naprawa dat ISO, sw.js przywrócony do prostej wersji

### Historia wersji
- v2.15 — 2026-05-20 — wszystkie MOD + _appInitialized (stabilna)
- v2.14 — przed firebase-opt (NIE używać — powoduje duplikaty)
- v2.0  — backup-przed-modami (najstarszy bezpieczny backup)

### Format komentarza wersji w main.js (na początku pliku)
```javascript
// ============================================================
// XPost Manager — main.js
// Wersja:          v2.XX
// Data:            YYYY-MM-DD
// Zmiany:          krótki opis
// Poprzednia:      v2.XX (opis)
// Git tag:         v2.XX
// ============================================================
```

### Zasady wersjonowania
- Claude dodaje komentarz wersji na początku każdego nowego main.js
- Numer wersji rośnie o 1 przy każdej sesji z modyfikacjami
- Po wgraniu na GitHub → zrób Git tag z tym samym numerem
- Aktualizuj sekcję "Aktualna wersja" w CONTEXT.md
- Przy problemie: sprawdź komentarz w pliku → wróć do poprzedniego tagu

### Jak wrócić do poprzedniej wersji
GitHub → repo → Tags → wybierz tag → pobierz ZIP →
wyciągnij src/main.js → wgraj przez GitHub Web UI → commit

----

## SESJA: Katastrofa Firebase + Naprawa (19-20 Maj 2026)

### CO SIĘ STAŁO — CHRONOLOGIA

#### Błąd który spowodował chaos
Próba optymalizacji Firebase przez zmianę query posts w loadAll:
```javascript
// BŁĘDNA ZMIANA — NIE UŻYWAĆ NIGDY:
getDocs(query(collection(db,'posts'), where('status','!=','Odrzucone'), ...))
```

#### Skutki
1. `posts` w pamięci nie zawierało Odrzuconych (3498 dokumentów)
2. syncSheets sprawdził `if (posts[id]) continue` — nie znalazł Odrzuconych
3. Potraktował 3498 starych wpisów jako nowe → dodał je ponownie do Firebase
4. Trzykrotnie powtórzył się ten scenariusz (łącznie ~9000 duplikatów)
5. Firebase quota wyczerpana trzy razy w ciągu jednego dnia

#### Jak naprawiono duplikaty
Skrypt oznaczający duplikaty jako Odrzucone (NIE usuwał — ważne!):
```bash
cd /root/vps-api && source venv/bin/activate
python3 -c "
import firebase_admin
from firebase_admin import credentials, firestore
cred = credentials.Certificate('/root/tgbot/firebase_service_key.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

# KROK 1: Najpierw podgląd — sprawdź które minuty mają duplikaty
docs = db.collection('posts').stream()
from collections import Counter
minutes = Counter()
for d in docs:
    added = d.to_dict().get('addedAt','')
    if '19.05.2026' in added or '20.05.2026' in added:
        minutes[added[:16]] += 1
for m,c in sorted(minutes.items()):
    print(f'{m}: {c}')

# KROK 2: Oznacz duplikaty (minuty z masowym dodaniem)
# Zmień daty na te które pokazał KROK 1
bad_minutes = ['19.05.2026 10:08','19.05.2026 10:09','19.05.2026 10:10','19.05.2026 10:11']
to_fix = [d.id for d in db.collection('posts').stream()
          if d.to_dict().get('addedAt','')[:16] in bad_minutes]
print(f'Do oznaczenia: {len(to_fix)}')

# KROK 3: Oznacz jako Odrzucone (batch po 500)
batch = db.batch()
batch_size = 0
for i, doc_id in enumerate(to_fix):
    batch.update(db.collection('posts').document(doc_id), {'status': 'Odrzucone'})
    batch_size += 1
    if batch_size == 500:
        batch.commit(); batch = db.batch(); batch_size = 0
        print(f'Zaktualizowano {i+1}/{len(to_fix)}...')
if batch_size > 0:
    batch.commit()
print('Gotowe!')
"
```

#### Dlaczego oznaczamy jako Odrzucone a NIE usuwamy
Odrzucone wpisy w Firebase chronią przed duplikatami — syncSheets
widzi je w pamięci (`posts[id]`) i pomija. Gdybyśmy usunęli,
syncSheets dodałby je ponownie przy następnym uruchomieniu.

### GŁÓWNA NAPRAWA — flaga _appInitialized

Problem: `onAuthStateChanged` odpala się wielokrotnie (przy odnowieniu
tokenu, zmianie stanu sieci, po deployu przez Service Worker).
Każde odpalenie wywoływało `loadAll()` + `syncSheets()` od nowa.

Rozwiązanie — flaga blokująca:
```javascript
let _appInitialized = false
onAuthStateChanged(auth, async user => {
  window._currentUser = user || null
  if (user) {
    showMainApp(user)
    if (_appInitialized) return  // ← KLUCZOWE — blokuje wielokrotne loadAll
    _appInitialized = true
    await loadAll()
    // ...
    await syncSheets()
    setInterval(syncSheets, 5 * 60 * 1000)
  } else {
    _appInitialized = false  // reset przy wylogowaniu
    showAuthScreen()
  }
})
```

UWAGA: `_appInitialized` jest zmienną modułu ES6 — nie jest widoczna
w `window` z konsoli przeglądarki. To normalne — działa poprawnie
wewnątrz modułu mimo że `window._appInitialized` zwraca `undefined`.

### PROBLEM Z SERVICE WORKER (sw.js)

Nowy sw.js który próbowaliśmy wdrożyć powodował błędy:
```
TypeError: Failed to execute 'put' on 'Cache': Request method 'POST' is unsupported
```
SW próbował cachować requesty POST do Firebase — niemożliwe.

ROZWIĄZANIE — przywrócono prostą wersję sw.js:
```javascript
const CACHE = 'xpost-v1'
const STATIC = ['/', '/index.html']

self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE).then(c => c.addAll(STATIC))
))

self.addEventListener('fetch', e => e.respondWith(
  caches.match(e.request).then(r => r || fetch(e.request))
))
```

WAŻNE: Ta prosta wersja sw.js jest prawidłowa dla tej aplikacji.
NIE zmieniaj sw.js na bardziej zaawansowany — powoduje problemy
z cachowaniem requestów Firebase i Google Sheets.

### PROBLEM Z SYNCSHEETS I CACHE SW

syncSheets pobierał dane Google Sheets z cache Service Workera
zamiast świeżych danych — przez co nie widział nowych wpisów.

Objaw: syncSheets zwraca `fulfilled` ale nie dodaje nowych wpisów.
Data w nagłówku odpowiedzi Google Sheets jest stara (wczorajsza).

Rozwiązanie: podmień sw.js na prostą wersję + hard refresh (`Ctrl+Shift+R`).

### LICZBA DOKUMENTÓW W FIREBASE (stan po naprawie, 20.05.2026)
```
posts:        ~3872 (w tym ~3498 Odrzucone)
tgSignals:      543
tgWpisy:        182
myPosts:         23
notes:           12
airdropTasks:  2411
refLinks:        18
konta:            3
```

Jedno otwarcie aplikacji = ~3872 odczytów (posts bez filtra).
Przy limicie 50K Spark = max ~13 otwarć dziennie.
Rozważyć migrację na Firebase Blaze (~$3-5/mies.).

### OPTYMALIZACJA FIREBASE — CO DZIAŁA, CO NIE DZIAŁA

✅ DZIAŁA BEZPIECZNIE:
- Usunięcie pollingu TG co 2 minuty
- Flaga _appInitialized blokująca wielokrotne loadAll
- tgAutoLoad = 0 (TG nie ładuje się przy starcie)
- Prosta wersja sw.js

❌ NIE UŻYWAĆ — POWODUJE DUPLIKATY:
- where('status','!=','Odrzucone') w query posts
- limit() na kolekcji posts bez zachowania Odrzuconych w pamięci
- Jakakolwiek modyfikacja query posts która wyklucza Odrzucone

### RESET LIMITU FIREBASE
Codziennie o 09:00 czasu polskiego (midnight Pacific Time, UTC-7 latem).

### PLAN AWARYJNY GDY ZNOWU POJAWIĄ SIĘ DUPLIKATY

1. Zakomentuj syncSheets w main.js (2 linie) → commit → czekaj na deploy
2. Sprawdź minuty masowego dodania:
```bash
python3 -c "
import firebase_admin; from firebase_admin import credentials, firestore
from collections import Counter
cred = credentials.Certificate('/root/tgbot/firebase_service_key.json')
firebase_admin.initialize_app(cred)
db = firestore.client()
docs = db.collection('posts').stream()
minutes = Counter()
for d in docs:
    added = d.to_dict().get('addedAt','')
    if 'DZISIAJ' in added:  # zmień na aktualną datę
        minutes[added[:16]] += 1
for m,c in sorted(minutes.items()): print(f'{m}: {c}')
"
```
3. Oznacz duplikaty jako Odrzucone (skrypt powyżej)
4. Odkomentuj syncSheets → commit
5. Hard refresh aplikacji

----

## SESJA: Daily TODO + Publikowanie na X (19-20 Maj 2026)

### Daily TODO — nowa zakładka

Zakładka "📋 Daily TODO" obok "Moje wpisy" w głównym menu.
Kolekcja Firebase: `dailyTasks`

#### Struktura dokumentu
```javascript
{
  id: 'todo_1716000000000',
  name: 'Netrun Testnet',
  links: [
    { label: 'App', url: 'https://app.netrun.xyz' },
    { label: 'Faucet', url: 'https://faucet.solana.com' },
  ],
  order: 0,
  checkedAt: null,      // null = niezrobione, ISO string = zrobione
  addedAt: '2026-05-19 10:00:00'
}
```

#### Reset dzienny
O 01:00 UTC = 02:00 czasu polskiego letniego / 01:00 zimowego.
Mechanizm przez localStorage (klucz `todoLastReset`).
Po zaznaczeniu checkbox — karta wyszarza się i zjeżdża na dół.
Po resecie — wraca na oryginalne miejsce (wg pola `order`).

#### Przycisk "📋 Dodaj do TODO" w zakładce Wpisy
Otwiera modal z edytowalną nazwą projektu i listą rozwinietych
linków z `p.links` (nie t.co!). Checkboxy do odznaczenia
niechcianych linków, edytowalne etykiety (domyślnie domena).

### Publikowanie na X — funkcja copyAndOpenX

Problem: konto X oflagowane — brak API.
Rozwiązanie: kopiuje tekst + otwiera x.com/compose/tweet.

```javascript
function copyAndOpenX(text) {
  navigator.clipboard.writeText(text).then(() => {
    toast('📋 Skopiowano! Wklejaj na X (Ctrl+V)')
    setTimeout(() => window.open('https://x.com/compose/tweet', '_blank'), 400)
  }).catch(() => {
    window.open('https://x.com/compose/tweet', '_blank')
    toast('Otwarto X — wklej tekst ręcznie')
  })
}
```

Przyciski "🐦 Publikuj na X" dodane w:
- Zakładka Wpisy — obok "Kopiuj parafrazę" (kopiuje parafrazę lub oryginał)
- Zakładka Moje wpisy — obok "Kopiuj wpis"

### tgbot.py — flagi włączania/wyłączania

Dodano do `/root/tgbot/.env`:
```
TG_SYGNALY_ENABLED=false
TG_WPISY_ENABLED=false
```

W tgbot.py (po linii WPISY_FILE):
```python
TG_SYGNALY_ENABLED = os.getenv('TG_SYGNALY_ENABLED', 'true').strip().lower() != 'false'
TG_WPISY_ENABLED   = os.getenv('TG_WPISY_ENABLED',   'true').strip().lower() != 'false'
```

Nie wymaga restartu — aktywne przy następnym uruchomieniu crona.

### tgAutoLoad — ustawienie w Firebase

Ile ostatnich wpisów TG ładować przy starcie aplikacji.
Zapisane w `airdropConfig/settings` jako pole `tgAutoLoad`.
Wartość 0 = wyłączone (tylko przycisk Odśwież).
Zmieniane w Ustawieniach aplikacji → "📡 Wczytywanie TG przy starcie".

Aktualna wartość: 0 (wyłączone)

### DO ZROBIENIA W KOLEJNYCH SESJACH

- [ ] **MOD 2** — Publikowanie na X przez API (wymaga odblokowania konta X)
- [ ] **MOD 6** — Słowa kluczowe w xparafbot.py + sekcja w Ustawieniach
- [ ] **MOD 7** — Pobieranie całych wątków w xparafbot.py
- [ ] **Eksport/import** — JSON/CSV dla zakładek: Wpisy, Moje wpisy, Daily TODO, Notatki, Linki ref, Konta
- [ ] **Grupy/tagi w Daily TODO** — każde zadanie max 3 tagi, filtrowanie po tagu
- [ ] **Firebase Blaze** — migracja na pay-as-you-go (~$3-5/mies.)

----
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

## Zakładka 🪂 Projekty (Airdrop/Testnet tracker)

Dodano nową zakładkę **"🪂 Projekty"** między "✍ Dodaj ręcznie" a "Więcej ▾".

### Firebase
- Nowa kolekcja: `airdropTasks`
- Pola dokumentu: `id`, `excelRow`, `status`, `type`, `project`, `tasks`, `date`, `socialLink`, `testnetLinks`, `wallet`, `imgUrl`, `note`, `hidden`, `addedAt`

### Struktura pól (odpowiednik kolumn Excel)
| Pole | Opis |
|------|------|
| `excelRow` | Numer wiersza z Excela (A-kolumna z numerami 1, 2600, 2601...) — zachowany przy imporcie |
| `status` | TODO / DONE na 1 koncie / DONE na 3 walletach / DONE na 3 kontach gmail / DONE na 5 walletach / Pominięty |
| `type` | Testnet / Mainnet / WL / Airdrop / Inne |
| `project` | Nazwa projektu |
| `tasks` | Co robiłeś (multi-line) |
| `date` | Data działań |
| `socialLink` | Link do socjali (Twitter, Discord...) |
| `testnetLinks` | Linki do testnet/działań — każdy w nowej linii |
| `wallet` | Portfel (Rabby, Phantom, Unisat...) |
| `imgUrl` | URL screenshota |
| `note` | Notatka |
| `hidden` | bool — ukryty wpis (nie pokazywany domyślnie, ale nie usunięty) |

### Sortowanie
Malejąco po `excelRow` (najwyższy numer = najnowszy = na górze). Wpisy dodane ręcznie dostają `max(excelRow) + 1` automatycznie.

### Widoki
- **Tabela** (domyślny) — `table-layout:fixed`, szerokość 1460px, wykracza poza `max-width:1140px` przez `margin:0 -1rem` na `#page-airdrop`
- **Karty** — przełącznik ☰/▦ w toolbarze
- Sticky nagłówki kolumn (`thead position:sticky`) działają przez `overflow:auto` na `.at-table-outer` z `max-height:72vh`

### Zwijane komórki
Wszystkie kolumny tekstowe zwijają się do limitu znaków. Przycisk rozwinięcia to cyjanowa pigułka `▼ więcej` / `▲ mniej`. Funkcje: `CC()` (tekst, auto-linkuje URL-e), `CL()` (lista linków), `atExpandCell(docId, field)`.

Limity: `project`=30, `tasks`=80, `date`=20, `socialLink`=32, `testnetLinks`=2 linki, `wallet`=20, `note`=80.

### Import z Excel (.xlsx)
- Przycisk "📥 Import .xlsx" — ładuje SheetJS z CDN lazy-load
- Pobiera dane z pierwszego arkusza (`SheetNames[0]`), wiersz 1 = nagłówek (pomijany)
- Kolejność kolumn w pliku: A=status, B=typ, C=projekt, D=zadania, E=data, F=link socjali, G=linki testnet, H=portfel, I=notatka
- `excelRow` = numer wiersza (i+1), zachowuje oryginalne numery z Excela

### Zaznaczanie i akcje masowe
- Checkbox przy każdym wierszu + "zaznacz wszystkie" w nagłówku (z `indeterminate`)
- Bulk bar pojawia się gdy coś zaznaczone: **🙈 Ukryj zaznaczone** | **🗑 Usuń zaznaczone** | **✕ Odznacz**
- `atSelected` = `Set` z docId

### Ukrywanie wpisów
- Przycisk 🙈 przy każdym wierszu — ustawia `hidden:true` w Firebase, wpis znika z listy (nie jest usunięty)
- Przycisk "👁 Pokaż ukryte" w toolbarze przełącza `atShowHidden` (bool, stan w pamięci)
- `toggleAtHide(docId)`, `hideAtSelected()`, `toggleAtShowHidden()`

### Filtry
- Wyszukiwarka tekstowa (projekt, zadania, notatka, portfel)
- Dropdown statusu
- Dropdown typu

### Funkcje JS (wszystkie w `window`)
`renderAirdrop`, `toggleAtView`, `toggleAtForm`, `openAtEdit`, `saveAt`, `deleteAt`, `setAtStatus`, `setAtField`, `importAtXlsx`, `atToggleOne`, `atToggleAll`, `updateAtBulkBar`, `deleteAtSelected`, `hideAtSelected`, `toggleAtHide`, `toggleAtShowHidden`, `atExpandCell`, `atLinkify`

### CSS (style.css)
Nowe klasy: `.at-table-outer`, `.at-page-inner`, `.at-table`, `.at-table thead`, `.at-table th/td`, `.at-row`, `.at-row-done`, `.at-row-sel`, `.at-card`, `.at-card-done`, `.at-card-sel`, `.at-card-head/tasks/foot/img`, `.at-collapsible`, `.at-cell-inner`, `.at-collapsed`, `.at-expand-btn`, `.at-expand-icon`, `.at-status-sel`, `.at-type-sel`, `.at-num-cell`, `.at-empty`, `.at-link`, `.at-type-badge`, `.at-view-btn`, `.at-chk`

---

### Sesja — XPost Manager, podsumowanie zmian
1. Zakładka 🪂 Projekty (airdropTasks) — rozbudowa
Widok i UX:

Dodano widok tabela + karty (przełącznik ☰/▦)
Tabela z table-layout:fixed, szerokość 1460px, wykracza poza max-width:1140px przez margin:0 -1rem na #page-airdrop
Sticky nagłówki kolumn (thead position:sticky) przez overflow:auto na .at-table-outer z max-height:72vh
Scrollbar poziomy zawsze widoczny
Wszystkie kolumny zwijalne — limit znaków: projekt=30, zadania=80, data=20, socialLink=32, testnetLinks=2 linki, portfel=20, notatka=80
Przycisk rozwinięcia: cyjanowa pigułka ▼ więcej / ▲ mniej
Kolumna # z numerem wiersza z Excela

Funkcje:

Import .xlsx (SheetJS CDN, lazy-load) — pobiera dane z pierwszego arkusza, zachowuje numery wierszy (excelRow)
Eksport do CSV (UTF-8 z BOM, działa w Excelu z polskimi znakami)
Duplikowanie projektu (przycisk ⧉, nowy numer max+1, status TODO)
Sortowanie po klikniętym nagłówku (↕/↑/↓) — kolumny: #, Status, Typ, Projekt, Data
Domyślne sortowanie malejąco po excelRow
Nowe wpisy ręczne dostają max(excelRow)+1 automatycznie
Zaznaczanie checkboxami + masowe usuwanie i masowe ukrywanie
Bulk bar z licznikiem i przyciskami
Ukrywanie wpisów (🙈) — pole hidden:true w Firebase, nie kasuje
Przycisk 👁 "Pokaż ukryte" — toggle atShowHidden
Naprawa licznika TODO/DONE — toUpperCase() dla case-insensitive

Archiwum projektów:

Nowa podzakładka 📦 Archiwum projektów w "Więcej"
Statystyki ukrytych (łącznie, typy, statusy)
Lista ukrytych z przyciskami "👁 Przywróć" i "🗑 Usuń na stałe"
Masowe: "Przywróć wszystkie" i "Usuń wszystkie na stałe"


2. Zakładka Wpisy — zmiany
Zasada: zero zmian w logice, filtrach, parafrazie, PARA_PROMPT.

Checkbox przy każdej karcie + bulk bar "Odrzuć zaznaczone" (ustawia status:'Odrzucone' zamiast kasować — wpis nie wraca po ponownym pobraniu)
Badge z liczbą nowych wpisów przy @konto (gdy >1)
@konto klikalne — otwiera modal podglądu profilu z: statystykami konta (Nowe/Do zrobienia/W toku/Opublikowane), listą 15 ostatnich wpisów, linkiem do X. Zamknięcie przez ✕, tło lub Escape
Przycisk 🪂 Dodaj do Projektów w card-foot — AI analizuje tweet (Groq/rotacja), wyciąga: nazwę projektu, zadania, linki testnet (regex + AI), typ. Zapisuje do airdropTasks


3. Zakładka 📊 Statystyki
Nowa zakładka między "🪂 Projekty" a "Więcej":

Liczniki wpisów: aktywne / nowe / opublikowane / odrzucone
Liczniki projektów: wszystkie / TODO / DONE / pominięte / ukryte
Wykres słupkowy aktywności z ostatnich 14 dni
Top 10 kont wg liczby aktywnych wpisów z paskami
Rozkład statusów projektów z kolorowymi paskami
Rozkład typów projektów


4. Zakładka 🤖 AI (aiTools)
Nowa zakładka, dane w Firestore (aiTools), widoczna na wszystkich urządzeniach:

Pola: nazwa, kategoria, opis, URL, tagi (przecinki), darmowe (checkbox), ocena 1-5
Karty z badge'ami kategorii, darmowe/płatne, gwiazdki
Filtry: szukaj tekstem, kategoria, darmowe/płatne
Pełny CRUD: dodaj, edytuj, usuń
Kategorie: Tekst, Obraz, Wideo, Audio, Kod, Analiza, Crypto/Web3, Inne


5. Zakładka ✍ Dodaj ręcznie — przebudowa
Szkice (manualDrafts):

Nowa kolekcja Firebase manualDrafts — szkice czekające na wysłanie
Lista szkiców pod formularzem z badge licznikiem
Każdy szkic: edycja (treść, konto, link, notatka), "✉ Wyślij do Wpisów", usuń
"Wyślij do Wpisów" → tworzy wpis w posts z manualEntry:true, status Nowy, usuwa szkic
Tekst zwijany do 120px z "▼ więcej"

Zdjęcie → Tekst:

Przycisk 📸 Dodaj ze zdjęcia zawsze widoczny w nagłówku zakładki
Zdjęcie → base64 w pamięci → Gemini Vision API
Fallback przy 429: Gemini → Groq Vision (meta-llama/llama-4-scout-17b-16e-instruct)
Prompt zachowuje oryginalne formatowanie, emoji, linki, nowe linie
Wynik zapisuje się jako szkic w manualDrafts (nie do formularza)
5 zdjęć = 5 osobnych szkiców, synchronizowane między urządzeniami


6. Zakładka Notatki

Wyszukiwarka tekstowa (filtruje w czasie rzeczywistym)
Przycisk 📋 Kopiuj przy każdej notatce (navigator.clipboard)
Edycja notatki inline (przycisk ✏️ Edytuj → textarea → 💾 Zapisz)


7. Ustawienia (podzakładka w Więcej)
Statusy i typy projektów:

Edytowalne listy statusów i typów (zapisywane w airdropConfig/settings)
Dodawanie, edycja inline, usuwanie

📡 Status API — limity Groq:

Lokalny licznik w localStorage (CORS blokuje nagłówki — jedyne wiarygodne rozwiązanie)
Trzy paski: RPM (30/min), TPM (6000/min), RPD (1000/dzień)
Kolory: zielony >50%, żółty >20%, czerwony ≤20%
Countdown do resetu minutowego i dziennego (północ UTC), odświeżany co sekundę
Alert 429 z licznikiem "Dostępne za: Xs"
Dane zbierane automatycznie przy każdej parafrazie i vision
Przycisk "Resetuj licznik"
Linki do konsol: Gemini AI Studio, Cerebras, SambaNova, OpenRouter

🍪 Cookies i sesja:

Info o sesji Firebase (email, ostatnie logowanie, auto-refresh tokenu)
Lista cookies JS-accessible
Info o lokalizacji cookies XParafBota na VPS


8. Firebase — nowe kolekcje
KolekcjaOpisairdropTasksProjekty airdrop/testnetairdropConfigUstawienia: statusy i typy projektówaiToolsNarzędzia AImanualDraftsSzkice w "Dodaj ręcznie"

9. Poprawki techniczne

Groq Vision: zmiana modelu z przestarzałego llama-3.2-90b-vision-preview na meta-llama/llama-4-scout-17b-16e-instruct
callAIJson — osobna funkcja AI dla JSON (używana przez "Dodaj do Projektów"), używa tej samej rotacji modeli co parafraza
getDoc dodany do importów Firebase
Vercel redeploy po zmianie klucza API — wymagany ręczny trigger

----
Oto podsumowanie wszystkich zmian z tej sesji:

Zmiany — sesja (panel szybkiego przeglądu + pozostałe)
1. Nowy status "ZROBIĆ" w zakładce Wpisy

Dodano status ZROBIĆ do dropdownów statusów we Wpisach, TG Sygnałach i TG Wpisach
Kolor: czerwony z font-weight:700 — wyróżnia się od innych statusów
Dodano do filtra statusów w wyszukiwarce zakładki Wpisy
Funkcja statusStyle() obsługuje nowy status


2. Panel szybkiego przeglądu w zakładce Wpisy
Przycisk 🔍 Szybki przegląd ▼ pod istniejącymi filtrami — rozwija panel zaawansowanych filtrów.
Nowe zmienne stanu:
jslet fMinLines  = ''    // min. liczba linii
let fMaxLines  = ''    // maks. liczba linii
let fMaxChars  = ''    // maks. liczba znaków
let fNoLinks   = false // tylko bez linków
let fNoMedia   = false // tylko bez mediów
let fDateFrom  = ''    // od daty
let fDateTo    = ''    // do daty
let fOlderDays = ''    // starsze niż X dni
let fDupes     = false // tylko duplikaty
let fPanelOpen = false // stan rozwinięcia panelu
Filtry w panelu:

Min. linii — tylko wpisy z co najmniej N niepustymi liniami (np. >10 = długie wpisy)
Maks. linii — tylko wpisy z max N liniami (np. <3 = krótkie wpisy)
Maks. znaków — tylko wpisy krótsze niż N znaków
Starsze niż X dni — tylko wpisy starsze niż podana liczba dni (np. 7 = zaległości)
Szybkie przyciski dat: Dziś / Wczoraj+dziś / Ten tydzień — ustawiają pola od/do jednym kliknięciem, podświetlają się po aktywacji (klasa .f-date-btn.active)
Data od / Data do — ręczny zakres dat po xDate
Tylko bez linków — checkbox, wyklucza wpisy z URL w treści lub polu links
Tylko bez mediów — checkbox, wyklucza wpisy z imgs.length > 0
Tylko duplikaty — checkbox (żółty), wykrywa wpisy z identycznym początkiem tekstu (pierwsze 60 znaków). Pokazuje wszystkie egzemplarze

Akcje w panelu:

☑ Zaznacz wszystkie widoczne — zaznacza checkboxy wszystkich widocznych kart i dodaje do mainSelected. Następnie bulk bar pozwala "Odrzuć zaznaczone"
✕ Wyczyść filtry panelu — resetuje tylko filtry panelu, główne filtry zostają

Licznik: Widocznych wpisów: N — aktualizowany przy każdym renderowaniu
Nowe funkcje JS:

toggleFilterPanel() — otwiera/zamyka panel
resetFilterPanel() — czyści wszystkie filtry panelu
selectAllVisible() — zaznacza wszystkie widoczne karty
setDateFilter(type) — obsługuje szybkie przyciski dat ('today', 'yesterday', 'week')


3. Szybki podgląd profilu (@konto) w zakładce Wpisy

Kliknięcie na @konto otwiera modal z podglądem profilu
Statystyki konta: Nowe / Do zrobienia / W toku / Opublikowane
Lista 15 ostatnich aktywnych wpisów z datą, statusem, skróconą treścią
Link "Otwórz na X ↗"
Zamknięcie: ✕, klik w tło, klawisz Escape
Funkcje: showAccountPanel(account), closeAccountPanel()


4. Naprawa błędu Groq Vision (zdjęcie → tekst)

Stary model llama-3.2-90b-vision-preview wycofany przez Groq → zamieniony na meta-llama/llama-4-scout-17b-16e-instruct
Dodano szczegółowy komunikat błędu z treścią odpowiedzi API
Dodano kompresję obrazu przed wysłaniem (max 1280px, JPEG 85%) — canvas API
Usunięto capture="environment" z input file → telefon pokazuje wybór galeria/aparat zamiast wymuszać aparat


5. Status API Groq — lokalny licznik (Ustawienia)

Zastąpiono próbę odczytu nagłówków CORS (niemożliwe w przeglądarce) lokalnym licznikiem w localStorage
Klucz: groqUsage_v1
Trzy paski postępu: RPM (30/min), TPM (6000/min), RPD (1000/dzień)
Kolory: zielony >50%, żółty >20%, czerwony ≤20%
Countdown do resetu minutowego i dziennego (północ UTC), odświeżany co sekundę
Alert 429 z licznikiem "Dostępne za: Xs" gdy Groq zwróci rate limit
Dane zbierane automatycznie przy każdej parafrazie i Groq Vision
Przycisk "Resetuj licznik" czyści localStorage
Funkcje: trackGroqCall(tokensUsed), trackGroq429(retryAfterSec), renderGroqStatusCard(), checkGroqStatus(), resetGroqCounter()


6. Pozostałe poprawki

Bulk bar Wpisy: "Odrzuć zaznaczone" ustawia status:'Odrzucone' zamiast kasować dokument — wpis nie wraca po ponownym pobraniu przez bota
Vercel redeploy: Po zmianie zmiennej środowiskowej (VITE_GROQ_API_KEY) wymagany ręczny trigger — przez Deployments → Redeploy lub pusty commit na GitHub

----
----

## SESJA: VPS-API + 7 MODYFIKACJI XPost Manager (Maj 2026)

---

### CO ZOSTAŁO ZBUDOWANE

#### 1. Nowy serwer VPS-API (`/root/vps-api/`)

Kompletny nowy serwer FastAPI na porcie 3099, działający jako most między frontendem (Vercel) a VPS.

**Pliki:**
- `/root/vps-api/main.py` — FastAPI app z endpointami
- `/root/vps-api/fetch_tweet.py` — skrypt pobierający pojedynczy tweet przez Playwright
- `/root/vps-api/link_bot.py` — bot Telegram (MOD 3)
- `/root/vps-api/start.sh` — start serwera przez PM2
- `/root/vps-api/start_link_bot.sh` — start bota przez PM2
- `/root/vps-api/tunnel_watcher.py` — automatyczna aktualizacja URL tunelu w Vercel
- `/root/vps-api/start_tunnel_watcher.sh` — start watchera przez PM2
- `/root/vps-api/.env` — zmienne środowiskowe serwera

**Uruchomienie PM2:**
```bash
pm2 start /root/vps-api/start.sh --name vps-api
pm2 start bash --name vps-api-tunnel -- -c "cloudflared tunnel --url http://localhost:3099"
pm2 start /root/vps-api/start_link_bot.sh --name vps-link-bot
pm2 start /root/vps-api/start_tunnel_watcher.sh --name vps-tunnel-watcher
pm2 save
```

**Auth wszystkich endpointów:** header `X-API-Key` musi być równy `VPS_API_KEY` z `.env`.

**Vercel — wymagane zmienne środowiskowe:**
- `VITE_VPS_URL` — URL tunelu (aktualizowany automatycznie przez watcher)
- `VITE_VPS_API_KEY` — ten sam co `VPS_API_KEY` w `.env` na VPS

**Endpointy:**
- `GET /health` — sprawdzenie czy serwer żyje
- `POST /fetch-tweet` — pobiera tweet po URL, zapisuje do Firebase `posts`
- `GET /accounts/x` — lista obserwowanych kont X
- `POST /accounts/x/add` — dodaj konto X
- `DELETE /accounts/x/remove` — usuń konto X
- `GET /accounts/tg/{type}` — lista kanałów TG (type: signals|wpisy)
- `POST /accounts/tg/add` — dodaj kanał TG
- `DELETE /accounts/tg/remove` — usuń kanał TG

**Zależności venv:**
```bash
pip install fastapi uvicorn python-dotenv firebase-admin python-telegram-bot==20.7 playwright requests
playwright install chromium
```

---

#### 2. MOD 1 — Linki ref w parafrazie AI

**Lokalizacja:** tylko `main.js`, funkcja `triggerAIPara`.

**Logika:**
Po wygenerowaniu parafrazy przez AI — wyciąga domeny z `p.links` (rozwinięte URL), porównuje z domenami z kolekcji `refLinks`, jeśli dopasowanie — dołącza mój link ref pod parafrazą, jeśli brak — dołącza oryginalny link z domeną.

```javascript
const getDomain = url => { try { return new URL(url).hostname.replace('www.','') } catch { return '' } }
```

Format: `🔗 nazwa: url` — oddzielone `\n\n` od parafrazy, każdy link w osobnej linii.
Całość zapisywana przez `updateDoc` (tak samo jak `savePara`).

---

#### 3. MOD 3 — Bot Telegram wykrywający linki X

**Plik:** `/root/vps-api/link_bot.py`
**Token:** `TG_LINK_BOT_TOKEN` z `.env` (można wziąć z `/root/xparafbot/.env` jako `TELEGRAM_BOT_TOKEN` — to ten sam bot)
**Biblioteka:** `python-telegram-bot==20.7` (NIE Telethon — to normalny bot)

Bot wykrywa wzorzec `twitter.com/status/` lub `x.com/status/` w wiadomościach, wywołuje `fetch_tweet.py` jako subprocess, odpowiada: `✅ Dodano wpis od @konto` lub `❌ Błąd: opis`.

---

#### 4. MOD 4 — Import z linku X w "Dodaj ręcznie"

**Lokalizacja:** `main.js` — zakładka "Dodaj ręcznie", sekcja nad listą szkiców.
**Funkcja:** `importFromX()` — eksponowana do `window`.

Pobiera URL z input `#import-x-url`, wysyła POST do `/fetch-tweet` przez VPS-API, po sukcesie: toast + `renderMain()` + `updateBadges()`. Wpis trafia bezpośrednio do `posts` (nie do `manualDrafts`) bo `/fetch-tweet` sam zapisuje do Firebase.

**Pomocnicze stałe (dodane do main.js):**
```javascript
const vpsHeaders = () => ({'Content-Type':'application/json','X-API-Key': import.meta.env.VITE_VPS_API_KEY || ''})
const vpsUrl = path => (import.meta.env.VITE_VPS_URL || '') + path
```

---

#### 5. MOD 5 — PWA

**Pliki w repo (folder `/public/`):**
- `manifest.json` — konfiguracja PWA (name, icons, theme_color: `#00e5ff`, background: `#484862`)
- `sw.js` — Service Worker cache dla `/` i `/index.html`
- `icon-192.png` i `icon-512.png` — ikony z napisem "XP" na tle `#484862`

**W `index.html` (w `<head>`):**
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#00e5ff">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="XPost">
<link rel="apple-touch-icon" href="/icon-192.png">
```

**W `main.js` (przed INIT):**
```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW:', e))
  })
}
```

---

#### 6. MOD 8 — Zarządzanie kontami X i kanałami TG z poziomu aplikacji

**W `main.js` (zakładka Ustawienia):**
- Trzy nowe sekcje: "📋 Obserwowane konta X", "📢 Kanały TG — Sygnały", "📢 Kanały TG — Wpisy"
- Funkcja `loadVpsAccounts()` — wywoływana automatycznie przy wejściu w Ustawienia
- Stan: `vpsAccountsX`, `vpsTgSignals`, `vpsTgWpisy`
- Funkcje: `vpsAddAccountX()`, `vpsRemoveAccountX(acc)`, `vpsAddTg(type)`, `vpsRemoveTg(type, ch)`
- Sekcje widoczne tylko gdy `import.meta.env.VITE_VPS_URL` jest ustawiony; jeśli nie — info o konfiguracji

**Na VPS:**
- Serwer czyta/modyfikuje pliki txt i wywołuje `pm2 reload` po każdej zmianie
- `observed_accounts.txt` — jedna nazwa per linia (bez @), linie `#` ignorowane
- `tg_sygnaly.txt` — format `ID: słowo1, słowo2` lub samo ID
- `tg_wpisy.txt` — jedna nazwa/ID per linia

---

#### 7. Tunnel Watcher — automatyczna aktualizacja URL w Vercel

**Problem:** Cloudflare trycloudflare.com zmienia URL po każdym restarcie tunelu.

**Rozwiązanie:** Skrypt `tunnel_watcher.py` co 5 minut:
1. Czyta pliki logów PM2 bezpośrednio z dysku (`~/.pm2/logs/vps-api-tunnel-*.log`) — NIE przez `pm2 logs` (zawiesza się)
2. Szuka wzorca `https://[a-z0-9-]+\.trycloudflare\.com` w ostatnich 8KB logów
3. Pobiera aktualną wartość `VITE_VPS_URL` z Vercel API (GET `/v9/projects/{id}/env`)
4. Jeśli URL się zmienił — aktualizuje przez PATCH `/v9/projects/{id}/env/{env_id}`
5. Po aktualizacji triggeruje redeploy Vercel

**Wymagane w `.env`:**
```
VERCEL_TOKEN=vcp_...         # Personal Account token z vercel.com/account/tokens
VERCEL_PROJECT_ID=prj_...    # z Vercel → projekt → Settings → General
VERCEL_TEAM_ID=              # puste dla personal account
PM2_TUNNEL_NAME=vps-api-tunnel
TUNNEL_CHECK_INTERVAL=300
```

**Ważne:** Token Vercel dla personal account zaczyna się od `vcp_` (nie `vercel_`).

---

#### 8. Optymalizacja Firebase — redukcja odczytów

**Problem:** Aplikacja przekraczała 50K odczytów/dzień (limit darmowego planu Firestore), czasem dochodząc do 278K. Powód: polling TG co 2 minuty pobierał CAŁE kolekcje `tgSignals` i `tgWpisy`.

**Rozwiązanie:**
- Usunięto automatyczny polling TG całkowicie
- TGBot sam zapisuje do Firestore — polling był zbędny
- Dodano przycisk **🔄 Odśwież** w obu zakładkach TG (pobiera dane na żądanie)
- Dodano przycisk **☑ Zaznacz widoczne** w obu zakładkach TG

**Reset limitu Firebase:** codziennie o **09:00 czasu polskiego** (midnight Pacific Time = UTC-7 latem).

---

#### 9. Bulk select w zakładkach TG Sygnały i TG Wpisy

Dodano funkcjonalność masowego odrzucania analogiczną do zakładki Wpisy:
- Checkbox przy każdej karcie
- Przycisk "☑ Zaznacz widoczne" — zaznacza wszystkie widoczne karty (po załadowaniu przez Odśwież)
- Pasek bulk z "Odrzuć zaznaczone" i "✕ Odznacz"

**WAŻNE — pułapka ES Modules:** Zmienne zdefiniowane w module ES6 (`tgSigSelected`, `tgWpiSelected`, `mainSelected`) NIE są dostępne bezpośrednio z atrybutów `onclick` w HTML. Tylko funkcje eksponowane przez `Object.assign(window, {...})` działają z onclick. Rozwiązanie: zawsze tworzyć funkcje-wrappery i eksponować je do `window`.

**Wzorzec który działa:**
```javascript
// ŹLE — nie działa z onclick:
onclick="tgSigSelected.clear()"

// DOBRZE — wrapper eksponowany do window:
function tgClearSig() { tgSigSelected.clear(); ... }
Object.assign(window, { tgClearSig })
// onclick="tgClearSig()"
```

**Wrappery dla TG bulk:**
- `tgToggleSig(id, checked)` / `tgToggleWpi(id, checked)` — toggle jednej karty
- `tgSelectAllSig()` / `tgSelectAllWpi()` — zaznacz wszystkie widoczne
- `tgClearSig()` / `tgClearWpi()` — odznacz wszystkie
- `tgRejectSig()` / `tgRejectWpi()` — odrzuć zaznaczone

**Odrzucenie TG:** ustawia `status: 'Odrzucone'` — dokument POZOSTAJE w Firestore jako "strażnik" duplikatów. TGBot sprawdza `doc_exists()` przed zapisem — nie doda ponownie tego samego wpisu.

---

### PROBLEMY I ICH ROZWIĄZANIA

#### Problem 1: `pm2 logs` zawiesza się w skryptach Python
`subprocess.run(["pm2", "logs", ..., "--nostream"])` zawiesza się po 15s timeout.

**Rozwiązanie:** Czytaj pliki logów PM2 bezpośrednio z dysku:
```python
log_path = Path.home() / ".pm2" / "logs" / f"{PM2_TUNNEL_NAME}-out.log"
with open(log_path) as f:
    f.seek(max(0, size - 8192))  # ostatnie 8KB
    content = f.read()
```

#### Problem 2: Cookies z rozszerzenia przeglądarki — błąd `sameSite`
`BrowserContext.add_cookies: cookies[0].sameSite: expected one of (Strict|Lax|None)`

Cookies z EditThisCookie mają format rozszerzenia przeglądarki:
- `sameSite: "unspecified"` zamiast wartości z `{Strict, Lax, None}`
- `expirationDate` zamiast `expires`
- Dodatkowe pola: `hostOnly`, `session`, `storeId`, `id`

**Rozwiązanie:** Konwerter cookies w `fetch_tweet.py`:
```python
VALID_SAMESITE = {"Strict", "Lax", "None"}
def convert_cookie(c):
    out = {
        'name': c.get('name',''), 'value': c.get('value',''),
        'domain': c.get('domain',''), 'path': c.get('path','/'),
        'httpOnly': bool(c.get('httpOnly',False)), 'secure': bool(c.get('secure',False)),
    }
    exp = c.get('expires') or c.get('expirationDate')
    if exp and isinstance(exp,(int,float)) and exp>0:
        out['expires'] = float(exp)
    ss = c.get('sameSite','')
    if ss in VALID_SAMESITE:
        out['sameSite'] = ss
    return out
```

#### Problem 3: `fetch_tweet.py` — błąd `No module named 'firebase_admin'`
Serwer VPS-API wywołuje `fetch_tweet.py` przez Python z venv xparafbota (`/root/xparafbot/venv/bin/python3`), ale `firebase_admin` był zainstalowany tylko w venv `vps-api`.

**Rozwiązanie:**
```bash
/root/xparafbot/venv/bin/pip install firebase-admin
echo "firebase-admin" >> /root/xparafbot/requirements.txt
```

#### Problem 4: Vercel API token — format `vcp_` vs `vercel_`
Nowe tokeny Personal Account Vercel zaczynają się od `vcp_`, nie `vercel_`. Oba formaty są prawidłowe.

#### Problem 5: `VITE_VPS_URL` nie istniała w Vercel — watcher zwracał błąd
Gdy zmienna nie istnieje w Vercel, API zwraca pustą listę `envs`. Skrypt zwracał błąd zamiast utworzyć zmienną.

**Rozwiązanie:** Gdy `env_id` jest `None` — użyj POST zamiast PATCH (stwórz nową zmienną).

#### Problem 6: Przycisk "Odznacz" nie odznaczał checkboxów wizualnie
`mainSelected.clear()` czyściło Set ale `renderMain()` nie było wywoływane — checkboxy pozostawały zaznaczone w DOM.

**Rozwiązanie:** Dodano funkcję `clearMainSelected()` eksponowaną do `window`:
```javascript
function clearMainSelected() {
  mainSelected.clear()
  updateMainBulkBar()
  renderMain()
}
```

#### Problem 7: Pusta strona po deployu — cache przeglądarki
Po deployu Vite generuje nową nazwę pliku JS (hash w nazwie). Przeglądarka trzyma stary plik z poprzedniego buildu.

**Rozwiązanie:** Hard refresh: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac), lub DevTools → prawy klik na odśwież → "Empty Cache and Hard Reload".

---

### AKTUALNY STAN PM2 NA VPS

```
signal-bot          ← bot sygnałów (istniejący)
kurator-server      ← serwer kuratora (NIE dotykać)
market-regime       ← (istniejący)
shadow-portfolio    ← (istniejący)
channel-tester      ← (istniejący)
vps-api             ← NOWY: FastAPI server port 3099
vps-api-tunnel      ← NOWY: Cloudflare tunnel
vps-link-bot        ← NOWY: Telegram link bot (MOD 3)
vps-tunnel-watcher  ← NOWY: Auto-update URL w Vercel co 5 min
```

**Zasada deploy:** zawsze `pm2 reload` (NIE restart), deploy po 22:00 UTC.

---

### NOWE ZMIENNE ŚRODOWISKOWE

**Vercel (VITE_*):**
```
VITE_VPS_URL=https://xxx.trycloudflare.com   ← aktualizowane automatycznie przez watcher
VITE_VPS_API_KEY=577bb4ba9fdb4fb20dc6c4014f1093e3
```

**VPS `/root/vps-api/.env`:**
```
VPS_API_KEY=577bb4ba9fdb4fb20dc6c4014f1093e3
TG_LINK_BOT_TOKEN=...     # ten sam co TELEGRAM_BOT_TOKEN w /root/xparafbot/.env
FIREBASE_CREDENTIALS=/root/tgbot/firebase_service_key.json
XPARAFBOT_DIR=/root/xparafbot
VERCEL_TOKEN=vcp_...
VERCEL_PROJECT_ID=prj_bvdAduHiBseeWEXn1ChjGGdXpOPi
VERCEL_TEAM_ID=
PM2_TUNNEL_NAME=vps-api-tunnel
TUNNEL_CHECK_INTERVAL=300
```

---

### DO ZROBIENIA W KOLEJNYCH SESJACH

- [ ] **MOD 2** — Publikowanie na X przez API (wymaga API Key od X — `developer.x.com`, plan Pay-per-use: $0.01/tweet)
- [ ] **MOD 6** — Słowa kluczowe: nowa kolekcja Firebase `keywords`, wyszukiwanie przez GraphQL SearchTimeline w `xparafbot.py`, sekcja w Ustawieniach
- [ ] **MOD 7** — Pobieranie całych wątków: funkcja `is_thread()` + `fetch_full_thread()` w `xparafbot.py`
- [ ] **Problem wpisów manualnych przy filtrze "Wszystkie konta"** — wpisy `manual_*` pojawiają się tylko po wybraniu konkretnego konta z listy; przy "Wszystkie konta" znikają (prawdopodobnie problem z formatem daty `xDate` lub porównaniem w filtrze — wymaga debugowania po odnowieniu limitu Firebase)
- [ ] **Migracja na Firebase Blaze** — rozważyć plan pay-as-you-go (~$3-5/mies.) zamiast codziennego wyczerpywania limitu

----
----

## POPRAWKA: Wpisy manualne niewidoczne przy filtrze "Wszystkie konta"

### Problem
Wpisy dodane ręcznie przez import z linku X (`fetch_tweet.py`) nie wyświetlały się w zakładce Wpisy przy filtrze "Wszystkie konta". Były widoczne tylko po wybraniu konkretnego konta z listy.

### Przyczyna
Dwa niezależne błędy:

1. **Format daty** — `fetch_tweet.py` zapisywał `xDate` w formacie polskim (`18.05.2026 02:37:57`), podczas gdy normalne wpisy z xparafbota mają format ISO (`2026-05-18 19:27:00`). Sortowanie w `renderMain()` przez `localeCompare` dawało błędne wyniki przy mieszaniu obu formatów — wpis manualny lądował poza widocznym zakresem.

2. **Sortowanie bez konwersji** — linia sortująca w `main.js` nie konwertowała dat przed porównaniem:
   ```javascript
   // ŹLE:
   .sort((a,b) => (b.xDate||b.addedAt).localeCompare(a.xDate||a.addedAt))
   ```

### Rozwiązanie

**1. Naprawiono `fetch_tweet.py`** — zmiana formatu daty na ISO:
```python
# BYŁO:
def now_str():
    return datetime.now().strftime("%d.%m.%Y %H:%M:%S")

# JEST:
def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
```

**2. Naprawiono sortowanie w `main.js`** — dodano helper `parseDateToISO()`:
```javascript
// Parsuje datę w formacie ISO (2026-05-18) lub PL (18.05.2026) → string sortowalny ISO
const parseDateToISO = str => {
  if (!str) return ''
  const m = str.match(/^(\d{2})\.(\d{2})\.(\d{4})(.*)/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}${m[4]}`
  return str
}

// Sortowanie używa helpera:
.sort((a,b) => parseDateToISO(b.xDate||b.addedAt).localeCompare(parseDateToISO(a.xDate||a.addedAt)))
```

**3. Naprawiono istniejące wpisy w Firebase** — jednorazowy skrypt na VPS:
```bash
cd /root/vps-api && source venv/bin/activate
python3 -c "
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

cred = credentials.Certificate('/root/tgbot/firebase_service_key.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

docs = db.collection('posts').where('manualEntry','==',True).stream()
for d in docs:
    data = d.to_dict()
    xdate = data.get('xDate','')
    try:
        dt = datetime.strptime(xdate, '%d.%m.%Y %H:%M:%S')
        new_date = dt.strftime('%Y-%m-%d %H:%M:%S')
        db.collection('posts').document(d.id).update({'xDate': new_date, 'addedAt': new_date})
        print(f'Naprawiono {d.id}: {xdate} -> {new_date}')
    except:
        print(f'Pomijam {d.id}: {xdate} (już OK)')
"
```

### Zasada na przyszłość
Wszystkie daty zapisywane do Firebase muszą być w formacie ISO: `YYYY-MM-DD HH:MM:SS`. Dotyczy pól `xDate`, `addedAt`, `archivedAt`. Format PL (`DD.MM.YYYY`) jest używany tylko do wyświetlania w UI, nigdy do zapisu.

----

----
----

----

## PROMPT STARTOWY

Wklej poniższy blok jako pierwszą wiadomość w nowym czacie:

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
