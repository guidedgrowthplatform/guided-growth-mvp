# Demo Video Script — MR !21: Sprint 1 Final

> **Total durasi**: ~12-15 menit
> **Recorder**: OBS Studio (recommended) atau Win+G (Game Bar)
> **Resolution**: 1920x1080, 30fps
> **Browser**: Chrome (mic permission paling smooth)

---

## SCENE 0: PERSIAPAN (jangan direkam)

### Buka semua ini dulu:

1. **Chrome Tab 1** — GitLab MR: `https://gitlab.com/guidedgrowth-group/guided-growth-mvp/-/merge_requests/21`
2. **Chrome Tab 2** — App: `https://guided-growth-mvp-six.vercel.app`
3. **Chrome Tab 3** — kosong (buat API test nanti)
4. **Terminal** (Git Bash) — `cd /c/DATASAID/PAKYAIR/GUIDEDGROWTHMVP`, font size 16-18pt
5. **VS Code** — buka folder GUIDEDGROWTHMVP

### Pre-flight checklist:

- [ ] Mic laptop berfungsi (test di Windows sound settings)
- [ ] Chrome mic permission granted untuk vercel.app
- [ ] Sudah login di app (Tab 2) — biar ga perlu login on-camera
- [ ] Terminal cleared (`clear`)
- [ ] OBS ready, capture seluruh screen

### Kalau mau demo Whisper:

- Buka app > Settings > pilih Whisper > klik mic sekali > TUNGGU model download (~40MB)
- Setelah download selesai, switch balik ke Web Speech API
- Nanti waktu demo tinggal switch, model udah cached

---

## SCENE 1: Intro — GitLab MR Overview (~1.5 menit)

**[TAB: GitLab MR !21]**

**NGOMONG:**

> "Oke, jadi ini MR Sprint 1 Final kita. Branch `feat/voice-mock-testing` merge ke `main`.
> Total 68 file berubah, closing 6 issues sekaligus."

**YANG DILAKUIN:**

1. Tunjukin judul MR dan branch name
2. Scroll pelan ke **Issues Resolved** — point:
   - "#41 CRUD fix"
   - "#42 voice context auto-clear"
   - "#43 data anonymization"
   - "#24 mic permissions mobile"
   - "#27 mobile bug fixes"
   - "#45 ElevenLabs STT"
3. Scroll ke tabel **Security Audit Fixes** — highlight 4 CRITICAL:
   > "Ada 4 critical security fix — sebelumnya Deepgram token, process-command, sama admin endpoint bisa diakses tanpa auth."
4. Scroll ke **Test Results**: 59/59 PASSED
5. Tunjukin **Pipeline status**: SUCCESS (hijau)

---

## SCENE 2: Terminal — Unit Tests, Build, E2E (~3 menit)

**[TAB: Terminal]**

### 2a. Unit Tests

**NGOMONG:**

> "Kita buktiin dari kode dulu. 59 unit test, 5 suite."

**KETIK:**

```bash
npm test
```

**TUNGGU OUTPUT:**

```
✓ cellColors        (11 tests)
✓ anonymize         (14 tests)
✓ dates             (10 tests)
✓ streaks           (4 tests)
✓ data-service      (20 tests)

Test Files  5 passed (5)
     Tests  59 passed (59)
```

**NGOMONG:**

> "59/59 passed. Termasuk 14 test baru untuk anonymization."

### 2b. TypeScript + Build

**NGOMONG:**

> "Type check dan production build."

**KETIK:**

```bash
npx tsc --noEmit && echo "=== TSC CLEAN ===" && npm run build
```

**NGOMONG (setelah selesai):**

> "Zero TypeScript error, build sukses, PWA service worker ke-generate."

### 2c. E2E Production Tests

**NGOMONG:**

> "Sekarang E2E test langsung ke production Vercel — 20 automated check."

**KETIK:**

```bash
npx playwright test e2e/prod-check.spec.ts
```

**NGOMONG (setelah selesai):**

> "20/20 passed. Ini ngecek: homepage load, security headers, auth enforcement
> di semua API endpoint, PWA manifest, service worker, code splitting, semuanya."

---

## SCENE 3: Security Demo — API Protection (~2 menit)

**[TAB: Chrome Tab 3 — kosong]**

**NGOMONG:**

> "Sekarang kita buktiin security fix secara live. Sebelum MR ini, beberapa API endpoint
> bisa diakses siapapun tanpa login."

### 3a. Health endpoint — no env leak

**KETIK di address bar:**

```
https://guided-growth-mvp-six.vercel.app/api/health
```

**NGOMONG:**

> "Health endpoint return status OK, database connected. Tapi perhatiin:
> TIDAK ada nama environment variable yang bocor. Sebelumnya, endpoint ini
> nge-leak nama env var kita."

### 3b. Data endpoint — requires auth

**KETIK:**

```
https://guided-growth-mvp-six.vercel.app/api/entries?start=2026-01-01&end=2026-01-31
```

**NGOMONG:**

> "Entries API tanpa login — 401 Not Authenticated. Aman."

### 3c. Process command — requires auth + POST only

**KETIK:**

```
https://guided-growth-mvp-six.vercel.app/api/process-command
```

**NGOMONG:**

> "Process command — 405 Method Not Allowed karena GET. Dan kalau POST tanpa auth,
> tetep 401. Sebelumnya endpoint ini open — siapapun bisa abuse OpenAI API kita."

### 3d. Admin endpoint — protected

**KETIK:**

```
https://guided-growth-mvp-six.vercel.app/api/admin/users
```

**NGOMONG:**

> "Admin endpoint — 401. Semua API sekarang ter-protect."

### 3e. Anonymized export — requires admin key

**KETIK:**

```
https://guided-growth-mvp-six.vercel.app/api/anonymized-export?type=all
```

**NGOMONG:**

> "Anonymized export tanpa admin key — 403 Forbidden.
> Error message-nya juga ga bocor internal detail. No stack trace."

---

## SCENE 4: Anonymization Demo (~2 menit)

**[TAB: Terminal]**

**NGOMONG:**

> "Sekarang kita demo fitur anonymization. Ini buat admin bisa export data user
> untuk analytics, tapi TANPA bisa tau siapa orangnya."

### 4a. Export users (anonymized)

**KETIK:**

```bash
curl -s -H "x-admin-key: gg_admin_2026_s3cur3_k3y_xYz" \
  "https://guided-growth-mvp-six.vercel.app/api/anonymized-export?type=users&limit=3" \
  | node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(0,'utf8')),null,2))"
```

**NGOMONG (tunjuk output):**

> "Lihat — email jadi `user_2935b44f@anon`, nickname jadi `anon_fb46c79b`.
> Ini SHA-256 hash, one-way, ga bisa di-reverse balik ke email asli.
> Tapi data analytics tetep ada: age group, gender, language, created_at."

### 4b. Export habits (anonymized)

**KETIK:**

```bash
curl -s -H "x-admin-key: gg_admin_2026_s3cur3_k3y_xYz" \
  "https://guided-growth-mvp-six.vercel.app/api/anonymized-export?type=habits&limit=5" \
  | node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(0,'utf8')),null,2))"
```

**NGOMONG:**

> "Habits — nama habit di-hash jadi `habit_xxxx`, user_id diganti `anon_user_id`.
> Admin bisa lihat habit type, cadence, active status buat analytics —
> tapi ga bisa tau ini habit siapa atau namanya apa."

### 4c. Export journal (anonymized)

**KETIK:**

```bash
curl -s -H "x-admin-key: gg_admin_2026_s3cur3_k3y_xYz" \
  "https://guided-growth-mvp-six.vercel.app/api/anonymized-export?type=journal&limit=3" \
  | node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(0,'utf8')),null,2))"
```

**NGOMONG:**

> "Journal entries — isi jurnal di-hash, tapi date, input_mode, time_of_day tetep ada.
> Jadi kita bisa analisis kapan user paling aktif journaling, tanpa baca isi jurnalnya."

### 4d. Rangkuman

**NGOMONG:**

> "Total ada 7 anonymized database view: users, habits, journal, checkins,
> completions, onboarding, dan metrics. Semua personal data di-hash SHA-256.
> Ini comply sama privacy requirement dari issue #43."

---

## SCENE 5: Voice Demo — Web Speech API (~1.5 menit)

**[TAB: Chrome Tab 2 — App]**

**NGOMONG:**

> "Sekarang voice features. Kita punya 4 STT provider. Mulai dari Web Speech API —
> yang built-in di browser, gratis, dan real-time."

### 5a. Cek settings dulu

**YANG DILAKUIN:**

1. Klik **Settings** di sidebar (icon gear)
2. Tunjukin **Speech-to-Text Engine** section — pastikan **Web Speech API** terpilih
3. Tunjukin **Recording Mode** — "Auto-stop (Siri-like): stops after 2.5s silence"
4. Tunjukin **Talk Back Voice** toggle — enable kalau mau app ngomong balik

**NGOMONG:**

> "Di settings ada pilihan STT engine, recording mode, dan talk back voice.
> Kita mulai dengan Web Speech API dulu."

### 5b. Navigate ke Capture page

1. Klik **Capture** di sidebar
2. Tunjukin halaman — habits list, date navigation

### 5c. Voice Command — Create habit

1. Klik **mic button** (biru/ungu, pojok kanan bawah)
2. **NGOMONG KE MIC:** "Add a habit called morning meditation"
3. Tunggu transcript muncul, auto-process
4. Tunjukin toast notification: habit created
5. Tunjukin transcript auto-clear setelah ~3 detik

**NGOMONG (ke kamera):**

> "Klik mic, ngomong command, auto-stop setelah 2.5 detik silence,
> terus command di-process sama GPT. Transcript auto-clear — itu fix dari issue #42."

### 5d. Voice Command — Complete habit with date

1. Klik mic lagi
2. **NGOMONG KE MIC:** "Mark morning meditation done for March 8th 2026"
3. Tunggu process
4. Tunjukin habit marked done pada tanggal yang BENAR

**NGOMONG (ke kamera):**

> "Perhatiin tanggalnya — March 8th, bukan hari ini. Sebelumnya date parsing
> broken, selalu default ke hari ini. Sekarang udah fix."

### 5e. Voice Command — Log metric

1. Klik mic
2. **NGOMONG KE MIC:** "Log my mood at 8"
3. Tunjukin metric logged

### 5f. Voice Command — Journal

1. Klik mic
2. **NGOMONG KE MIC:** "I slept well and feel productive today"
3. Tunjukin journal entry created

---

## SCENE 6: Voice Demo — Switch ke DeepGram (~1.5 menit)

**[TAB: Chrome Tab 2 — App]**

**NGOMONG:**

> "Sekarang switch ke DeepGram Nova-2 — cloud-based, real-time streaming via WebSocket."

### 6a. Switch provider

1. Klik **Settings**
2. Pilih **DeepGram Nova-2**
3. Balik ke **Capture**

### 6b. Voice Command dengan DeepGram

1. Klik mic
2. **NGOMONG KE MIC:** "Add a habit called reading 30 minutes"
3. Tunjukin **interim text** muncul real-time (DeepGram streaming)
4. Tunggu final transcript dan command processed

**NGOMONG (ke kamera):**

> "DeepGram itu streaming — lihat text muncul real-time while I'm still speaking.
> Ini lebih responsive dibanding Web Speech yang nunggu selesai dulu."

### 6c. Satu command lagi

1. Klik mic
2. **NGOMONG KE MIC:** "How am I doing with meditation?"
3. Tunjukin query result

---

## SCENE 7: Voice Demo — Switch ke ElevenLabs (~1 menit)

**NGOMONG:**

> "Provider ketiga — ElevenLabs Scribe v2. Ini batch upload, bukan streaming."

### 7a. Switch provider

1. Settings > pilih **ElevenLabs Scribe v2**
2. Balik ke Capture

### 7b. Voice Command dengan ElevenLabs

1. Klik mic — tunjukin "Listening with ElevenLabs..." message
2. **NGOMONG KE MIC:** "Mark reading done for today"
3. Klik mic lagi untuk STOP (ElevenLabs ga auto-stop berdasarkan silence — dia batch)
4. Tunggu "Processing..." — audio diupload ke ElevenLabs API
5. Tunjukin result

**NGOMONG (ke kamera):**

> "ElevenLabs itu batch — record dulu, terus upload WAV file ke API.
> Beda sama DeepGram yang streaming. Tapi akurasinya tinggi, dan support multilingual."

---

## SCENE 8: Voice Demo — Whisper WASM (~1 menit)

**NGOMONG:**

> "Provider terakhir — Whisper. Ini jalan LOKAL di browser, pake WASM. No server call."

### 8a. Switch provider

1. Settings > pilih **Whisper (whisper.cpp)**
2. Balik ke Capture

### 8b. Voice Command dengan Whisper

1. Klik mic — tunjukin "Listening with Whisper..."
2. **NGOMONG KE MIC:** "Show my habits"
3. Klik mic untuk STOP
4. Tunggu processing (Whisper process locally, mungkin 1-2 detik)
5. Tunjukin result

**NGOMONG (ke kamera):**

> "Whisper jalan 100% di browser — ga ada data audio yang dikirim ke server.
> Model-nya ~40MB, download pertama kali aja, setelah itu cached.
> Cocok buat privacy-conscious users."

### 8c. (OPTIONAL) Switch balik ke Web Speech

1. Settings > pilih Web Speech API balik
2. Tunjukin seamless switch

---

## SCENE 9: UI/UX Fixes Demo (~1 menit)

**[TAB: Chrome Tab 2 — App, di Capture page]**

**NGOMONG:**

> "Terakhir, beberapa cross-platform fixes."

### 9a. Keyboard shortcuts

**YANG DILAKUIN:**

1. Tekan `Ctrl+Alt+Right Arrow` — navigate ke next period
2. Tekan `Ctrl+Alt+Left Arrow` — navigate ke prev period
3. Tekan `Alt+T` — jump to today

**NGOMONG:**

> "Keyboard shortcuts sekarang pake Ctrl+Alt+Arrow, bukan Alt+Arrow yang
> konflik sama browser back/forward."

### 9b. Toast position

1. Trigger toast (bisa dari voice command atau action)
2. Tunjukin toast muncul di ATAS

**NGOMONG:**

> "Toast sekarang di atas, ga overlap sama voice UI di bawah."

### 9c. Undo/Redo (kalau ada data)

1. Edit suatu entry di spreadsheet
2. Klik undo button — tunjukin revert
3. Klik redo button — tunjukin re-apply

---

## SCENE 10: Code Walkthrough (OPTIONAL, ~1.5 menit)

**[VS Code]**

**NGOMONG:**

> "Quick code walkthrough."

### 10a. Anonymization utility

- Buka `src/lib/utils/anonymize.ts`
- Tunjukin SHA-256 hashing, 16 char truncation

### 10b. Security — auth.ts

- Buka `api/_lib/auth.ts`
- Tunjukin hardcoded 'dev-secret' udah dihapus

### 10c. Database views

- Buka `supabase/migrations/001_full_schema.sql`
- Scroll ke anonymized views (line ~640)
- Tunjukin `anon_user_id` = hashed user_id

### 10d. Deepgram token fix

- Buka `api/deepgram-token.ts`
- Tunjukin 2-step: fetch project ID, lalu create scoped key

---

## SCENE 11: Closing — GitLab (~30 detik)

**[TAB: GitLab MR]**

**YANG DILAKUIN:**

1. Tunjukin pipeline: **SUCCESS** (hijau)
2. Tunjukin: **Can be merged**, **No conflicts**
3. Tunjukin: Closes #41, #42, #43, #24, #27, #45

**NGOMONG:**

> "Pipeline hijau, no conflicts, 6 issues auto-close on merge.
> 59 unit tests, 20 E2E checks, 4 critical security fixes,
> 4 STT providers, data anonymization — all working.
> Sprint 1 complete. Ready for review."

---

## Quick Reference — Command Cheat Sheet

Voice commands yang di-demo-in (buat diinget):

| Scene | Command                                           | Action                |
| ----- | ------------------------------------------------- | --------------------- |
| 5c    | "Add a habit called morning meditation"           | Create habit          |
| 5d    | "Mark morning meditation done for March 8th 2026" | Complete with date    |
| 5e    | "Log my mood at 8"                                | Log metric            |
| 5f    | "I slept well and feel productive today"          | Journal reflection    |
| 6b    | "Add a habit called reading 30 minutes"           | Create (DeepGram)     |
| 6c    | "How am I doing with meditation?"                 | Query stats           |
| 7b    | "Mark reading done for today"                     | Complete (ElevenLabs) |
| 8b    | "Show my habits"                                  | List habits (Whisper) |

## Tab Switching Order

| Scene | What's on screen               |
| ----- | ------------------------------ |
| 1     | GitLab MR                      |
| 2     | Terminal (tests + build + E2E) |
| 3     | Browser address bar (API URLs) |
| 4     | Terminal (curl anonymization)  |
| 5-8   | Browser App (voice demos)      |
| 9     | Browser App (UX fixes)         |
| 10    | VS Code (code walkthrough)     |
| 11    | GitLab MR (closing)            |

## Tips

- **Mouse**: gerak pelan, deliberate. Jangan cepet.
- **Pause 2-3 detik** antar scene buat cutting room.
- **Kalau voice command gagal**: bilang "let me try again" — natural, ga masalah.
- **Font size**: terminal 16-18pt, browser zoom 110-125%.
- **Narasi**: ngomong santai, ga perlu formal. Kayak ngejelasin ke temen.
