/**
 * 亡骨行者 Online：遊玩數據與天梯後端
 * 部署方式：建立一份 Google 試算表 → 擴充功能 → Apps Script → 貼上本檔
 *          → 部署 → 新增部署作業 → 網頁應用程式
 *            執行身分：我；存取權：所有人
 *          → 把網址貼到 js/config.js 的 GAS_URL
 * 工作表會自動建立：Players（每位玩家一列，天梯用）、Events（事件紀錄，分析用）
 */
const PLAYER_HEADERS = ['pid','name','lvl','xp','spec','kills','deaths','time','quests','boss','ver','first','last'];
const EVENT_HEADERS  = ['ts','pid','name','ev','lvl','zone','detail','ver'];

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); sh.setFrozenRows(1); }
  return sh;
}
const clean_ = (v, n) => String(v == null ? '' : v).replace(/[<>=]/g, '').slice(0, n || 40);
const num_ = (v, max) => Math.max(0, Math.min(Number(v) || 0, max || 1e9));

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const d = JSON.parse(e.postData.contents);
    const pid = clean_(d.pid, 32);
    if (!/^p[a-z0-9]{6,30}$/.test(pid)) return json_({ ok: false });
    const now = new Date();
    const name = clean_(d.name, 12) || '無名亡者';
    const events = (d.events || []).slice(0, 50);

    const ev = sheet_('Events', EVENT_HEADERS);
    const rows = events.map(x => {
      const detail = Object.assign({}, x); ['ev','ts','zone','lvl'].forEach(k => delete detail[k]);
      return [new Date(num_(x.ts) || now), pid, name, clean_(x.ev, 12), num_(x.lvl, 99), clean_(x.zone, 12), JSON.stringify(detail).slice(0, 200), clean_(d.ver, 10)];
    });
    if (rows.length) ev.getRange(ev.getLastRow() + 1, 1, rows.length, EVENT_HEADERS.length).setValues(rows);

    const sh = sheet_('Players', PLAYER_HEADERS);
    const data = sh.getDataRange().getValues();
    let r = data.findIndex((row, i) => i > 0 && row[0] === pid);
    const bossEv = events.find(x => x.ev === 'boss');
    const prevBoss = r > 0 ? data[r][9] : '';
    const boss = bossEv ? (prevBoss ? Math.min(prevBoss, num_(bossEv.t)) : num_(bossEv.t)) : prevBoss;
    const row = [pid, name, num_(d.lvl, 99), num_(d.xp), clean_(d.spec, 10), num_(d.kills), num_(d.deaths), num_(d.time), num_(d.quests, 99), boss, clean_(d.ver, 10), r > 0 ? data[r][11] : now, now];
    if (r > 0) sh.getRange(r + 1, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'top';
  if (action !== 'top') return json_({ ok: false });
  const cache = CacheService.getScriptCache();
  const hit = cache.get('top');
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  const data = sheet_('Players', PLAYER_HEADERS).getDataRange().getValues().slice(1);
  const top = data
    .map(r => ({ pid: r[0], name: r[1], lvl: r[2], xp: r[3], spec: r[4], kills: r[5], deaths: r[6], time: r[7], quests: r[8], boss: r[9] || 0 }))
    .sort((a, b) => b.lvl - a.lvl || b.xp - a.xp || a.time - b.time)
    .slice(0, 30);
  const out = JSON.stringify({ ok: true, top, updated: new Date().toISOString() });
  cache.put('top', out, 60);
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

const json_ = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
