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
 * Gmail starred → Groq AI → write rows.
 * Does NOT call the InboxFlow server.
 *
 * Quota-frugal: only NEW starred messages are read + extracted. Rows already
 * in the sheet are never re-read from Gmail or re-sent to Groq, and idle runs
 * (no new starred mail) cost ~1 Gmail search call.
 */
export type AppsScriptConfig = {
  sheetTitle: string;
  /** Time-driven trigger interval (minutes). */
  triggerMinutes?: number;
  /** Columns the AI must fill (from the Studio table). */
  columns: AppsScriptColumn[];
  /** Groq API key embedded at install time (UrlFetch from Apps Script). */
  groqApiKey: string;
  groqModel?: string;
  /** How many starred threads to scan each run. */
  maxThreads?: number;
  /** Max NEW messages extracted per run (rest picked up next run). */
  maxNewPerRun?: number;
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
    webapp: {
      access: "MYSELF",
      executeAs: "USER_ACCESSING",
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
 * Runs every N minutes in Google's cloud — Gmail starred → Groq → sheet.
 */
export function buildGoogleAppsScript(config: AppsScriptConfig): string {
  const sheetTitle = escapeJsSingleQuoted(config.sheetTitle);
  const triggerMinutes = Math.max(1, Math.min(60, config.triggerMinutes ?? 1));
  const maxThreads = Math.max(5, Math.min(50, config.maxThreads ?? 30));
  const maxNewPerRun = Math.max(1, Math.min(30, config.maxNewPerRun ?? 10));
  const groqKey = escapeJsSingleQuoted((config.groqApiKey || "").trim());
  const groqModel = escapeJsSingleQuoted(
    (config.groqModel || "llama-3.1-8b-instant").trim()
  );

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
 *   1) Searches YOUR starred Gmail (newest ${maxThreads} threads)
 *   2) AI-extracts ONLY messages not already in the sheet (max ${maxNewPerRun}/run)
 *   3) Appends rows to this spreadsheet
 *
 * Quota-safe: idle runs cost ~1 Gmail call; existing rows are never re-read
 * from Gmail or re-sent to the AI.
 */
var INBOXFLOW_CONFIG = {
  SHEET_TITLE: '${sheetTitle}',
  GROQ_API_KEY: '${groqKey}',
  GROQ_MODEL: '${groqModel}',
  MAX_THREADS: ${maxThreads},
  MAX_NEW_PER_RUN: ${maxNewPerRun},
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
    return String(body).slice(0, 6000);
  } catch (e) {
    return '';
  }
}

function groqRequest_(prompt) {
  var url = 'https://api.groq.com/openai/v1/chat/completions';
  return UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + INBOXFLOW_CONFIG.GROQ_API_KEY,
    },
    payload: JSON.stringify({
      model: INBOXFLOW_CONFIG.GROQ_MODEL,
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You extract structured JSON from emails. Reply with JSON only.',
        },
        { role: 'user', content: prompt },
      ],
    }),
    muteHttpExceptions: true,
  });
}

function extractWithGroq_(fromAddr, subject, bodyText) {
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

  var res = groqRequest_(prompt);
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code === 429) {
    // Brief backoff then one retry for Groq TPM limits
    Utilities.sleep(2000);
    res = groqRequest_(prompt);
    code = res.getResponseCode();
    text = res.getContentText();
  }
  if (code !== 200) {
    throw new Error('Groq API ' + code + ': ' + text.slice(0, 220));
  }
  var json = JSON.parse(text);
  var part =
    json.choices &&
    json.choices[0] &&
    json.choices[0].message &&
    json.choices[0].message.content
      ? json.choices[0].message.content
      : '';
  if (!part) throw new Error('Groq returned empty content');
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

/**
 * One search page only — newest MAX_THREADS starred threads.
 * A cheap fingerprint (thread ids + last-message dates) lets idle runs
 * return before any per-message Gmail reads.
 */
function starredThreadsWithFingerprint_() {
  var threads = GmailApp.search('is:starred', 0, INBOXFLOW_CONFIG.MAX_THREADS);
  var parts = [];
  for (var i = 0; i < threads.length; i++) {
    var stamp = '';
    try {
      stamp = String(threads[i].getLastMessageDate().getTime());
    } catch (e) {}
    parts.push(threads[i].getId() + ':' + stamp);
  }
  return { threads: threads, fingerprint: parts.join('|') };
}

function isGmailQuotaError_(e) {
  var msg = String(e && e.message ? e.message : e).toLowerCase();
  return msg.indexOf('invoked too many times') !== -1;
}

function runStandaloneSync_() {
  if (!INBOXFLOW_CONFIG.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY missing in script config. Re-enable auto-sync from InboxFlow website.');
  }
  var sheet = getDataSheet_();
  ensureHeaders_(sheet);

  var props = PropertiesService.getDocumentProperties();
  var scan = starredThreadsWithFingerprint_();

  // Nothing changed in starred mail since last successful run → done.
  if (
    scan.fingerprint &&
    scan.fingerprint === props.getProperty('INBOXFLOW_STARRED_FP')
  ) {
    return { written: 0, scanned: 0, skipped: 'unchanged' };
  }

  var idMap = existingIdMap_(sheet);
  var written = 0;
  var examined = 0;
  var pending = false;

  for (var t = 0; t < scan.threads.length; t++) {
    var threadMsgs = scan.threads[t].getMessages();
    for (var m = 0; m < threadMsgs.length; m++) {
      var message = threadMsgs[m];
      var id = message.getId();
      if (idMap[id]) continue; // already extracted — never re-read / re-extract
      try {
        if (!message.isStarred()) continue;
      } catch (eStar) {}
      if (written >= INBOXFLOW_CONFIG.MAX_NEW_PER_RUN) {
        pending = true; // picked up by the next 1-min run
        break;
      }
      examined++;
      var fromAddr = '';
      try {
        fromAddr = message.getFrom() || '';
      } catch (e) {}
      var subject = '';
      try {
        subject = message.getSubject() || '';
      } catch (e2) {}
      var bodyText = plainBody_(message);
      var extracted = extractWithGroq_(fromAddr, subject, bodyText);
      var row = rowFromMessage_(message, extracted);
      sheet.appendRow(row);
      idMap[id] = sheet.getLastRow();
      written++;
      // Pace requests for Groq free-tier TPM
      Utilities.sleep(600);
    }
    if (pending) break;
  }

  // Only remember the fingerprint when everything new was written,
  // so leftovers are retried on the next run.
  if (!pending) {
    props.setProperty('INBOXFLOW_STARRED_FP', scan.fingerprint);
  }

  SpreadsheetApp.flush();
  return { written: written, scanned: examined, pending: pending };
}

function markTriggerMeta_(count) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    var sh = ss.getSheetByName('_InboxFlow');
    if (!sh) sh = ss.insertSheet('_InboxFlow');
    sh.getRange(1, 1, 2, 2).setValues([
      ['triggerCount', String(count)],
      ['updatedAt', new Date().toISOString()],
    ]);
    try {
      sh.hideSheet();
    } catch (hideErr) {}
  } catch (metaErr) {}
}

/** Delete EVERY trigger in this project, then create exactly one timer. */
function installInboxFlowTimeTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('syncInboxFlowData')
    .timeBased()
    .everyMinutes(${triggerMinutes})
    .create();
  markTriggerMeta_(inboxFlowTriggerCount_());
}

function primeInboxFlowAuthorization() {
  GmailApp.search('is:starred', 0, 1);
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
  return inboxFlowTriggerCount_();
}

/**
 * Web app entry — opened from InboxFlow website popup.
 * User authorizes once in Google; timer is installed in their account (no sheet menu).
 */
function doGet(e) {
  try {
    installInboxFlowTimeTrigger_();
    var count = inboxFlowTriggerCount_();
    try {
      recordSyncSuccess_(runStandaloneSync_());
    } catch (syncErr) {
      /* first sync may need Gmail auth; timer is still on */
      PropertiesService.getDocumentProperties().setProperty(
        'INBOXFLOW_LAST_ERROR',
        String(syncErr && syncErr.message ? syncErr.message : syncErr)
      );
    }
    var html =
      '<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:24px;">' +
      '<h2>InboxFlow auto-sync is on</h2>' +
      '<p>Timer: every ${triggerMinutes} min · ' +
      count +
      ' trigger(s).</p>' +
      '<p>You can close this window and return to InboxFlow.</p>' +
      '<script>try{if(window.opener){window.opener.postMessage({type:"inboxflow-apps-script-auth",ok:true,triggerCount:' +
      count +
      '},"*");}}catch(e){}</script>' +
      '</body></html>';
    return HtmlService.createHtmlOutput(html).setTitle('InboxFlow Auto-sync');
  } catch (err) {
    var msg = err && err.message ? err.message : String(err);
    var fail =
      '<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:24px;">' +
      '<h2>Could not enable auto-sync</h2><p>' +
      msg.replace(/</g, '&lt;') +
      '</p><p>Close this window and try again from InboxFlow.</p>' +
      '<script>try{if(window.opener){window.opener.postMessage({type:"inboxflow-apps-script-auth",ok:false,message:' +
      JSON.stringify(msg) +
      '},"*");}}catch(e){}</script>' +
      '</body></html>';
    return HtmlService.createHtmlOutput(fail).setTitle('InboxFlow Auto-sync');
  }
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
      'Mode: starred Gmail → Groq AI → this sheet.\\n' +
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
    (triggers > 0 ? triggers + ' active (every ${triggerMinutes} min)' : 'NONE — enable from InboxFlow website') +
    '\\nMode: Gmail starred → Groq → sheet' +
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

function syncInboxFlowData() {
  try {
    var stats = runStandaloneSync_();
    recordSyncSuccess_(stats);
    Logger.log('Standalone sync: ' + JSON.stringify(stats));
  } catch (e) {
    // Record and stay silent — Google emails failure digests for throwing triggers.
    PropertiesService.getDocumentProperties().setProperty(
      'INBOXFLOW_LAST_ERROR',
      String(e && e.message ? e.message : e)
    );
    if (isGmailQuotaError_(e)) {
      Logger.log('Gmail daily quota hit — waiting for reset.');
    }
  }
}

/** Menu disabled — enable + sync only from the InboxFlow website. */
function onOpen() {
  /* intentionally empty */
}
`;
}
