import {
  INBOXFLOW_GCP_PROJECT_ID,
  INBOXFLOW_GCP_PROJECT_NUMBER,
} from "@/lib/gmail/inboxflow-gcp";
import {
  sheetSyncGmailFilterLabel,
  type SheetSyncGmailFilter,
} from "@/lib/sheet-sync/gmail-filter";

export type AppsScriptConfig = {
  apiBaseUrl: string;
  apiKey: string;
  tableId: string;
  sheetTitle: string;
  /** Time-driven trigger interval (minutes). */
  triggerMinutes?: number;
  /** Only rows from starred Gmail messages are synced when "starred". */
  gmailFilter?: SheetSyncGmailFilter;
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
    ],
  });
}

/** Container-bound Apps Script installed on the user's spreadsheet. */
export function buildGoogleAppsScript(config: AppsScriptConfig): string {
  const apiBase = config.apiBaseUrl.replace(/\/$/, "");
  const sheetTitle = config.sheetTitle.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const triggerMinutes = Math.max(1, Math.min(60, config.triggerMinutes ?? 1));
  const gmailFilter = config.gmailFilter ?? "starred";
  const filterLabel = sheetSyncGmailFilterLabel(gmailFilter);

  return `/**
 * InboxFlow — auto-sync script (Google Cloud: ${INBOXFLOW_GCP_PROJECT_ID} / ${INBOXFLOW_GCP_PROJECT_NUMBER}).
 * Sync scope: ${filterLabel} (Gmail messages with the STARRED label).
 * This script does NOT read Gmail directly. It calls your InboxFlow server, which:
 *   1) syncs starred mail from Gmail, 2) AI-extracts rows, 3) returns data for this sheet.
 * Link this script project to GCP number ${INBOXFLOW_GCP_PROJECT_NUMBER} in Apps Script → Project settings if triggers fail.
 */
const INBOXFLOW_CONFIG = {
  API_BASE_URL: '${apiBase}',
  API_KEY: '${config.apiKey}',
  TABLE_ID: '${config.tableId}',
  SHEET_TITLE: '${sheetTitle}',
  /** Only starred Gmail messages are included in the sheet. WhatsApp rows are kept. */
  GMAIL_FILTER: '${gmailFilter}',
};

function fetchInboxFlowPayload_() {
  var url =
    INBOXFLOW_CONFIG.API_BASE_URL +
    '/api/v1/sheet-sync/data?tableId=' +
    encodeURIComponent(INBOXFLOW_CONFIG.TABLE_ID) +
    '&apiKey=' +
    encodeURIComponent(INBOXFLOW_CONFIG.API_KEY) +
    '&gmailFilter=' +
    encodeURIComponent(INBOXFLOW_CONFIG.GMAIL_FILTER);
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + INBOXFLOW_CONFIG.API_KEY,
      'X-Inboxflow-Api-Key': INBOXFLOW_CONFIG.API_KEY,
      'Bypass-Tunnel-Reminder': 'true',
      'ngrok-skip-browser-warning': '1',
      'User-Agent': 'InboxFlow-SheetSync/1',
    },
    muteHttpExceptions: true,
    timeout: 290000,
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code !== 200) {
    if (code === 401) {
      throw new Error(
        'InboxFlow API key rejected (401). On the InboxFlow website open Google Sheets → Update script, then Sync now.'
      );
    }
    if (code === 503 && body.indexOf('Tunnel Unavailable') !== -1) {
      throw new Error(
        'InboxFlow dev tunnel is offline (503). On the InboxFlow site: add NGROK_AUTHTOKEN to .env, restart npm run dev, click Update script. Or use Sync now (works without tunnel).'
      );
    }
    throw new Error('InboxFlow API ' + code + ': ' + body.slice(0, 200));
  }
  const json = JSON.parse(body);
  if (!json.data) {
    throw new Error('Unexpected API response: ' + body);
  }
  return json.data;
}

function getDataSheet_(ss) {
  const name = INBOXFLOW_CONFIG.SHEET_TITLE;
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function writePayload_(sheet, payload) {
  var headers = payload.headers;
  sheet.clear();
  if (headers.length === 0) return;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  if (payload.rows.length === 0) return;
  var values = payload.rows.map(function (row) {
    return headers.map(function (h) {
      var v = row[h];
      return v === null || v === undefined ? '' : String(v);
    });
  });
  // getRange(row, col, numRows, numCols) — not end row
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
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

/** Authorize script scopes via API (Spreadsheet + UrlFetch) before creating triggers. */
function primeInboxFlowAuthorization() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet not found');
  }
  fetchInboxFlowPayload_();
  return true;
}

function recordSyncSuccess_(rowCount) {
  var props = PropertiesService.getDocumentProperties();
  props.setProperty('INBOXFLOW_READY', '1');
  props.setProperty('INBOXFLOW_LAST_SYNC', new Date().toISOString());
  props.setProperty('INBOXFLOW_LAST_ROWS', String(rowCount));
  props.deleteProperty('INBOXFLOW_LAST_ERROR');
}

function runInboxFlowSync_() {
  var payload = fetchInboxFlowPayload_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet not found.');
  }
  var sheet = getDataSheet_(ss);
  writePayload_(sheet, payload);
  SpreadsheetApp.flush();
  return payload.rows.length;
}

/** Called by InboxFlow server API only (no Spreadsheet UI). */
function setupInboxFlowAutomationFromApi() {
  installInboxFlowTimeTrigger_();
  var rowCount = 0;
  try {
    rowCount = runInboxFlowSync_();
    recordSyncSuccess_(rowCount);
  } catch (e) {
    PropertiesService.getDocumentProperties().setProperty(
      'INBOXFLOW_LAST_ERROR',
      e.message
    );
  }
  return inboxFlowTriggerCount_();
}

/** Returns number of syncInboxFlowData time triggers (for server verification). */
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

/**
 * Called from the InboxFlow menu in the spreadsheet — installs the time trigger.
 */
function setupInboxFlowAutomation() {
  try {
    var triggers = setupInboxFlowAutomationFromApi();
    var props = PropertiesService.getDocumentProperties();
    var err = props.getProperty('INBOXFLOW_LAST_ERROR');
    var rows = props.getProperty('INBOXFLOW_LAST_ROWS') || '0';
    var msg =
      'Auto-sync: ON (' +
      triggers +
      ' timer, every ${triggerMinutes} min).\\n' +
      'Scope: ${filterLabel}.\\n' +
      'Last sync: ' +
      rows +
      ' rows written to tab "' +
      INBOXFLOW_CONFIG.SHEET_TITLE +
      '".';
    if (err) {
      msg += '\\n\\nSync error: ' + err + '\\nUse InboxFlow → Sync now after fixing.';
    }
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
  var rows = props.getProperty('INBOXFLOW_LAST_ROWS');
  var err = props.getProperty('INBOXFLOW_LAST_ERROR');
  var msg =
    'Auto-sync timers: ' +
    (triggers > 0 ? triggers + ' active' : 'NONE — use Enable auto-sync') +
    '\\nScope: ${filterLabel}' +
    '\\nTab: ' +
    INBOXFLOW_CONFIG.SHEET_TITLE;
  if (last) {
    msg += '\\nLast script sync: ' + last + ' (' + (rows || '?') + ' rows)';
  } else {
    msg += '\\nLast script sync: never';
  }
  if (err) {
    msg += '\\nLast error: ' + err;
  }
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (uiErr) {
    Logger.log(msg);
  }
}

/** Menu only — simple onOpen cannot create time triggers without authorization. */
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

/** Pull latest rows from InboxFlow (runs on a time trigger). */
function syncInboxFlowData() {
  try {
    var rowCount = runInboxFlowSync_();
    recordSyncSuccess_(rowCount);
    Logger.log('Synced ' + rowCount + ' rows from InboxFlow.');
    try {
      SpreadsheetApp.getUi().alert('Synced ' + rowCount + ' rows to "' + INBOXFLOW_CONFIG.SHEET_TITLE + '".');
    } catch (uiErr) {
      /* trigger run has no UI */
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
