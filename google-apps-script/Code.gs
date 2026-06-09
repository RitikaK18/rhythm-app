/**
 * Rhythm — Google Sheets backend (Google Apps Script Web App)
 *
 * This script lets the Rhythm app read and write rows in your Google Sheet.
 * Setup steps are in SETUP.md. In short:
 *   1. Open your Sheet > Extensions > Apps Script.
 *   2. Delete any existing code, paste ALL of this file, click Save.
 *   3. Deploy > New deployment > type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      Authorize when prompted, then copy the Web app URL (ends with /exec).
 *   4. Paste that URL into the app's settings (gear icon).
 *
 * The script creates a tab called "Log" with the right headers automatically.
 */

var SHEET_NAME = 'Log';

// OPTIONAL: set a secret string here (e.g. 'my-secret-123') and enter the SAME
// value in the app's settings. Leave as '' for no token check.
var TOKEN = '';

var HEADERS = [
  'Date', 'Flow', 'Energy', 'Mood', 'Sleep', 'Worked out', 'Mode', 'Class',
  'Self types', 'Duration', 'New high', 'Treat', 'Cravings', 'Caffeine',
  'Caffeine servings', 'Alcohol', 'Drinks', 'Symptoms', 'Cycle day', 'Phase', 'Notes'
];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange('A:A').setNumberFormat('@'); // keep dates as plain text (YYYY-MM-DD)
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function tokenOk_(t) {
  return TOKEN === '' || String(t) === TOKEN;
}

function doGet(e) {
  var token = (e && e.parameter && e.parameter.token) || '';
  if (!tokenOk_(token)) return json_({ ok: false, error: 'bad token' });

  var sh = getSheet_();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return json_({ rows: [] });

  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) row[headers[j]] = values[i][j];
    if (String(row['Date'] || '').length) rows.push(row);
  }
  return json_({ rows: rows });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    if (!tokenOk_(body.token)) return json_({ ok: false, error: 'bad token' });

    var row = body.row || {};
    var sh = getSheet_();
    var data = sh.getDataRange().getValues();
    var headers = data[0];
    var dateCol = headers.indexOf('Date');

    var target = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][dateCol]) === String(row['Date'])) { target = i + 1; break; }
    }

    var out = headers.map(function (h) { return row[h] !== undefined ? row[h] : ''; });
    if (target === -1) sh.appendRow(out);
    else sh.getRange(target, 1, 1, headers.length).setValues([out]);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
