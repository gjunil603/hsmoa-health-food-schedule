const { google } = require('googleapis');

const SHEET_TAB = process.env.GOOGLE_SHEET_TAB || 'schedules';
const HEADERS = [
  '날짜',
  '시작',
  '종료',
  '채널코드',
  '채널',
  '상품명',
  '가격',
  'LIVE',
  '상품URL',
  '카테고리',
  '이미지',
  '상품ID',
  '동기화시각',
];

function getCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (err) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON 형식이 올바르지 않습니다.');
    }
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

function isSheetsConfigured() {
  return Boolean(process.env.GOOGLE_SHEET_ID && getCredentials());
}

async function getSheetsClient() {
  const credentials = getCredentials();
  if (!credentials || !process.env.GOOGLE_SHEET_ID) {
    throw new Error('구글 시트 환경 변수가 설정되지 않았습니다.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

async function ensureHeader(sheets) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const range = `${SHEET_TAB}!A1:M1`;

  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const firstRow = existing.data.values?.[0];
    if (firstRow && firstRow[0] === HEADERS[0]) {
      return;
    }
  } catch (err) {
    // 탭이 없으면 아래에서 생성 시도
  }

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_TAB } } }],
      },
    });
  } catch (err) {
    // 이미 있으면 무시
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_TAB}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS] },
  });
}

function scheduleToRow(date, item, syncedAt) {
  return [
    date,
    item.start || '',
    item.end || '',
    item.channel || '',
    item.channelLabel || '',
    item.name || '',
    item.price == null ? '' : String(item.price),
    item.isLive ? 'Y' : 'N',
    item.url || '',
    item.category3 || '',
    item.image || '',
    item.id == null ? '' : String(item.id),
    syncedAt,
  ];
}

function rowToSchedule(row) {
  return {
    id: row[11] || null,
    name: row[5] || '',
    channel: row[3] || '',
    channelLabel: row[4] || row[3] || '',
    price: row[6] ? Number(row[6]) : null,
    start: row[1] || null,
    end: row[2] || null,
    image: row[10] || null,
    category3: row[9] || '',
    url: row[8] || null,
    isLive: String(row[7] || '').toUpperCase() === 'Y',
  };
}

async function readAllRows(sheets) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  await ensureHeader(sheets);
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_TAB}!A2:M`,
  });
  return result.data.values || [];
}

async function writeAllRows(sheets, rows) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${SHEET_TAB}!A2:M`,
  });

  if (!rows.length) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_TAB}!A2`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
}

async function replaceDateSchedules(date, schedules) {
  const sheets = await getSheetsClient();
  await ensureHeader(sheets);

  const syncedAt = new Date().toISOString();
  const existing = await readAllRows(sheets);
  const kept = existing.filter((row) => row[0] !== date);
  const nextRows = [
    ...kept,
    ...schedules.map((item) => scheduleToRow(date, item, syncedAt)),
  ];

  nextRows.sort((a, b) => {
    if (a[0] !== b[0]) return String(a[0]).localeCompare(String(b[0]));
    return String(a[1]).localeCompare(String(b[1]));
  });

  await writeAllRows(sheets, nextRows);

  return {
    date,
    count: schedules.length,
    syncedAt,
  };
}

async function getSchedulesForDate(date) {
  if (!isSheetsConfigured()) {
    return null;
  }

  const sheets = await getSheetsClient();
  const rows = await readAllRows(sheets);
  const matched = rows.filter((row) => row[0] === date);

  if (!matched.length) {
    return {
      schedules: [],
      syncedAt: null,
      empty: true,
    };
  }

  const schedules = matched
    .map(rowToSchedule)
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  return {
    schedules,
    syncedAt: matched[0][12] || null,
    empty: false,
  };
}

async function getSheetStatus() {
  if (!isSheetsConfigured()) {
    return { configured: false };
  }

  try {
    const sheets = await getSheetsClient();
    const rows = await readAllRows(sheets);
    const dates = [...new Set(rows.map((row) => row[0]).filter(Boolean))].sort();
    return {
      configured: true,
      tab: SHEET_TAB,
      rowCount: rows.length,
      dates,
    };
  } catch (err) {
    return {
      configured: true,
      error: err.message,
    };
  }
}

module.exports = {
  isSheetsConfigured,
  replaceDateSchedules,
  getSchedulesForDate,
  getSheetStatus,
  SHEET_TAB,
};
