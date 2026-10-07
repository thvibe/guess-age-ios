/**
 * Study Tracker — Google Apps Script Web App for the Trivia League app.
 *
 * It records play sessions and test scores from the app into a Google Sheet
 * ("events" tab) and serves back an aggregated per-subject summary the app
 * reads to show a cross-device Study Tracker.
 *
 * Setup + deploy steps: tools/study-sheet.md. Deploy as a Web app
 * (Execute as: Me, Who has access: Anyone), then paste the /exec URL into the
 * app's Study Tracker ("Connect Google Sheet").
 *
 * Note: the Web app URL is the only key, so keep it private. Anyone who has it
 * can append study rows. Fine for a personal/family tracker.
 */

function doPost(e) {
  try {
    var b = JSON.parse(e.postData.contents);
    sheet_().appendRow([
      new Date(),
      b.type || '',
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

function doGet() {
  var rows = sheet_().getDataRange().getValues();
  var by = {};
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var type = r[1], id = r[2], subject = r[3], score = r[4], accuracy = r[5], questions = r[6], level = r[7];
    if (!id) continue;
    var s = by[id] || (by[id] = { id: id, subject: subject, plays: 0, questions: 0, accuracy: null, level: '', tests: [] });
    if (subject) s.subject = subject;
    if (type === 'play') {
      s.plays++;
      if (accuracy !== '' && accuracy != null) s.accuracy = Number(accuracy);
      if (questions !== '' && questions != null) s.questions = Number(questions);
      if (level) s.level = level;
    } else if (type === 'test') {
      s.tests.push({ at: r[0], score: Number(score) });
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
    sh.appendRow(['timestamp', 'type', 'id', 'subject', 'score', 'accuracy', 'questions', 'level', 'device']);
  }
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
