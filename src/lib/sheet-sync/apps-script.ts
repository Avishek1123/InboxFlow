import {
  INBOXFLOW_GCP_PROJECT_ID,
  INBOXFLOW_GCP_PROJECT_NUMBER,
} from "@/lib/gmail/inboxflow-gcp";

export type AppsScriptColumn = {
  key: string;
  label: string;
  hint?: string;
};

/**
 * Config for a self-contained sheet script:
 * Gmail starred → Gemini AI → write rows.
 * Does NOT call the InboxFlow server.
 */
export type AppsScriptConfig = {
  sheetTitle: string;
  /** Time-driven trigger interval (minutes). */
  triggerMinutes?: number;
  /** Columns the AI must fill (from the Studio table). */
  columns: AppsScriptColumn[];
  /** Gemini API key embedded at install time (UrlFetch from Apps Script). */
  geminiApiKey: string;
  geminiModel?: string;
  /** How many starred threads to scan each run. */
  maxThreads?: number;
  /**
   * @deprecated Legacy InboxFlow pull mode — ignored by standalone script.
   */
  apiBaseUrl?: string;
  apiKey?: string;
  tableId?: string;
  gmailFilter?: string;
};

/** Required by projects.updateContent — file name must be "appsscript", type JSON. */
export function buildAppsScriptManifest(timeZone = "Etc/UTC"): string {
  return JSON.stringify({
    timeZone,
    exceptionLogging: "STACKDRIVER",
    runtimeVersion: "V8",
    executionApi: {
      access: "MYSELF",
    },
    oauthScopes: [
      "https://www.googleapis.com/auth/spreadsheets.currentonly",
      "https://www.googleapis.com/auth/script.external_request",
      "https://www.googleapis.com/auth/script.scriptapp",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
  });
}

function escapeJsSingleQuoted(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Container-bound Apps Script on the user's spreadsheet.
 * Runs every N minutes in Google's cloud — no InboxFlow server required.
 */
export function buildGoogleAppsScript(config: AppsScriptConfig): string {
  const sheetTitle = escapeJsSingleQuoted(config.sheetTitle);
  const triggerMinutes = Math.max(1, Math.min(60, config.triggerMinutes ?? 1));
  const maxThreads = Math.max(5, Math.min(50, config.maxThreads ?? 20));
  const geminiModel = escapeJsSingleQuoted(
    config.geminiModel?.trim() || "gemini-2.0-flash"
  );
  const geminiKey = escapeJsSingleQuoted(config.geminiApiKey.trim());

  const columnsJson = JSON.stringify(
    config.columns.map((c) => ({
      key: c.key,
      label: c.label,
      hint: c.hint ?? "",
    }))
  );

  return `/**
 * InboxFlow — standalone sheet sync
 * GCP project: ${INBOXFLOW_GCP_PROJECT_ID} / ${INBOXFLOW_GCP_PROJECT_NUMBER}
 *
 * Every ${triggerMinutes} min this script:
 *   1) Reads YOUR starred Gmail (GmailApp)
 *   2) Calls Gemini to structure fields into your columns
 *   3) Writes / updates rows in this spreadsheet
 *
 * InboxFlow's server is NOT called. Keep this script linked to GCP ${INBOXFLOW_GCP_PROJECT_NUMBER}
 * if Google asks (Apps Script → Project settings → Google Cloud Platform project).
 */
var INBOXFLOW_CONFIG = {
  SHEET_TITLE: '${sheetTitle}',
  GEMINI_API_KEY: '${geminiKey}',
  GEMINI_MODEL: '${geminiModel}',
  MAX_THREADS: ${maxThreads},
  COLUMNS: ${columnsJson},
  ID_HEADER: 'Message ID',
};

function getDataSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet not found');
  var name = INBOXFLOW_CONFIG.SHEET_TITLE;
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function headerRow_() {
  var cols = INBOXFLOW_CONFIG.COLUMNS;
  var headers = [INBOXFLOW_CONFIG.ID_HEADER];
  for (var i = 0; i < cols.length; i++) headers.push(cols[i].label);
  headers.push('From', 'Subject', 'Received');
  return headers;
}

function ensureHeaders_(sheet) {
  var headers = headerRow_();
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var needWrite = sheet.getLastRow() === 0;
  if (!needWrite) {
    for (var i = 0; i < headers.length; i++) {
      if (String(existing[i] || '') !== headers[i]) {
        needWrite = true;
        break;
      }
    }
  }
  if (needWrite) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return headers;
}

function existingIdMap_(sheet) {
  var map = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    var id = String(ids[i][0] || '');
    if (id) map[id] = i + 2;
  }
  return map;
}

function plainBody_(message) {
  try {
    var body = message.getPlainBody() || '';
    if (!body) body = message.getBody().replace(/<[^>]+>/g, ' ');
    return String(body).slice(0, 8000);
  } catch (e) {
    return '';
  }
}

function extractWithGemini_(fromAddr, subject, bodyText) {
  var cols = INBOXFLOW_CONFIG.COLUMNS;
  var fieldLines = [];
  for (var i = 0; i < cols.length; i++) {
    var c = cols[i];
    var hint = c.hint ? ' (' + c.hint + ')' : '';
    fieldLines.push('  "' + c.key + '": string or null — ' + c.label + hint);
  }
  var prompt =
    'Extract structured data from this email. Return ONLY a valid JSON object with exactly these keys. Use null when missing. Do not invent data.\\n\\n' +
    '{\\n' +
    fieldLines.join(',\\n') +
    '\\n}\\n\\n' +
    'Email:\\nFrom: ' +
    fromAddr +
    '\\nSubject: ' +
    subject +
    '\\n\\n' +
    bodyText;

  var url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(INBOXFLOW_CONFIG.GEMINI_MODEL) +
    ':generateContent?key=' +
    encodeURIComponent(INBOXFLOW_CONFIG.GEMINI_API_KEY);

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    }),
    muteHttpExceptions: true,
  });

  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code !== 200) {
    throw new Error('Gemini API ' + code + ': ' + text.slice(0, 200));
  }
  var json = JSON.parse(text);
  var part =
    json.candidates &&
    json.candidates[0] &&
    json.candidates[0].content &&
    json.candidates[0].content.parts &&
    json.candidates[0].content.parts[0]
      ? json.candidates[0].content.parts[0].text
      : '';
  if (!part) throw new Error('Gemini returned empty content');
  var cleaned = String(part).trim();
  if (cleaned.indexOf('{') !== -1) {
    cleaned = cleaned.substring(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1);
  }
  return JSON.parse(cleaned);
}

function rowFromMessage_(message, extracted) {
  var cols = INBOXFLOW_CONFIG.COLUMNS;
  var row = [message.getId()];
  for (var i = 0; i < cols.length; i++) {
    var key = cols[i].key;
    var v = extracted[key];
    row.push(v === null || v === undefined ? '' : String(v));
  }
  var from = '';
  try {
    from = message.getFrom() || '';
  } catch (e1) {}
  var subject = '';
  try {
    subject = message.getSubject() || '';
  } catch (e2) {}
  var when = '';
  try {
    when = message.getDate() ? message.getDate().toISOString() : '';
  } catch (e3) {}
  row.push(from, subject, when);
  return row;
}

function collectStarredMessages_() {
  var threads = GmailApp.search('is:starred', 0, INBOXFLOW_CONFIG.MAX_THREADS);
  var messages = [];
  for (var t = 0; t < threads.length; t++) {
    var threadMsgs = threads[t].getMessages();
    for (var m = 0; m < threadMsgs.length; m++) {
      messages.push(threadMsgs[m]);
    }
  }
  return messages;
}

function runStandaloneSync_() {
  if (!INBOXFLOW_CONFIG.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY missing in script config. Re-install from InboxFlow.');
  }
  var sheet = getDataSheet_();
  ensureHeaders_(sheet);
  var idMap = existingIdMap_(sheet);
  var messages = collectStarredMessages_();
  var written = 0;
  var updated = 0;

  for (var i = 0; i < messages.length; i++) {
    var message = messages[i];
    var id = message.getId();
    var fromAddr = '';
    try {
      fromAddr = message.getFrom() || '';
    } catch (e) {}
    var subject = '';
    try {
      subject = message.getSubject() || '';
    } catch (e2) {}
    var bodyText = plainBody_(message);
    var extracted = extractWithGemini_(fromAddr, subject, bodyText);
    var row = rowFromMessage_(message, extracted);
    if (idMap[id]) {
      sheet.getRange(idMap[id], 1, 1, row.length).setValues([row]);
      updated++;
    } else {
      sheet.appendRow(row);
      idMap[id] = sheet.getLastRow();
      written++;
    }
    // Gentle pacing for Gemini free-tier limits
    if (i < messages.length - 1) Utilities.sleep(400);
  }

  SpreadsheetApp.flush();
  return { written: written, updated: updated, scanned: messages.length };
}

function installInboxFlowTimeTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncInboxFlowData') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('syncInboxFlowData')
    .timeBased()
    .everyMinutes(${triggerMinutes})
    .create();
}

function primeInboxFlowAuthorization() {
  GmailApp.getInboxThreads(0, 1);
  getDataSheet_();
  return true;
}

function recordSyncSuccess_(stats) {
  var props = PropertiesService.getDocumentProperties();
  props.setProperty('INBOXFLOW_READY', '1');
  props.setProperty('INBOXFLOW_LAST_SYNC', new Date().toISOString());
  props.setProperty(
    'INBOXFLOW_LAST_ROWS',
    String((stats && stats.written) || 0)
  );
  props.setProperty('INBOXFLOW_LAST_STATS', JSON.stringify(stats || {}));
  props.deleteProperty('INBOXFLOW_LAST_ERROR');
}

function setupInboxFlowAutomationFromApi() {
  installInboxFlowTimeTrigger_();
  try {
    var stats = runStandaloneSync_();
    recordSyncSuccess_(stats);
  } catch (e) {
    PropertiesService.getDocumentProperties().setProperty(
      'INBOXFLOW_LAST_ERROR',
      e.message
    );
  }
  return inboxFlowTriggerCount_();
}

function inboxFlowTriggerCount() {
  return inboxFlowTriggerCount_();
}

function inboxFlowTriggerCount_() {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncInboxFlowData') count++;
  }
  return count;
}

function setupInboxFlowAutomation() {
  try {
    var triggers = setupInboxFlowAutomationFromApi();
    var props = PropertiesService.getDocumentProperties();
    var err = props.getProperty('INBOXFLOW_LAST_ERROR');
    var statsRaw = props.getProperty('INBOXFLOW_LAST_STATS');
    var msg =
      'Auto-sync: ON (' +
      triggers +
      ' timer, every ${triggerMinutes} min).\\n' +
      'Mode: starred Gmail → Gemini AI → this sheet (no InboxFlow server).\\n' +
      'Tab: "' +
      INBOXFLOW_CONFIG.SHEET_TITLE +
      '".';
    if (statsRaw) msg += '\\nLast run: ' + statsRaw;
    if (err) msg += '\\n\\nSync error: ' + err;
    try {
      SpreadsheetApp.getUi().alert(msg);
    } catch (uiErr) {
      Logger.log(msg);
    }
  } catch (e) {
    try {
      SpreadsheetApp.getUi().alert('Could not enable auto-sync: ' + e.message);
    } catch (uiErr2) {
      throw e;
    }
  }
}

function showInboxFlowStatus() {
  var props = PropertiesService.getDocumentProperties();
  var triggers = inboxFlowTriggerCount_();
  var last = props.getProperty('INBOXFLOW_LAST_SYNC');
  var stats = props.getProperty('INBOXFLOW_LAST_STATS');
  var err = props.getProperty('INBOXFLOW_LAST_ERROR');
  var msg =
    'Timers: ' +
    (triggers > 0 ? triggers + ' active (every ${triggerMinutes} min)' : 'NONE — Enable auto-sync') +
    '\\nMode: Gmail starred → Gemini → sheet' +
    '\\nTab: ' +
    INBOXFLOW_CONFIG.SHEET_TITLE;
  if (last) msg += '\\nLast sync: ' + last;
  if (stats) msg += '\\nStats: ' + stats;
  if (err) msg += '\\nLast error: ' + err;
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (uiErr) {
    Logger.log(msg);
  }
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('InboxFlow')
      .addItem('Enable auto-sync', 'setupInboxFlowAutomation')
      .addItem('Sync now', 'syncInboxFlowData')
      .addItem('Sync status', 'showInboxFlowStatus')
      .addToUi();
  } catch (e) {
    Logger.log('InboxFlow menu: ' + e);
  }
}

function syncInboxFlowData() {
  try {
    var stats = runStandaloneSync_();
    recordSyncSuccess_(stats);
    Logger.log('Standalone sync: ' + JSON.stringify(stats));
    try {
      SpreadsheetApp.getUi().alert(
        'Synced starred mail → sheet.\\nNew: ' +
          stats.written +
          ' · Updated: ' +
          stats.updated +
          ' · Scanned: ' +
          stats.scanned
      );
    } catch (uiErr) {
      /* time trigger has no UI */
    }
  } catch (e) {
    PropertiesService.getDocumentProperties().setProperty(
      'INBOXFLOW_LAST_ERROR',
      e.message
    );
    throw e;
  }
}
`;
}
