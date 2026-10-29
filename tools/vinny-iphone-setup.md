# Vinny Study Tracker — iPhone setup checklist

Everything you need to get usage + test-score tracking working, written for an
iPhone. Two separate goals — **only one needs setup.**

- **Just track Vinny on his own iPhone** → nothing to set up (Path A).
- **See his data on your iPhone too (sync across devices)** → one-time Google
  setup (Path B). That one step is awkward on a phone and takes ~3 minutes on
  any computer.

Your sheet already exists in Drive: **"Vinny Study Tracker"**
→ https://docs.google.com/spreadsheets/d/1LZNRrH8l5Q0y-4SPgINc3Sdi8YF6LMgMkL28im86Oj8/edit

---

## Path A — Track on Vinny's iPhone (zero setup)

The tracker saves his plays and test scores right on his phone. No Google, no
sheet.

- [ ] On **Vinny's iPhone**, open the game in **Safari** (your
      `thvibe.github.io/trivia-league` link).
- [ ] Tap **Share** (box with ↑) → **Add to Home Screen**. Now it opens like an
      app.
- [ ] Open it, tap the **School** tab, let him play. Every School play is
      counted automatically.
- [ ] After a **real test**, open **School → "See study progress"**, type the
      score in the **Test %** box for that subject, tap **Add score**.

> ⚠️ Path-A-only caveat: iPhone Safari can wipe this if you clear history /
> website data, or if the game is opened in a different browser. If that
> worries you, do Path B — the sheet becomes a permanent backup.

---

## Path B — Sync to the Google Sheet (see it on any device)

Do Steps 1–3 **once**. If you can borrow a laptop/desktop for **Step 2**, do it
there — everything after is iPhone-native forever.

### Step 1 — Open the sheet
- [ ] https://docs.google.com/spreadsheets/d/1LZNRrH8l5Q0y-4SPgINc3Sdi8YF6LMgMkL28im86Oj8/edit

### Step 2 — Add the script and deploy it  (💻 computer strongly recommended)
- [ ] In the sheet: **Extensions → Apps Script**.
- [ ] Delete whatever's there, paste the code block below, tap **Save** (disk
      icon).
- [ ] Top right: **Deploy → New deployment**.
- [ ] Click the **gear icon** → choose **Web app**.
- [ ] Set **Execute as: Me** and **Who has access: Anyone**.
- [ ] **Deploy** → **Authorize access** → pick your Google account. If it warns
      "Google hasn't verified this app," tap **Advanced → Go to (project) →
      Allow**. (It's your own script; it only touches this one sheet.)
- [ ] Copy the **Web app URL** — it ends in **`/exec`**. That's the only thing
      you need on your phone.

> **iPhone-only fallback for Step 2** (no computer): open the sheet in Safari,
> tap **"Aa"** in the address bar → **Request Desktop Website**, then use the
> top menu **Extensions → Apps Script**. It works but it's cramped — expect
> pinch-zooming.

The code to paste (the canonical copy lives at `tools/study-sheet.gs`):

```javascript
function doPost(e) {
  try {
    var b = JSON.parse(e.postData.contents);
    sheet_().appendRow([
      new Date(),
      b.type || '',
      b.player || '',
      b.id || '',
      b.subject || '',
      (b.score == null ? '' : b.score),
      (b.accuracy == null ? '' : b.accuracy),
      (b.questions == null ? '' : b.questions),
      b.level || '',
      b.device || ''
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

function doGet(e) {
  var want = (e && e.parameter && e.parameter.player) ? String(e.parameter.player) : '';
  var rows = sheet_().getDataRange().getValues();
  var by = {};
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var type = r[1], player = r[2], id = r[3], subject = r[4], score = r[5], accuracy = r[6], questions = r[7], level = r[8];
    if (!id) continue;
    if (want && String(player) !== want) continue;
    var s = by[id] || (by[id] = { id: id, subject: subject, plays: 0, questions: 0, accuracy: null, level: '', test: null });
    if (subject) s.subject = subject;
    if (type === 'play') {
      s.plays++;
      if (accuracy !== '' && accuracy != null) s.accuracy = Number(accuracy);
      if (questions !== '' && questions != null) s.questions = Number(questions);
      if (level) s.level = level;
    } else if (type === 'test') {
      s.test = { at: r[0], score: Number(score) };
    }
  }
  var out = Object.keys(by).map(function (k) { return by[k]; });
  return json_({ subjects: out });
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('events');
  if (!sh) {
    sh = ss.insertSheet('events');
    sh.appendRow(['timestamp', 'type', 'player', 'id', 'subject', 'score', 'accuracy', 'questions', 'level', 'device']);
  }
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
```

### Step 3 — Connect the game  (📱 iPhone, easy)
Do this **on each iPhone** you want involved:
- [ ] Open the game → **School** tab → **"See study progress"**.
- [ ] Tap **Connect Google Sheet** → paste the **`/exec`** URL.
- [ ] When asked **"Whose data is this device for?"**, type **Vinny**.

- On **Vinny's iPhone**: his plays and scores now sync up to the sheet.
- On **your iPhone**: paste the **same** URL, name it **Vinny** too — now you
  see his combined numbers. Don't play *School* rounds on your own phone, or
  they get counted as his (Fun topics are fine).

---

## Day to day (all iPhone)

- Vinny plays School topics on his phone — counted automatically.
- After each real test, log the % under **See study progress → Add score**
  (it replaces the previous score for that subject — one test per category).
- You open the game → **School → See study progress** anytime to compare how
  much he plays vs. how his test scores move. **Refresh** pulls the latest;
  **Copy data** gives a spreadsheet-ready copy.

---

## Good to know

- **Whose data counts:** only the player named on a device (default `Vinny`).
  Change it from the sync row (tap the `Vinny ✎` chip). Keep the spelling the
  same on every device that should feed the same tracker.
- **One test per subject:** the tracker shows the latest score; logging a new
  one replaces it. Every score still lands as its own row in the sheet, so the
  full history is there if you ever want to chart it.
- **"Sheet unreachable":** re-check that the deployment's access is **Anyone**
  and that you pasted the **`/exec`** URL. Until a device is connected, the
  tracker just shows that device's local data.
- **If you ever change the script** (`tools/study-sheet.gs`): in Apps Script do
  **Deploy → Manage deployments → edit → New version → Deploy**. The `/exec`
  URL stays the same, so nothing to re-paste in the app.
