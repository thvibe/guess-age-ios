/**
 * Study Tracker — Google Apps Script Web App for the Trivia League app.
 *
 * Records play sessions and test scores from the app into a Google Sheet
 * ("events" tab) and serves back an aggregated per-player, per-subject summary
 * the app reads to show a cross-device Study Tracker.
 *
 * Every row is tagged with a PLAYER. doGet only aggregates the player passed in
 * ?player=<name>, so one person's data never counts toward another's.
 *
 * Each subject keeps ONE test (the latest); older test rows stay in the sheet
 * as raw history but the app shows the most recent.
 *
 * Setup + deploy steps: tools/study-sheet.md. Deploy as a Web app
 * (Execute as: Me, Who has access: Anyone), then paste the /exec URL into the
 * app's Study Tracker ("Connect Google Sheet").
 *
 * The Web app URL is the only key — keep it private.
 */

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
    if (want && String(player) !== want) continue;   // only this player's rows
    var s = by[id] || (by[id] = { id: id, subject: subject, plays: 0, questions: 0, accuracy: null, level: '', test: null });
    if (subject) s.subject = subject;
    if (type === 'play') {
      s.plays++;
      if (accuracy !== '' && accuracy != null) s.accuracy = Number(accuracy);
      if (questions !== '' && questions != null) s.questions = Number(questions);
      if (level) s.level = level;
    } else if (type === 'test') {
      s.test = { at: r[0], score: Number(score) };   // rows are chronological, so the last wins
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
