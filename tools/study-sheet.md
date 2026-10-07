# Study Tracker — Google Sheet sync (setup)

The app's Study Tracker (School topics) can sync play sessions and test scores
to a Google Sheet, and read them back so you see the combined picture on any
device. This is a one-time setup.

## What syncs

- Every time a School topic is played, the app records a **play** (with the
  current in-game accuracy, questions answered, and level).
- Every test score you log records a **test** row (subject, score, date).
- The app reads an aggregated per-subject summary back from the sheet, so the
  tracker shows totals across all devices that are connected.

## One-time setup

1. **Create a Google Sheet** (or use the one already made for you). Name it
   anything, e.g. `Vinny Study Tracker`.
2. In that sheet: **Extensions → Apps Script**.
3. Delete the starter `function myFunction() {}` and paste the entire contents
   of [`study-sheet.gs`](./study-sheet.gs). Click the **Save** icon.
4. **Deploy → New deployment**. Click the gear → **Web app**. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
   Click **Deploy**, then **Authorize access** and allow it (it only touches
   this sheet).
5. Copy the **Web app URL** (it ends in `/exec`).
6. In the game: open the **School** tab → **See study progress** →
   **Connect Google Sheet**, and paste that URL.
   - Do this on **Vinny's device** so his plays sync, and on **your device**
     so you can view the combined data.

The sheet gets an `events` tab that fills in automatically. You can also open
that sheet any time to see or chart the raw rows yourself.

## Notes

- The Web app URL is the only key — keep it private. Anyone who has it can
  append study rows (harmless beyond spam). If you want a stronger guard, add a
  shared-secret `token` check to `doPost` and send it from the app.
- No data syncs until a device is connected; until then the tracker shows that
  device's local data. Disconnect any time from the same screen.
- If the app says "Sheet unreachable," re-check that the deployment's access is
  **Anyone** and that you pasted the `/exec` URL.
