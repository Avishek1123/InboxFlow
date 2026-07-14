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
  /**
   * @deprecated Legacy InboxFlow pull mode — ignored by standalone script.
   */
  apiBaseUrl?: string;
  apiKey?: string;
  tableId?: string;
  gmailFilter?: string;
  /** @deprecated use groqApiKey */
  geminiApiKey?: string;
  /** @deprecated use groqModel */
  geminiModel?: string;
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
 * Runs every N minutes in Google's cloud — uses Groq for AI extraction.
 */
export function buildGoogleAppsScript(config: AppsScriptConfig): string {
  const sheetTitle = escapeJsSingleQuoted(config.sheetTitle);
  const triggerMinutes = Math.max(1, Math.min(60, config.triggerMinutes ?? 1));
  const maxThreads = Math.max(5, Math.min(50, config.maxThreads ?? 20));
  const groqKey = escapeJsSingleQuoted(
    (config.groqApiKey || config.geminiApiKey || "").trim()
  );
  const groqModel = escapeJsSingleQuoted(
    (config.groqModel || config.geminiModel || "llama-3.1-8b-instant").trim()
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
 *   1) Reads YOUR starred Gmail (GmailApp)
 *   2) Calls Groq AI to structure fields into your columns
 *   3) Writes / updates rows in this spreadsheet
 *
 * Primary auto-sync is also driven from the InboxFlow website (server keep-alive).
 */
var INBOXFLOW_CONFIG = {
  SHEET_TITLE: '${sheetTitle}',
  GROQ_API_KEY: '${groqKey}',
  GROQ_MODEL: '${groqModel}',
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
    return String(body).slice(0, 6000);
  } catch (e) {
    return '';
  }
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

  var url = 'https://api.groq.com/openai/v1/chat/completions';
  var res = UrlFetchApp.fetch(url, {
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

  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code === 429) {
    // Brief backoff then one retry for Groq TPM limits
    Utilities.sleep(2000);
    res = UrlFetchApp.fetch(url, {
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

function collectStarredMessages_() {
  var messages = [];
  var seen = {};
  var start = 0;
  var pageSize = 50;
  var maxPages = 40;
  for (var page = 0; page < maxPages; page++) {
    var threads = GmailApp.search('is:starred', start, pageSize);
    if (!threads || threads.length === 0) break;
    for (var t = 0; t < threads.length; t++) {
      var threadMsgs = threads[t].getMessages();
      for (var m = 0; m < threadMsgs.length; m++) {
        var msg = threadMsgs[m];
        var id = msg.getId();
        if (seen[id]) continue;
        try {
          if (!msg.isStarred()) continue;
        } catch (eStar) {}
        seen[id] = true;
        messages.push(msg);
      }
    }
    if (threads.length < pageSize) break;
    start += pageSize;
  }
  if (messages.length === 0) {
    start = 0;
    for (var page2 = 0; page2 < maxPages; page2++) {
      var threads2 = GmailApp.search('is:starred', start, pageSize);
      if (!threads2 || threads2.length === 0) break;
      for (var t2 = 0; t2 < threads2.length; t2++) {
        var threadMsgs2 = threads2[t2].getMessages();
        for (var m2 = 0; m2 < threadMsgs2.length; m2++) {
          var msg2 = threadMsgs2[m2];
          var id2 = msg2.getId();
          if (seen[id2]) continue;
          seen[id2] = true;
          messages.push(msg2);
        }
      }
      if (threads2.length < pageSize) break;
      start += pageSize;
    }
  }
  return messages;
}

function runStandaloneSync_() {
  if (!INBOXFLOW_CONFIG.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY missing in script config. Re-enable auto-sync from InboxFlow website.');
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
    var extracted = extractWithGroq_(fromAddr, subject, bodyText);
    var row = rowFromMessage_(message, extracted);
    if (idMap[id]) {
      sheet.getRange(idMap[id], 1, 1, row.length).setValues([row]);
      updated++;
    } else {
      sheet.appendRow(row);
      idMap[id] = sheet.getLastRow();
      written++;
    }
    // Pace requests for Groq free-tier TPM
    if (i < messages.length - 1) Utilities.sleep(800);
  }

  SpreadsheetApp.flush();
  return { written: written, updated: updated, scanned: messages.length };
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
  markTriggerMeta_(inboxFlowTriggerCount_());
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
      runStandaloneSync_();
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
    // Silent — timer + website Sync now. No sheet dialogs.
  } catch (e) {
    PropertiesService.getDocumentProperties().setProperty(
      'INBOXFLOW_LAST_ERROR',
      e.message
    );
    throw e;
  }
}

/** Menu disabled — enable + sync only from the InboxFlow website. */
function onOpen() {
  /* intentionally empty */
}
`;
}
