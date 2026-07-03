const http = require('http');
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const AES_KEY = Buffer.from('0b659773-ee62-41f6-9162-5f4217488e2c').subarray(0, 16);
const HSMOA_BASE = 'https://trend.hsmoa-ad.com';

const CATEGORY = {
  category1: '식품',
  category2: '건강식품',
};

const CHANNEL_LABELS = {
  cjmall: 'CJ온스타일',
  cjmallplus: 'CJ온스타일+',
  gsshop: 'GS샵',
  gsmyshop: 'GS MY SHOP',
  hmall: '현대홈쇼핑',
  hmallplus: '현대홈쇼핑+',
  hnsmall: '홈앤쇼핑',
  immall: '공영쇼핑',
  kshop: 'KT알파쇼핑',
  kshopplus: 'KT알파쇼핑+',
  lotteimall: '롯데홈쇼핑',
  lotteimall1: '롯데OneTV',
  nsmall: 'NS홈쇼핑',
  nsmallplus: 'NS샵+',
  shopnt: '쇼핑엔티',
  ssgshop: '신세계라이브쇼핑',
  wshop: 'W쇼핑',
  bshop: 'SK스토아',
};

const CHANNEL_ALIASES = {
  lotteonetv: 'lotteimall1',
};

function normalizeChannel(channel) {
  return CHANNEL_ALIASES[channel] || channel;
}

function getChannelList() {
  return Object.entries(CHANNEL_LABELS)
    .map(([channel, label]) => ({ channel, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ko'));
}

function decryptSchedule(dataB64, ivHex) {
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-128-cbc', AES_KEY, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  const compressed = Buffer.from(decrypted.toString('utf-8'), 'base64');
  const text = zlib.inflateSync(compressed).toString('utf-8');
  return JSON.parse(text);
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

function getKstDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function shiftKstDate(dateStr, { days = 0, months = 0 }) {
  const date = new Date(`${dateStr}T12:00:00+09:00`);
  if (months) date.setMonth(date.getMonth() + months);
  if (days) date.setDate(date.getDate() + days);
  return getKstDateString(date);
}

function getAllowedDateRange() {
  const today = getKstDateString();
  return {
    min: shiftKstDate(today, { months: -3 }),
    max: shiftKstDate(today, { days: 7 }),
  };
}

function isDateInRange(dateStr) {
  const { min, max } = getAllowedDateRange();
  return dateStr >= min && dateStr <= max;
}

function getKstHour(iso) {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      hour: 'numeric',
      hour12: false,
    }).format(new Date(iso)),
  );
}

function collectSchedules(data, dateStr, seen, schedules) {
  for (const slot of data?.results || []) {
    for (const item of slot.schedules || []) {
      if (getKstDateString(new Date(item.start_datetime)) !== dateStr) continue;
      const key = `${item.pdid}-${item.start_datetime}`;
      if (!seen.has(key)) {
        seen.add(key);
        schedules.push(item);
      }
    }
  }
}

async function fetchEncryptedApi(path, params) {
  const query = new URLSearchParams(params);
  const payload = await fetchJson(`${HSMOA_BASE}${path}?${query}`);
  if (!payload?.results || !payload?.iv) {
    throw new Error('편성표 응답 형식이 올바르지 않습니다.');
  }
  return decryptSchedule(payload.results, payload.iv);
}

async function fetchSchedulePage(params) {
  return fetchEncryptedApi('/api/trend/v3/schedule', params);
}

async function fetchProductCount(dateStr) {
  const data = await fetchEncryptedApi('/api/trend/v3/schedule/channel-schedule-summary', {
    start_datetime: `${dateStr}T00:00:00+09:00`,
    end_datetime: `${dateStr}T23:59:59+09:00`,
    ...CATEGORY,
  });

  const daySummary = data.results?.find((item) => item.date === dateStr);
  return daySummary?.channel_total_counts ?? 0;
}

function getLastScheduleTime(data) {
  const slots = data?.results || [];
  for (let i = slots.length - 1; i >= 0; i -= 1) {
    const time = slots[i]?.time;
    if (time) return time;
  }
  return null;
}

async function fetchFullDaySchedule(dateStr, targetCount = 0) {
  const baseParams = {
    start_datetime: `${dateStr}T00:00:00+09:00`,
    end_datetime: `${dateStr}T23:59:59+09:00`,
    ...CATEGORY,
  };

  const seen = new Set();
  const schedules = [];

  const today = getKstDateString();
  if (dateStr === today) {
    const currentHour = getKstHour(new Date().toISOString());
    const upData = await fetchSchedulePage({
      ...baseParams,
      time_size: String(currentHour + 1),
      direction: 'up',
    });
    collectSchedules(upData, dateStr, seen, schedules);
  }

  let pageParams = {
    ...baseParams,
    time_size: '4',
    direction: 'down',
    base_hour_datetime: `${dateStr}T00:00:00+09:00`,
  };

  let stagnantPages = 0;

  for (let page = 0; page < 15; page += 1) {
    const before = seen.size;
    const data = await fetchSchedulePage(pageParams);
    collectSchedules(data, dateStr, seen, schedules);

    const lastTime = getLastScheduleTime(data);
    if (!lastTime) break;

    stagnantPages = seen.size === before ? stagnantPages + 1 : 0;
    const lastHour = getKstHour(lastTime);

    if (lastHour >= 23) {
      const finalData = await fetchSchedulePage({
        ...baseParams,
        direction: 'down',
        base_hour_datetime: lastTime,
        time_size: '1',
      });
      collectSchedules(finalData, dateStr, seen, schedules);
    }

    if (lastHour >= 23 && stagnantPages >= 1) break;

    pageParams = {
      ...baseParams,
      direction: 'down',
      base_hour_datetime: lastTime,
      time_size: String(Math.min(4, Math.max(1, 23 - lastHour))),
    };
  }

  if (targetCount > 0 && schedules.length < targetCount) {
    const gapFills = [
      {
        direction: 'up',
        base_hour_datetime: `${dateStr}T23:59:59+09:00`,
        time_size: '24',
      },
      {
        direction: 'down',
        base_hour_datetime: `${dateStr}T00:00:00+09:00`,
        time_size: '24',
      },
    ];

    for (const extra of gapFills) {
      const data = await fetchSchedulePage({ ...baseParams, ...extra });
      collectSchedules(data, dateStr, seen, schedules);
    }
  }

  schedules.sort(
    (a, b) => new Date(a.start_datetime) - new Date(b.start_datetime),
  );

  return schedules.map((item) => ({
    id: item.pdid,
    name: item.name,
    channel: normalizeChannel(item.tv_channel),
    channelLabel: CHANNEL_LABELS[normalizeChannel(item.tv_channel)] || item.tv_channel,
    price: item.sale_price,
    start: item.start_datetime,
    end: item.end_datetime,
    image: item.image,
    category1: item.category1,
    category2: item.category2,
    category3: item.category3,
    url: item.url || null,
    isLive: isLiveNow(item.start_datetime, item.end_datetime),
  }));
}

function isLiveNow(start, end) {
  const now = Date.now();
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : startMs + 60 * 60 * 1000;
  return now >= startMs && now <= endMs;
}

const scheduleCache = new Map();

function getCachedSchedule(date) {
  const entry = scheduleCache.get(date);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    scheduleCache.delete(date);
    return null;
  }
  return entry;
}

function setCachedSchedule(date, body) {
  scheduleCache.set(date, {
    cachedAt: Date.now(),
    body,
  });
}

async function buildScheduleResponse(date) {
  const summaryTotal = await fetchProductCount(date);
  const schedules = await fetchFullDaySchedule(date, summaryTotal);
  return {
    date,
    category: CATEGORY,
    channels: getChannelList(),
    dateRange: getAllowedDateRange(),
    updatedAt: new Date().toISOString(),
    total: schedules.length,
    schedules,
  };
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const fullPath = path.join(__dirname, 'public', filePath);

  if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(fullPath);
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.webmanifest': 'application/manifest+json',
    };

    res.writeHead(200, {
      'Content-Type': types[ext] || 'text/plain',
      'Cache-Control': 'no-store',
    });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/schedule') {
    try {
      const date = url.searchParams.get('date') || getKstDateString();
      if (!isDateInRange(date)) {
        const { min, max } = getAllowedDateRange();
        sendJson(res, 400, {
          error: `조회 가능 기간은 ${min} ~ ${max} 입니다.`,
          min,
          max,
        });
        return;
      }

      const forceRefresh = url.searchParams.get('refresh') === '1';
      const cached = !forceRefresh ? getCachedSchedule(date) : null;

      if (cached) {
        sendJson(res, 200, {
          ...cached.body,
          fromCache: true,
          cachedAt: new Date(cached.cachedAt).toISOString(),
        });
        return;
      }

      const body = await buildScheduleResponse(date);
      setCachedSchedule(date, body);
      sendJson(res, 200, {
        ...body,
        fromCache: false,
        cachedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: '편성표를 불러오지 못했습니다.' });
    }
    return;
  }

  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
