const dateInput = document.getElementById('dateInput');
const datePickerToggle = document.getElementById('datePickerToggle');
const datePickerDisplay = document.getElementById('datePickerDisplay');
const datePickerPanel = document.getElementById('datePickerPanel');
const calMonthLabel = document.getElementById('calMonthLabel');
const calGrid = document.getElementById('calGrid');
const calPrevMonth = document.getElementById('calPrevMonth');
const calNextMonth = document.getElementById('calNextMonth');
const calToday = document.getElementById('calToday');
const statusText = document.getElementById('statusText');
const scheduleList = document.getElementById('scheduleList');
const totalCount = document.getElementById('totalCount');
const filters = document.getElementById('filters');
const liveOnly = document.getElementById('liveOnly');
const channelSelect = document.getElementById('channelSelect');
const downloadExcelBtn = document.getElementById('downloadExcelBtn');
const downloadModal = document.getElementById('downloadModal');
const downloadTodayBtn = document.getElementById('downloadTodayBtn');
const downloadRangeBtn = document.getElementById('downloadRangeBtn');
const downloadCancelBtn = document.getElementById('downloadCancelBtn');
const scrollTopBtn = document.getElementById('scrollTopBtn');
const cardTemplate = document.getElementById('cardTemplate');

if (!dateInput || !datePickerToggle || !datePickerPanel || !datePickerDisplay) {
  if (statusText) {
    statusText.textContent = '화면 로딩 오류입니다. Ctrl+Shift+R 로 강력 새로고침 해주세요.';
  }
  throw new Error('Required date picker elements are missing from the page.');
}

let allSchedules = [];
let allChannels = [];
let lastUpdatedAt = null;
let lastDate = '';
let lastFromCache = false;
let lastSource = '';
let isLiveFilterOn = false;
let dateRange = { min: '', max: '' };
let calendarView = { year: 0, month: 0 };
let loadRequestId = 0;
let loadAbortController = null;

function setupDateInputLimits(range = dateRange) {
  const limits = range.min && range.max ? range : getDefaultDateRange();
  dateRange = limits;
  clampDateInput();
  syncCalendarView();
}

function clampDateInput() {
  if (!dateInput.value) {
    dateInput.value = getKstDateString();
  }
  if (!dateRange.min || !dateRange.max) {
    return;
  }
  if (dateInput.value < dateRange.min) {
    dateInput.value = dateRange.min;
  } else if (dateInput.value > dateRange.max) {
    dateInput.value = dateRange.max;
  }
}

function formatDateKorean(dateStr) {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

function formatMonthKorean(year, monthIndex) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
  }).format(new Date(`${year}-${String(monthIndex + 1).padStart(2, '0')}-01T12:00:00+09:00`));
}

function updateDateDisplay() {
  datePickerDisplay.textContent = formatDateKorean(dateInput.value);
}

function isDateSelectable(dateStr) {
  return dateStr >= dateRange.min && dateStr <= dateRange.max;
}

function syncCalendarView() {
  const [year, month] = (dateInput.value || getKstDateString()).split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    const today = getKstDateString().split('-').map(Number);
    calendarView.year = today[0];
    calendarView.month = today[1] - 1;
    return;
  }
  calendarView.year = year;
  calendarView.month = month - 1;
}

function setSelectedDate(dateStr, reload = true) {
  dateInput.value = dateStr;
  clampDateInput();
  updateDateDisplay();
  syncCalendarView();
  renderCalendar();
  if (reload) loadSchedule();
}

function openCalendar() {
  syncCalendarView();
  renderCalendar();
  datePickerPanel.classList.remove('hidden');
  datePickerToggle.setAttribute('aria-expanded', 'true');
}

function closeCalendar() {
  datePickerPanel.classList.add('hidden');
  datePickerToggle.setAttribute('aria-expanded', 'false');
}

function shiftCalendarMonth(delta) {
  const date = new Date(`${calendarView.year}-${String(calendarView.month + 1).padStart(2, '0')}-01T12:00:00+09:00`);
  date.setMonth(date.getMonth() + delta);
  calendarView.year = date.getFullYear();
  calendarView.month = date.getMonth();
  renderCalendar();
}

function monthHasSelectableDays(year, monthIndex) {
  const first = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  const lastDate = new Date(`${year}-${String(monthIndex + 1).padStart(2, '0')}-01T12:00:00+09:00`);
  lastDate.setMonth(lastDate.getMonth() + 1);
  lastDate.setDate(0);
  const last = getKstDateString(lastDate);
  return !(last < dateRange.min || first > dateRange.max);
}

function renderCalendar() {
  calMonthLabel.textContent = formatMonthKorean(calendarView.year, calendarView.month);
  calGrid.innerHTML = '';

  const firstDay = new Date(`${calendarView.year}-${String(calendarView.month + 1).padStart(2, '0')}-01T12:00:00+09:00`);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(calendarView.year, calendarView.month + 1, 0).getDate();
  const today = getKstDateString();

  calPrevMonth.disabled = !monthHasSelectableDays(
    calendarView.month === 0 ? calendarView.year - 1 : calendarView.year,
    calendarView.month === 0 ? 11 : calendarView.month - 1,
  );
  calNextMonth.disabled = !monthHasSelectableDays(
    calendarView.month === 11 ? calendarView.year + 1 : calendarView.year,
    calendarView.month === 11 ? 0 : calendarView.month + 1,
  );

  for (let i = 0; i < startWeekday; i += 1) {
    calGrid.appendChild(document.createElement('span'));
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = `${calendarView.year}-${String(calendarView.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cal-day';
    button.textContent = String(day);

    if (!isDateSelectable(dateStr)) {
      button.classList.add('disabled');
      button.disabled = true;
    }

    if (dateStr === today) {
      button.classList.add('today');
    }

    if (dateStr === dateInput.value) {
      button.classList.add('selected');
    }

    button.addEventListener('click', () => {
      setSelectedDate(dateStr);
      closeCalendar();
    });

    calGrid.appendChild(button);
  }
}

function shiftKstDate(dateStr, { days = 0, months = 0 }) {
  const date = new Date(`${dateStr}T12:00:00+09:00`);
  if (months) date.setMonth(date.getMonth() + months);
  if (days) date.setDate(date.getDate() + days);
  return getKstDateString(date);
}

function getDefaultDateRange() {
  const today = getKstDateString();
  return {
    min: shiftKstDate(today, { months: -3 }),
    max: shiftKstDate(today, { days: 7 }),
  };
}

function getKstDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatTime(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function formatPrice(value) {
  if (!value) return '';
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function shiftDate(days) {
  setSelectedDate(shiftKstDate(dateInput.value, { days }));
}

function getChannelCount(channel) {
  return allSchedules.filter((item) => item.channel === channel).length;
}

function applyFilters(schedules) {
  let result = schedules;
  if (isLiveFilterOn) {
    result = result.filter((item) => item.isLive);
  }
  if (channelSelect.value) {
    result = result.filter((item) => item.channel === channelSelect.value);
  }
  return result;
}

function updateStatusText() {
  const visibleCount = applyFilters(allSchedules).length;
  const liveCount = allSchedules.filter((item) => item.isLive).length;
  const parts = [`${visibleCount}개 표시`];

  if (liveCount > 0) {
    parts.push(`방송 중 ${liveCount}`);
  }

  if (lastUpdatedAt && !Number.isNaN(lastUpdatedAt.getTime())) {
    parts.push(`${formatTime(lastUpdatedAt)} 갱신`);
  }

  if (lastFromCache) {
    parts.push('캐시');
  }

  if (lastSource === 'sheet') {
    parts.push('시트');
  } else if (lastSource === 'live+sheet') {
    parts.push('API+시트');
  } else if (lastSource === 'live') {
    parts.push('API');
  }

  statusText.textContent = parts.join(' · ');
}

function populateChannelSelect() {
  const current = channelSelect.value;
  channelSelect.innerHTML = '<option value="">전체 채널</option>';

  for (const { channel, label } of allChannels) {
    const count = getChannelCount(channel);
    const option = document.createElement('option');
    option.value = channel;
    option.textContent = count > 0 ? `${label} (${count})` : label;
    channelSelect.appendChild(option);
  }

  const hasCurrent = [...channelSelect.options].some((opt) => opt.value === current);
  channelSelect.value = hasCurrent ? current : '';
}

function renderCard(item) {
  const node = cardTemplate.content.cloneNode(true);
  const card = node.querySelector('.item');
  const thumb = node.querySelector('.item-thumb');

  node.querySelector('.item-time').textContent = formatTime(item.start);
  node.querySelector('.item-channel').textContent = item.channelLabel;
  node.querySelector('.item-title').textContent = item.name;
  node.querySelector('.item-price').textContent = formatPrice(item.price);

  if (item.image) {
    thumb.src = item.image;
    thumb.alt = item.name;
  } else {
    thumb.classList.add('hidden');
  }

  if (item.url) {
    card.href = item.url;
  } else {
    card.removeAttribute('href');
    card.style.pointerEvents = 'none';
  }

  if (item.isLive) {
    card.classList.add('live');
  }

  return node;
}

function renderSchedules() {
  const visibleSchedules = applyFilters(allSchedules);
  scheduleList.innerHTML = '';
  updateStatusText();

  if (!allSchedules.length) {
    scheduleList.innerHTML = '<p class="empty">이 날짜에 건강식품 방송이 없습니다.</p>';
    return;
  }

  if (!visibleSchedules.length) {
    scheduleList.innerHTML = '<p class="empty">조건에 맞는 방송이 없습니다.</p>';
    return;
  }

  for (const item of visibleSchedules) {
    scheduleList.appendChild(renderCard(item));
  }
}

function resetFilters() {
  isLiveFilterOn = false;
  liveOnly.classList.remove('active');
  liveOnly.setAttribute('aria-pressed', 'false');
  channelSelect.value = '';
}

function escapeCsvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatDateTimeForExcel(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function buildCsv(rows) {
  const headers = ['날짜', '시작', '종료', '채널', '상품명', '가격', 'LIVE', '상품URL', '카테고리'];
  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const item of rows) {
    lines.push([
      item.date || dateInput.value,
      formatDateTimeForExcel(item.start),
      formatDateTimeForExcel(item.end),
      item.channelLabel || item.channel || '',
      item.name || '',
      item.price || '',
      item.isLive ? 'Y' : 'N',
      item.url || '',
      item.category3 || '',
    ].map(escapeCsvCell).join(','));
  }

  return `\uFEFF${lines.join('\r\n')}`;
}

function saveCsvFile(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getDownloadFilename(label) {
  const channelPart = channelSelect.value
    ? `_${channelSelect.options[channelSelect.selectedIndex].textContent.replace(/\s*\(\d+\)\s*$/, '')}`
    : '';
  const livePart = isLiveFilterOn ? '_LIVE' : '';
  return `건강식품_편성표_${label}${channelPart}${livePart}.csv`;
}

function downloadExcelToday() {
  const rows = applyFilters(allSchedules).map((item) => ({
    ...item,
    date: dateInput.value,
  }));
  if (!rows.length) {
    statusText.textContent = '다운로드할 편성표가 없습니다.';
    return;
  }

  saveCsvFile(buildCsv(rows), getDownloadFilename(dateInput.value));
}

async function downloadExcelRange() {
  const previous = statusText.textContent;
  statusText.textContent = '시트에서 오늘~7일 데이터 불러오는 중...';
  if (downloadExcelBtn) downloadExcelBtn.disabled = true;

  try {
    const response = await fetch('/api/sheets/export?days=7');
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '시트 내보내기 실패');
    }

    const rows = applyFilters(data.schedules || []);
    if (!rows.length) {
      statusText.textContent = '시트에 다운로드할 편성표가 없습니다. 새벽 동기화 후 다시 시도하세요.';
      return;
    }

    const label = `${data.startDate}_${data.endDate}`;
    saveCsvFile(buildCsv(rows), getDownloadFilename(label));
    statusText.textContent = `엑셀 저장 완료 · ${data.startDate}~${data.endDate} · ${rows.length}건`;
  } catch (err) {
    statusText.textContent = previous || '엑셀 다운로드 실패';
    alert(err.message);
  } finally {
    if (downloadExcelBtn) downloadExcelBtn.disabled = false;
  }
}

function openDownloadModal() {
  if (!downloadModal) return;
  downloadModal.classList.remove('hidden');
}

function closeDownloadModal() {
  if (!downloadModal) return;
  downloadModal.classList.add('hidden');
}

function downloadExcel() {
  openDownloadModal();
}

async function loadSchedule(forceRefresh = false) {
  const requestedDate = dateInput.value;
  const requestId = ++loadRequestId;

  if (loadAbortController) {
    loadAbortController.abort();
  }
  loadAbortController = new AbortController();

  statusText.textContent = '불러오는 중...';
  scheduleList.innerHTML = '';

  try {
    const params = new URLSearchParams({ date: requestedDate });
    if (forceRefresh) {
      params.set('refresh', '1');
    }
    const response = await fetch(`/api/schedule?${params}`, {
      signal: loadAbortController.signal,
    });
    const data = await response.json();

    if (requestId !== loadRequestId) return;
    if (dateInput.value !== requestedDate) return;

    if (!response.ok) {
      throw new Error(data.error || '불러오기 실패');
    }

    if (data.dateRange) {
      setupDateInputLimits(data.dateRange);
    }
    updateDateDisplay();

    const shouldResetFilters = data.date !== lastDate;
    allSchedules = data.schedules;
    allChannels = data.channels || [];
    lastUpdatedAt = new Date(data.updatedAt);
    lastDate = data.date;
    lastFromCache = Boolean(data.fromCache);
    lastSource = data.source || '';

    if (shouldResetFilters) {
      resetFilters();
    }

    totalCount.textContent = data.total;
    totalCount.classList.remove('hidden');
    filters.classList.remove('hidden');

    populateChannelSelect();
    renderSchedules();
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (requestId !== loadRequestId) return;
    if (dateInput.value !== requestedDate) return;

    allSchedules = [];
    allChannels = [];
    lastDate = '';
    lastUpdatedAt = null;
    lastFromCache = false;
    lastSource = '';
    resetFilters();
    totalCount.textContent = '0';
    totalCount.classList.add('hidden');
    filters.classList.add('hidden');
    channelSelect.innerHTML = '<option value="">전체 채널</option>';
    statusText.textContent = '불러오기 실패';
    scheduleList.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

document.getElementById('refreshBtn').addEventListener('click', () => loadSchedule(true));
document.getElementById('prevDay').addEventListener('click', () => shiftDate(-1));
document.getElementById('nextDay').addEventListener('click', () => shiftDate(1));
document.getElementById('todayBtn').addEventListener('click', () => {
  setSelectedDate(getKstDateString());
});
datePickerToggle.addEventListener('click', (event) => {
  event.stopPropagation();
  if (datePickerPanel.classList.contains('hidden')) {
    openCalendar();
  } else {
    closeCalendar();
  }
});
calPrevMonth.addEventListener('click', () => shiftCalendarMonth(-1));
calNextMonth.addEventListener('click', () => shiftCalendarMonth(1));
calToday.addEventListener('click', () => {
  setSelectedDate(getKstDateString());
  closeCalendar();
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.date-picker')) {
    closeCalendar();
  }
});
channelSelect.addEventListener('change', renderSchedules);
liveOnly.addEventListener('click', () => {
  isLiveFilterOn = !isLiveFilterOn;
  liveOnly.classList.toggle('active', isLiveFilterOn);
  liveOnly.setAttribute('aria-pressed', String(isLiveFilterOn));
  renderSchedules();
});
if (downloadExcelBtn) {
  downloadExcelBtn.addEventListener('click', downloadExcel);
}
if (downloadTodayBtn) {
  downloadTodayBtn.addEventListener('click', () => {
    closeDownloadModal();
    downloadExcelToday();
  });
}
if (downloadRangeBtn) {
  downloadRangeBtn.addEventListener('click', () => {
    closeDownloadModal();
    downloadExcelRange();
  });
}
if (downloadCancelBtn) {
  downloadCancelBtn.addEventListener('click', closeDownloadModal);
}
if (downloadModal) {
  downloadModal.addEventListener('click', (event) => {
    if (event.target === downloadModal) {
      closeDownloadModal();
    }
  });
}
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeDownloadModal();
  }
});

function updateScrollTopButton() {
  if (!scrollTopBtn) return;
  scrollTopBtn.classList.toggle('hidden', window.scrollY < 400);
}

if (scrollTopBtn) {
  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  window.addEventListener('scroll', updateScrollTopButton, { passive: true });
  updateScrollTopButton();
}

setupDateInputLimits();
setSelectedDate(dateInput.value || getKstDateString(), false);
loadSchedule();
