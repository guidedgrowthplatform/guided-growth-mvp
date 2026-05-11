/**
 * voice-sync trigger: Google Sheet onChange → GitHub repository_dispatch.
 *
 * Setup: see ./README.md
 * Script properties required: GITHUB_REPO, GITHUB_PAT
 * Optional: DEBOUNCE_MS (default 30000)
 */

const PROPS = PropertiesService.getScriptProperties();
const WATCHED_TAB = 'Screens';
const RELEVANT_CHANGES = {
  EDIT: 1,
  INSERT_ROW: 1,
  REMOVE_ROW: 1,
  INSERT_COLUMN: 1,
  REMOVE_COLUMN: 1,
};

function onChangeHandler(e) {
  if (!e || !RELEVANT_CHANGES[e.changeType]) return;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const activeTab = sheet.getName();
  if (activeTab !== WATCHED_TAB) return;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    clearPendingTriggers_();
    const debounceMs = Number(PROPS.getProperty('DEBOUNCE_MS') || 30000);
    ScriptApp.newTrigger('firePending_').timeBased().after(debounceMs).create();
    PROPS.setProperty(
      'pending_meta',
      JSON.stringify({
        changeType: e.changeType,
        tab: activeTab,
        ts: new Date().toISOString(),
      })
    );
  } finally {
    lock.releaseLock();
  }
}

function clearPendingTriggers_() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'firePending_'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
}

function firePending_() {
  clearPendingTriggers_();

  const repo = PROPS.getProperty('GITHUB_REPO');
  const pat = PROPS.getProperty('GITHUB_PAT');
  if (!repo || !pat) {
    console.error('voice-sync trigger missing GITHUB_REPO or GITHUB_PAT script property');
    return;
  }

  const meta = JSON.parse(PROPS.getProperty('pending_meta') || '{}');
  const res = UrlFetchApp.fetch(
    'https://api.github.com/repos/' + repo + '/dispatches',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + pat,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'voice-sync-trigger',
      },
      payload: JSON.stringify({
        event_type: 'voice-sync',
        client_payload: Object.assign({ source: 'apps-script' }, meta),
      }),
      muteHttpExceptions: true,
    }
  );

  const code = res.getResponseCode();
  if (code !== 204) {
    console.error('voice-sync dispatch failed ' + code + ': ' + res.getContentText());
    return;
  }

  PROPS.deleteProperty('pending_meta');
}
