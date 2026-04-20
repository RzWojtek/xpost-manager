# 🔧 INSTRUKCJA ODTWORZENIA VPS OD ZERA
### XParafBot + TGBot — pełna instalacja na świeżym Ubuntu

> Używaj tej instrukcji gdy VPS został zresetowany lub masz nowy serwer.
> Wykonuj kroki **PO KOLEI** — każdy zależy od poprzedniego.

---

## 📋 CZEGO POTRZEBUJESZ PRZED ROZPOCZĘCIEM

Zgromadź te rzeczy zanim zaczniesz — będą potrzebne w trakcie:

| Co | Gdzie to znajdziesz |
|---|---|
| IP adres VPS | Panel dostawcy VPS (np. Hostinger, Hetzner) |
| Hasło root VPS | Panel dostawcy VPS / email powitalny |
| Plik `x_cookies.json` | Eksport z Chrome przez EditThisCookie |
| Plik `google_credentials.json` | Google Cloud Console → projekt `xparafbot` |
| Plik `firebase_service_key.json` | Firebase Console → xpost-manager → Ustawienia → Konta usługi |
| Google Sheet ID | URL arkusza: `docs.google.com/spreadsheets/d/TUTAJ_ID/` |
| Telegram Bot Token | BotFather na Telegramie |
| Telegram Chat ID | Wyślij wiadomość do bota, sprawdź przez `api.telegram.org` |
| Groq API Key | `console.groq.com` |
| Cloudinary dane | `cloudinary.com` → Dashboard |
| TG API ID + API HASH | `my.telegram.org` → API development tools |
| Numer telefonu do TG | Ten który należy do monitorowanych kanałów |

---

## ═══════════════════════════════════════════
## ETAP 1 — PIERWSZE POŁĄCZENIE Z VPS
## ═══════════════════════════════════════════

### Krok 1.1 — Połącz się przez PuTTY

1. Otwórz **PuTTY**
2. W polu `Host Name` wpisz IP swojego VPS (np. `185.202.239.239`)
3. Port: `22`, Connection type: `SSH`
4. Kliknij **Open**
5. Jeśli pojawi się okienko z kluczem — kliknij **Accept**
6. Login: `root`
7. Hasło: (wpisz hasło z panelu VPS — podczas pisania nic nie widać, to normalne)

### Krok 1.2 — Zaktualizuj system

Wpisuj każdą komendę osobno i czekaj aż się wykona:

```bash
apt update
```
```bash
apt upgrade -y
```

Jeśli pojawi się pytanie (niebieskie okienko) — naciśnij Enter aby zatwierdzić domyślną opcję.

---

## ═══════════════════════════════════════════
## ETAP 2 — INSTALACJA PYTHON I NARZĘDZI
## ═══════════════════════════════════════════

### Krok 2.1 — Sprawdź wersję Python

```bash
python3 --version
```

Powinno pokazać `Python 3.12.x` lub nowszy. Jeśli pokazuje starszy niż 3.10:

```bash
apt install python3.12 python3.12-pip -y
```

### Krok 2.2 — Zainstaluj pip i podstawowe narzędzia

```bash
apt install python3-pip python3-venv curl wget git nano -y
```

### Krok 2.3 — Zainstaluj Chromium i zależności Playwright

```bash
apt install chromium-browser -y
```
```bash
apt install libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libxkbcommon0 libpango-1.0-0 libcairo2 libasound2 -y
```

### Krok 2.4 — Zainstaluj biblioteki Python dla XParafBot

```bash
pip install playwright --break-system-packages
```
```bash
playwright install chromium
```
```bash
pip install gspread google-auth google-auth-oauthlib --break-system-packages
```
```bash
pip install python-dotenv requests --break-system-packages
```
```bash
pip install groq --break-system-packages
```
```bash
pip install cloudinary --break-system-packages
```

### Krok 2.5 — Zainstaluj biblioteki Python dla TGBot

```bash
pip install telethon --break-system-packages
```
```bash
pip install firebase-admin --break-system-packages --ignore-installed typing-extensions
```

Jeśli powyższe nie zadziała z błędem typing-extensions:
```bash
pip install firebase-admin --break-system-packages --no-deps
pip install pyjwt protobuf google-auth google-cloud-firestore google-cloud-storage cachecontrol --break-system-packages --ignore-installed
```

### Krok 2.6 — Sprawdź czy wszystko zainstalowane

```bash
python3 -c "import playwright; print('playwright OK')"
python3 -c "import gspread; print('gspread OK')"
python3 -c "import telethon; print('telethon OK')"
python3 -c "import firebase_admin; print('firebase_admin OK')"
python3 -c "import dotenv; print('dotenv OK')"
```

Każda linia powinna wypisać OK.

---

## ═══════════════════════════════════════════
## ETAP 3 — WGRANIE PLIKÓW PRZEZ WinSCP
## ═══════════════════════════════════════════

### Krok 3.1 — Połącz się przez WinSCP

1. Otwórz **WinSCP**
2. Protocol: `SFTP`
3. Host name: IP Twojego VPS
4. Port: `22`
5. Username: `root`
6. Password: hasło VPS
7. Kliknij **Login**
8. Jeśli pojawi się okienko z kluczem — kliknij **Yes**

### Krok 3.2 — Stwórz foldery na VPS

W PuTTY wpisz:
```bash
mkdir -p /root/xparafbot
mkdir -p /root/tgbot
```

### Krok 3.3 — Wgraj pliki XParafBot

W WinSCP przejdź do `/root/xparafbot/` i wgraj:

| Plik | Skąd |
|---|---|
| `xparafbot.py` | Twój komputer (ostatnia wersja z GitHub lub backup) |
| `login_x.py` | Twój komputer |
| `observed_accounts.txt` | Twój backup |
| `x_cookies.json` | Świeży eksport z Chrome przez EditThisCookie |
| `google_credentials.json` | Google Cloud Console (pobierz świeży jeśli nie masz) |
| `last_seen.json` | Twój backup LUB stwórz pusty (patrz niżej) |

Jeśli nie masz `last_seen.json` — stwórz pusty przez PuTTY:
```bash
echo '{}' > /root/xparafbot/last_seen.json
```

### Krok 3.4 — Stwórz plik .env dla XParafBot

W WinSCP kliknij prawym przyciskiem w `/root/xparafbot/` → **New** → **File** → nazwa: `.env`

Wklej i uzupełnij:
```
GOOGLE_SHEET_ID=WPISZ_ID_ARKUSZA
GOOGLE_SHEET_URL=https://docs.google.com/spreadsheets/d/WPISZ_ID_ARKUSZA/
TELEGRAM_BOT_TOKEN=WPISZ_TOKEN_BOTA
TELEGRAM_CHAT_ID=WPISZ_CHAT_ID
GROQ_API_KEY=WPISZ_GROQ_KEY
CLOUDINARY_CLOUD=dvdud5uxy
CLOUDINARY_KEY=297745586692791
CLOUDINARY_SECRET=mK-ylzSqoDUoW0Ou620
```

### Krok 3.5 — Wgraj pliki TGBot

W WinSCP przejdź do `/root/tgbot/` i wgraj:

| Plik | Skąd |
|---|---|
| `tgbot.py` | Twój komputer |
| `login_tg.py` | Twój komputer |
| `tg_sygnaly.txt` | Twój backup |
| `tg_wpisy.txt` | Twój backup |
| `firebase_service_key.json` | Firebase Console (pobierz świeży jeśli nie masz) |

Stwórz pusty stan TGBot:
```bash
echo '{}' > /root/tgbot/tg_last_seen.json
```

### Krok 3.6 — Stwórz plik .env dla TGBot

W WinSCP w `/root/tgbot/` stwórz plik `.env`:
```
TG_API_ID=21596975
TG_API_HASH=e9cf842e116bccd385c4ace41df306e6
FIREBASE_SERVICE_KEY=/root/tgbot/firebase_service_key.json
TELEGRAM_BOT_TOKEN=WPISZ_TOKEN_BOTA
TELEGRAM_CHAT_ID=WPISZ_CHAT_ID
```

> Token i Chat ID — te same wartości co w XParafBot `.env`

### Krok 3.7 — Ustaw uprawnienia do plików

```bash
chmod 600 /root/xparafbot/.env
chmod 600 /root/xparafbot/google_credentials.json
chmod 600 /root/xparafbot/x_cookies.json
chmod 600 /root/tgbot/.env
chmod 600 /root/tgbot/firebase_service_key.json
```

---

## ═══════════════════════════════════════════
## ETAP 4 — LOGOWANIE I TEST XPARAFBOT
## ═══════════════════════════════════════════

### Krok 4.1 — Test XParafBot

```bash
cd /root/xparafbot
python3 xparafbot.py
```

Powinieneś zobaczyć:
```
══════════════════════════════════════════════════
  🤖 XParafBot v6.1 — 2026-XX-XX XX:XX:XX
══════════════════════════════════════════════════
✅ Cookies: XX załadowanych
📋 Konta (XX): @...
✅ Google Sheets: połączono
```

Jeśli widzisz błędy — patrz Etap 8 (Rozwiązywanie problemów).

---

## ═══════════════════════════════════════════
## ETAP 5 — LOGOWANIE I TEST TGBOT
## ═══════════════════════════════════════════

### Krok 5.1 — Jednorazowe logowanie do Telegrama

> ⚠️ Musisz zalogować się na numer telefonu który należy do monitorowanych kanałów TG

```bash
cd /root/tgbot
python3 login_tg.py
```

Skrypt zapyta o numer telefonu:
```
📞 Podaj numer telefonu (z kierunkowym, np. +48123456789):
```
→ Wpisz np. `+48123456789`

Telegram wyśle kod — wpisz go:
```
🔑 Wpisz kod z Telegrama:
```

Jeśli masz 2FA:
```
🔒 Masz 2FA — wpisz hasło do Telegrama:
```

Po zalogowaniu zobaczysz:
```
✅ Zalogowano pomyślnie!
   Plik sesji: /root/tgbot/tgbot_session.session
```

### Krok 5.2 — Test TGBot

```bash
python3 tgbot.py
```

Powinieneś zobaczyć:
```
══════════════════════════════════════════════════════
  📱 TGBot v1.0 — 2026-XX-XX XX:XX:XX
══════════════════════════════════════════════════════
✅ Firebase: połączono
✅ Telegram: połączono
```

---

## ═══════════════════════════════════════════
## ETAP 6 — KONFIGURACJA CRON
## ═══════════════════════════════════════════

### Krok 6.1 — Otwórz edytor CRON

```bash
crontab -e
```

Jeśli pyta o edytor — wpisz `1` (nano) i Enter.

### Krok 6.2 — Dodaj wpisy

Na końcu pliku dodaj te dwie linie:

```
*/50 * * * * cd /root/xparafbot && python3 xparafbot.py >> /root/xparafbot/xparafbot.log 2>&1
*/30 * * * * cd /root/tgbot && python3 tgbot.py >> /root/tgbot/tgbot.log 2>&1
```

Zapisz: `Ctrl+X` → `Y` → `Enter`

### Krok 6.3 — Sprawdź czy CRON zapisał

```bash
crontab -l
```

Powinny być widoczne obie linie.

### Krok 6.4 — Sprawdź czy CRON działa

Poczekaj 30-50 minut, potem sprawdź logi:

```bash
tail -30 /root/xparafbot/xparafbot.log
tail -30 /root/tgbot/tgbot.log
```

---

## ═══════════════════════════════════════════
## ETAP 7 — WERYFIKACJA DZIAŁANIA
## ═══════════════════════════════════════════

### Krok 7.1 — Sprawdź czy XParafBot zapisuje do Sheets

1. Otwórz swój Google Sheet
2. Poczekaj na kolejne uruchomienie CRON (co 50 min) lub uruchom ręcznie:
   ```bash
   cd /root/xparafbot && python3 xparafbot.py
   ```
3. Sprawdź czy pojawiły się nowe wiersze w arkuszu

### Krok 7.2 — Sprawdź czy TGBot zapisuje do Firebase

1. Wejdź na `console.firebase.google.com`
2. Projekt `xpost-manager` → Firestore Database
3. Sprawdź kolekcje `tgSignals` i `tgWpisy`

### Krok 7.3 — Sprawdź XPost Manager

1. Otwórz aplikację na Vercel
2. Kliknij "Synchronizuj" — powinien pojawić się napis `sync: HH:MM`
3. Sprawdź zakładki TG Sygnały i TG Wpisy

---

## ═══════════════════════════════════════════
## ETAP 8 — ROZWIĄZYWANIE PROBLEMÓW
## ═══════════════════════════════════════════

### Problem: `ModuleNotFoundError: No module named 'playwright'`
```bash
pip install playwright --break-system-packages
playwright install chromium
```

### Problem: `ModuleNotFoundError: No module named 'gspread'`
```bash
pip install gspread google-auth --break-system-packages
```

### Problem: `ModuleNotFoundError: No module named 'telethon'`
```bash
pip install telethon --break-system-packages
```

### Problem: `ModuleNotFoundError: No module named 'firebase_admin'`
```bash
pip install firebase-admin --break-system-packages --ignore-installed typing-extensions
```

### Problem: `❌ Brak pliku google_credentials.json`
→ Pobierz świeży klucz serwisowy:
1. `console.cloud.google.com` → projekt `xparafbot`
2. IAM → Konta usługi → `xparafbot-service@...`
3. Klucze → Dodaj klucz → JSON → Pobierz
4. Zmień nazwę na `google_credentials.json` i wgraj przez WinSCP

### Problem: `❌ Brak pliku firebase_service_key.json`
→ Pobierz świeży klucz:
1. `console.firebase.google.com` → `xpost-manager`
2. Ustawienia projektu → Konta usługi
3. Wygeneruj nowy klucz prywatny → Pobierz
4. Zmień nazwę na `firebase_service_key.json` i wgraj przez WinSCP

### Problem: `❌ Brak auth_token lub ct0 w cookies!`
→ Cookies wygasły. Musisz odświeżyć:
1. Zaloguj się na `x.com` w Chrome
2. Zainstaluj rozszerzenie **EditThisCookie**
3. Kliknij ikonę rozszerzenia → Export (ikona strzałki w dół)
4. Skopiuj JSON → zapisz jako `x_cookies.json`
5. Wgraj przez WinSCP do `/root/xparafbot/`

### Problem: `Could not find the input entity for PeerChannel`
→ Konto Telegram nie należy do tego kanału.
→ Sprawdź czy sesja jest zalogowana właściwym numerem:
```bash
cd /root/tgbot
rm tgbot_session.session
python3 login_tg.py
```
→ Zaloguj się numerem który należy do monitorowanych kanałów.

### Problem: Playwright nie uruchamia przeglądarki
```bash
playwright install chromium --with-deps
```
lub:
```bash
apt install chromium-browser -y
```

### Problem: CRON nie uruchamia bota
Sprawdź czy CRON jest aktywny:
```bash
systemctl status cron
```
Jeśli nie działa:
```bash
systemctl start cron
systemctl enable cron
```

### Problem: `Permission denied` przy uruchamianiu skryptu
```bash
chmod +x /root/xparafbot/xparafbot.py
chmod +x /root/tgbot/tgbot.py
```

---

## ═══════════════════════════════════════════
## ETAP 9 — BACKUP (rób regularnie!)
## ═══════════════════════════════════════════

### Co musisz mieć w backupie żeby odtworzyć wszystko:

| Plik | Dlaczego ważny |
|---|---|
| `x_cookies.json` | Bez tego XParafBot nie działa |
| `google_credentials.json` | Dostęp do Google Sheets |
| `firebase_service_key.json` | Dostęp do Firebase (TGBot) |
| `observed_accounts.txt` | Lista kont X do monitorowania |
| `tg_sygnaly.txt` | Lista kanałów TG z filtrami |
| `tg_wpisy.txt` | Lista kanałów TG bez filtrów |
| `last_seen.json` | Stan bota X (bez tego pobierze stare posty) |
| `tg_last_seen.json` | Stan bota TG |
| Oba pliki `.env` | Wszystkie klucze API |

### Jak zrobić backup przez WinSCP:
1. Połącz się z VPS przez WinSCP
2. Przejdź do `/root/xparafbot/` — pobierz wszystkie pliki na komputer
3. Przejdź do `/root/tgbot/` — pobierz wszystkie pliki na komputer
4. Zapisz w bezpiecznym miejscu (np. zaszyfrowany folder)

### Automatyczny backup przez CRON (opcjonalnie):
Możesz dodać do CRON komendę która co tydzień tworzy archiwum:
```bash
0 3 * * 0 tar -czf /root/backup_$(date +%Y%m%d).tar.gz /root/xparafbot /root/tgbot 2>&1
```

---

## ═══════════════════════════════════════════
## SZYBKA ŚCIĄGAWKA — NAJWAŻNIEJSZE KOMENDY
## ═══════════════════════════════════════════

```bash
# Test ręczny botów
cd /root/xparafbot && python3 xparafbot.py
cd /root/tgbot && python3 tgbot.py

# Logi
tail -50 /root/xparafbot/xparafbot.log
tail -50 /root/tgbot/tgbot.log
tail -f /root/tgbot/tgbot.log          # logi na żywo (Ctrl+C aby wyjść)

# CRON
crontab -l                              # podgląd
crontab -e                              # edycja

# Ponowne logowanie TG (gdy sesja wygasła)
cd /root/tgbot
rm tgbot_session.session
python3 login_tg.py

# Sprawdź procesy
ps aux | grep python3

# Restart CRON
systemctl restart cron
```

---

## LISTA KONTROLNA — CHECKLIST

Po wykonaniu wszystkich kroków zaznacz:

```
☐ 1.  System Ubuntu zaktualizowany (apt update && apt upgrade)
☐ 2.  Python 3.10+ zainstalowany
☐ 3.  pip i podstawowe narzędzia zainstalowane
☐ 4.  Chromium i zależności zainstalowane
☐ 5.  Biblioteki Python dla XParafBot zainstalowane
☐ 6.  Biblioteki Python dla TGBot zainstalowane
☐ 7.  Folder /root/xparafbot/ stworzony i wypełniony plikami
☐ 8.  Plik .env XParafBot uzupełniony
☐ 9.  Folder /root/tgbot/ stworzony i wypełniony plikami
☐ 10. Plik .env TGBot uzupełniony
☐ 11. XParafBot przetestowany ręcznie (python3 xparafbot.py)
☐ 12. Zalogowano do Telegram (python3 login_tg.py)
☐ 13. TGBot przetestowany ręcznie (python3 tgbot.py)
☐ 14. CRON skonfigurowany (crontab -e)
☐ 15. Po 1h sprawdzone logi obu botów
☐ 16. XPost Manager na Vercel działa (sync z Sheets i Firebase)
☐ 17. Backup plików zrobiony na komputer lokalny
```

---

*Instrukcja dla VPS Ubuntu 24 | XParafBot v6.1 + TGBot v1.0*
*Ostatnia aktualizacja: Kwiecień 2026*
