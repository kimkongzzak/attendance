// Default Tracked Employees
const DEFAULT_EMPLOYEES = [
  { empNo: 'BF202306014', empName: '서보연', cardId: '1814' },
  { empNo: 'BF202303018', empName: '황은별', cardId: '0548' },
  { empNo: 'BF202111029', empName: '최해리', cardId: '1247' },
  { empNo: 'BF202306015', empName: '김민성', cardId: '1813' },
  { empNo: 'BF202004002', empName: '이슬기', cardId: '1440' },
  { empNo: 'BF202110022', empName: '강정민', cardId: '0611' },
  { empNo: 'BF202306010', empName: '이유정', cardId: '0425' }
];

// Built-in Korean Public Holidays Dataset (2024 - 2026 Fallback)
const BUILTIN_KR_HOLIDAYS = {
  // 2026
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일 (삼일절)",
  "2026-05-01": "근로자의 날",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일 (부처님오신날)",
  "2026-06-03": "지방선거",
  "2026-06-06": "현충일",
  "2026-07-17": "제헌절",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일 (광복절)",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일 (개천절)",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",
  // 2025
  "2025-01-01": "신정",
  "2025-01-28": "설날 연휴",
  "2025-01-29": "설날",
  "2025-01-30": "설날 연휴",
  "2025-03-01": "삼일절",
  "2025-03-03": "대체공휴일",
  "2025-05-05": "어린이날 / 부처님오신날",
  "2025-05-06": "대체공휴일",
  "2025-06-06": "현충일",
  "2025-08-15": "광복절",
  "2025-10-03": "개천절",
  "2025-10-05": "추석 연휴",
  "2025-10-06": "추석",
  "2025-10-07": "추석 연휴",
  "2025-10-08": "대체공휴일",
  "2025-10-09": "한글날",
  "2025-12-25": "성탄절"
};

// Dynamic Holidays Map
let krHolidaysMap = { ...BUILTIN_KR_HOLIDAYS };

// App State
let trackedEmployees = [];
let todayDateStr = new Date().toISOString().split('T')[0];
let selectedDate = '2026-09-01';
let calendarViewDate = new Date(2026, 8, 1);

let rawApiResponse = null;
let filteredLogs = [];
let employeeSummaries = [];
let selectedEmpFilter = null; // Filter detailed table by cardId
let searchQuery = '';
let currentTheme = 'light';

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadTrackedEmployees();
  initDateState();
  fetchYearHolidays(calendarViewDate.getFullYear());
  renderCalendar();
  setupEventListeners();
  fetchAttendance(selectedDate);
  fetchMealMenu(selectedDate);
});

// Fetch Public Holidays for Year
async function fetchYearHolidays(year) {
  try {
    const res = await fetch(`/api/holidays?year=${year}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.holidays)) {
      data.holidays.forEach(h => {
        if (h.date) {
          krHolidaysMap[h.date] = h.localName || h.name || "공휴일";
        }
      });
      renderCalendar();
    }
  } catch (e) {
    console.warn('Holidays fetch error, using built-in holidays dataset:', e);
  }
}

// Fetch Daily Meal Menu from Proxy API (Instant direct loading with proxy fallback & caching)
async function fetchMealMenu(dateStr) {
  const container = document.getElementById('mealMenuContainer');
  const dateText = document.getElementById('mealDateText');

  if (dateText) dateText.textContent = dateStr;
  if (!container) return;

  container.innerHTML = `
    <div class="py-2 text-center text-slate-400 text-xs">
      <i class="fa-solid fa-spinner fa-spin mr-1"></i> 식단 불러오는 중...
    </div>
  `;

  try {
    const res = await fetch(`/api/meal?searchDate=${dateStr}`);
    const data = await res.json();

    const resultData = (data && data.data && Array.isArray(data.data.resultData)) ? data.data.resultData : [];

    if (resultData.length === 0) {
      container.innerHTML = `
        <div class="py-2 text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1.5">
          <span>🍽️ 등록된 식단 정보가 없습니다.</span>
        </div>
      `;
      return;
    }

    const typeNames = {
      'LUNCH': '중식 ☀️',
      'DINNER': '석식 🌙',
      'BREAKFAST': '조식 🌅'
    };

    container.innerHTML = resultData.map(meal => {
      const typeBadge = typeNames[meal.type] || meal.type || '식단';
      const contentText = meal.content || '식단 내용이 없습니다.';

      let imageMarkup = `
        <div class="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <span>🍽️ 이미지가 등록되지 않았습니다</span>
        </div>
      `;

      if (meal.imgList && Array.isArray(meal.imgList) && meal.imgList.length > 0) {
        const firstImg = meal.imgList[0];
        if (firstImg && firstImg.imgSrc) {
          const directImgUrl = `https://t.bodyfriend.co.kr${firstImg.imgSrc}`;
          const proxyImgUrl = `/api/img-proxy?url=${encodeURIComponent(directImgUrl)}`;

          // Preload image in background immediately for instant load
          const preloader = new Image();
          preloader.src = directImgUrl;

          imageMarkup = `
            <div class="mt-2 group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/60 shadow-sm bg-slate-100 dark:bg-slate-800 min-h-[160px]">
              <a href="${directImgUrl}" target="_blank" rel="noopener noreferrer" class="block relative w-full h-full">
                <img src="${directImgUrl}" 
                     referrerpolicy="no-referrer" 
                     loading="eager"
                     decoding="async"
                     alt="식단 이미지" 
                     class="w-full h-44 object-cover transition-all duration-200 group-hover:scale-105" 
                     onerror="if (!this.dataset.triedProxy) { this.dataset.triedProxy='1'; this.src='${proxyImgUrl}'; } else { this.parentElement.parentElement.innerHTML='<div class=\'py-1 text-xs text-slate-500\'>🍽️ 이미지가 등록되지 않았습니다</div>'; }">
                <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1">
                  <i class="fa-solid fa-up-right-from-square text-xs"></i> 원본 이미지 보기
                </div>
              </a>
            </div>
          `;
        }
      }

      return `
        <div class="space-y-1.5 pb-3 border-b border-slate-200/60 dark:border-slate-800/60 last:border-b-0 last:pb-0">
          <div class="flex items-center justify-between">
            <span class="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold text-[11px]">
              ${typeBadge}
            </span>
          </div>

          <p class="text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-medium">
            ${contentText}
          </p>

          ${imageMarkup}
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Meal fetch error:', err);
    container.innerHTML = `
      <div class="py-2 text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1.5">
        <span>🍽️ 식단 정보를 불러오는 중 오류가 발생했습니다.</span>
      </div>
    `;
  }
}

// Theme Management - Defaults to Light Mode
function initTheme() {
  const savedTheme = localStorage.getItem('app_theme') || 'light';
  setTheme(savedTheme);
}

function setTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('app_theme', theme);
  const html = document.documentElement;
  const themeIcon = document.getElementById('themeIcon');
  const themeText = document.getElementById('themeText');

  if (theme === 'dark') {
    html.classList.remove('light');
    html.classList.add('dark');
    themeIcon.className = 'fa-solid fa-moon text-amber-400 text-sm';
    themeText.textContent = '다크모드';
    document.body.className = 'bg-slate-900 text-slate-100 font-sans min-h-screen flex flex-col transition-colors duration-200';
  } else {
    html.classList.remove('dark');
    html.classList.add('light');
    themeIcon.className = 'fa-solid fa-sun text-amber-500 text-sm';
    themeText.textContent = '라이트모드';
    document.body.className = 'bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col transition-colors duration-200';
  }
}

// Tracked Employees Management (localStorage)
function loadTrackedEmployees() {
  const saved = localStorage.getItem('tracked_employees');
  if (saved) {
    try {
      trackedEmployees = JSON.parse(saved);
    } catch (e) {
      trackedEmployees = [...DEFAULT_EMPLOYEES];
    }
  } else {
    trackedEmployees = [...DEFAULT_EMPLOYEES];
  }
  renderTrackedEmployeesList();
}

function saveTrackedEmployees() {
  localStorage.setItem('tracked_employees', JSON.stringify(trackedEmployees));
  renderTrackedEmployeesList();
  if (rawApiResponse) {
    processAndRenderData(rawApiResponse);
  }
}

function renderTrackedEmployeesList() {
  const container = document.getElementById('trackedEmployeesList');
  const countEl = document.getElementById('trackedEmpCount');
  if (!container) return;

  if (countEl) countEl.textContent = trackedEmployees.length;

  if (trackedEmployees.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-slate-400 text-xs">
        등록된 관리 대상 직원이 없습니다.<br>상단 [+ 추가] 버튼을 눌러 추가하세요.
      </div>
    `;
    return;
  }

  container.innerHTML = trackedEmployees.map(emp => `
    <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 transition-all">
      <div>
        <span class="font-bold text-slate-900 dark:text-slate-100 text-xs">${emp.empName}</span>
        <span class="text-[10px] text-slate-500 dark:text-slate-400 ml-1">(${emp.empNo})</span>
      </div>

      <div class="flex items-center gap-1.5">
        <span class="font-mono text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 font-semibold">
          ${emp.cardId}
        </span>
        <button onclick="deleteEmployee('${emp.cardId}')" title="삭제" class="text-slate-400 hover:text-rose-500 p-0.5 transition-colors">
          <i class="fa-regular fa-trash-can text-xs"></i>
        </button>
      </div>
    </div>
  `).join('');
}

window.deleteEmployee = function(cardId) {
  const emp = trackedEmployees.find(e => e.cardId === cardId);
  if (!emp) return;

  if (confirm(`'${emp.empName}' (${emp.empNo}) 님을 관리 대상 목록에서 삭제하시겠습니까?`)) {
    trackedEmployees = trackedEmployees.filter(e => e.cardId !== cardId);
    if (selectedEmpFilter === cardId) selectedEmpFilter = null;
    saveTrackedEmployees();
  }
};

// Date State Initialization
function initDateState() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  todayDateStr = `${yyyy}-${mm}-${dd}`;
  
  selectedDate = todayDateStr;
  calendarViewDate = new Date(now.getFullYear(), now.getMonth(), 1);
}

// Calendar Component Logic (Sunday Red, Saturday Blue, Holiday Red)
function renderCalendar() {
  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();

  const monthNames = ["01월", "02월", "03월", "04월", "05월", "06월", "07월", "08월", "09월", "10월", "11월", "12월"];
  document.getElementById('calendarTitle').textContent = `${year}. ${monthNames[month]}`;
  document.getElementById('calendarCurrentMonth').textContent = `${year}년 ${monthNames[month]}`;

  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day-btn empty-day';
    grid.appendChild(emptyCell);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const btn = document.createElement('div');

    let dayClass = 'calendar-day-btn';
    const dayOfWeek = new Date(year, month, d).getDay();
    const holidayName = krHolidaysMap[dateStr];

    if (dayOfWeek === 0) dayClass += ' sunday-day';     // Sunday Red
    if (dayOfWeek === 6) dayClass += ' saturday-day';   // Saturday Blue

    if (holidayName) {
      dayClass += ' holiday-day';                      // Public Holiday Red & Dot
      btn.title = `${holidayName} (${dateStr})`;
    }

    if (dateStr === todayDateStr) dayClass += ' today-day';
    if (dateStr === selectedDate) dayClass += ' selected-day';

    btn.className = dayClass;
    btn.textContent = d;

    btn.addEventListener('click', () => {
      selectedDate = dateStr;
      document.getElementById('selectedDateText').textContent = selectedDate;
      renderCalendar();
      fetchAttendance(selectedDate);
      fetchMealMenu(selectedDate);
    });

    grid.appendChild(btn);
  }
}

// Fetch Attendance API via Proxy with Full Loading Overlay
async function fetchAttendance(dateStr) {
  const loadingOverlay = document.getElementById('dashboardLoadingOverlay');
  const loadingTitle = document.getElementById('loadingOverlayTitle');
  const loadingEl = document.getElementById('loadingState');
  const emptyEl = document.getElementById('emptyState');
  const tableContainer = document.getElementById('tableContainer');
  const refreshIcon = document.getElementById('refreshIcon');

  if (loadingOverlay) {
    if (loadingTitle) loadingTitle.textContent = `[${dateStr}] 근태 데이터를 조회하고 있습니다...`;
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.classList.add('flex');
  }

  loadingEl.classList.remove('hidden');
  loadingEl.classList.add('flex');
  emptyEl.classList.add('hidden');
  emptyEl.classList.remove('flex');
  tableContainer.classList.add('hidden');
  if (refreshIcon) refreshIcon.classList.add('fa-spin');

  try {
    const response = await fetch(`/api/attendance?searchDate=${dateStr}`);
    const data = await response.json();

    if (data.success) {
      rawApiResponse = data;
      processAndRenderData(data);
    } else {
      alert(`근태 데이터를 가져오지 못했습니다: ${data.message}`);
    }
  } catch (err) {
    console.error('Fetch error:', err);
    alert('서버 연결 중 오류가 발생하였습니다.');
  } finally {
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      loadingOverlay.classList.remove('flex');
    }
    loadingEl.classList.add('hidden');
    loadingEl.classList.remove('flex');
    if (refreshIcon) refreshIcon.classList.remove('fa-spin');
  }
}

// Process raw API data against active tracked employees list
function processAndRenderData(data) {
  const rawList = data.rawList || (data.rawData && data.rawData.data) || [];

  const empMap = {};
  trackedEmployees.forEach(emp => {
    empMap[emp.cardId] = emp;
  });

  filteredLogs = [];
  rawList.forEach(item => {
    if (item && item.cardId && empMap[item.cardId]) {
      const empInfo = empMap[item.cardId];
      filteredLogs.push({
        ...item,
        empNo: empInfo.empNo,
        empName: empInfo.empName
      });
    }
  });

  filteredLogs.sort((a, b) => (a.evOccurDt || '').localeCompare(b.evOccurDt || ''));

  employeeSummaries = trackedEmployees.map(emp => {
    const empLogs = filteredLogs.filter(log => log.cardId === emp.cardId);
    const tagCount = empLogs.length;
    let firstTag = null;
    let lastTag = null;
    let primaryDevNm = '-';

    if (tagCount > 0) {
      firstTag = empLogs[0].evOccurDt;
      lastTag = empLogs[tagCount - 1].evOccurDt;
      primaryDevNm = empLogs[0].devNm || '-';
    }

    return {
      empNo: emp.empNo,
      empName: emp.empName,
      cardId: emp.cardId,
      tagCount,
      firstTag,
      lastTag,
      primaryDevNm,
      status: tagCount > 0 ? '출근' : '미태깅'
    };
  });

  renderDashboardStats(data);
  renderEmpSummaryDBTable();
  renderDetailedTable();

  // JSON Modal Content
  document.getElementById('jsonModalDate').textContent = data.searchDate;
  document.getElementById('jsonModalStats').textContent = `필터링: ${filteredLogs.length}건 / 전체: ${data.totalRawRecords || rawList.length}건`;
  document.getElementById('jsonContent').textContent = JSON.stringify(data.rawData || data, null, 2);
}

// Render Top KPI Stats
function renderDashboardStats(data) {
  const totalTracked = trackedEmployees.length;
  const attendedCount = employeeSummaries.filter(s => s.tagCount > 0).length;
  const absentCount = totalTracked - attendedCount;

  document.getElementById('kpiAttendedCount').textContent = attendedCount;
  document.getElementById('kpiAttendedTotal').textContent = `/ ${totalTracked} 명`;
  document.getElementById('kpiAttendedBar').style.width = totalTracked > 0 ? `${(attendedCount / totalTracked) * 100}%` : '0%';

  document.getElementById('kpiAbsentCount').textContent = absentCount;

  document.getElementById('kpiTotalTags').textContent = filteredLogs.length;
  document.getElementById('kpiTotalRawSub').textContent = `전체 API: ${data.totalRawRecords || 0}건 중 필터링`;

  document.getElementById('kpiRegisteredEmpCount').textContent = totalTracked;
}

// Render Employee Summary DB Table Structure
function renderEmpSummaryDBTable() {
  const tbody = document.getElementById('empSummaryTableBody');
  const clearBtn = document.getElementById('btnClearEmpSummaryFilter');

  if (selectedEmpFilter) {
    clearBtn.classList.remove('hidden');
    clearBtn.classList.add('flex');
  } else {
    clearBtn.classList.add('hidden');
    clearBtn.classList.remove('flex');
  }

  if (employeeSummaries.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-6 text-center text-slate-400">
          등록된 관리 대상 임직원이 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = employeeSummaries.map((emp, index) => {
    const isAttended = emp.tagCount > 0;
    const isSelected = selectedEmpFilter === emp.cardId;

    const firstTime = emp.firstTag ? emp.firstTag.split(' ')[1] : '-';
    const lastTime = emp.lastTag ? emp.lastTag.split(' ')[1] : '-';

    return `
      <tr onclick="toggleEmpFilter('${emp.cardId}')" 
        class="theme-table-row cursor-pointer ${isSelected ? 'summary-row-selected font-semibold' : ''}">
        <td class="py-3 px-4 text-center font-mono text-slate-400 text-xs">${index + 1}</td>
        <td class="py-3 px-4">
          <span class="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">${emp.empName}</span>
        </td>
        <td class="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">${emp.empNo}</td>
        <td class="py-3 px-4 font-mono whitespace-nowrap">
          <span class="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 font-bold text-xs">
            ${emp.cardId}
          </span>
        </td>
        <td class="py-3 px-4 text-center whitespace-nowrap">
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${
            isAttended 
              ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' 
              : 'bg-rose-100 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
          }">
            ${isAttended ? '<i class="fa-solid fa-check text-[10px]"></i>출근' : '미태깅'}
          </span>
        </td>
        <td class="py-3 px-4 font-mono whitespace-nowrap ${firstTime !== '-' ? 'text-sky-600 dark:text-sky-400 font-semibold' : 'text-slate-400'}">
          ${firstTime}
        </td>
        <td class="py-3 px-4 font-mono whitespace-nowrap ${lastTime !== '-' ? 'text-purple-600 dark:text-purple-400 font-semibold' : 'text-slate-400'}">
          ${lastTime}
        </td>
        <td class="py-3 px-4 text-center font-mono font-bold whitespace-nowrap">
          <span class="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 text-xs">${emp.tagCount}회</span>
        </td>
        <td class="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">
          ${emp.primaryDevNm}
        </td>
      </tr>
    `;
  }).join('');
}

// Toggle Employee Filter
window.toggleEmpFilter = function(cardId) {
  if (selectedEmpFilter === cardId) {
    selectedEmpFilter = null;
  } else {
    selectedEmpFilter = cardId;
  }

  const clearBtn = document.getElementById('btnClearEmpFilter');
  if (selectedEmpFilter) {
    clearBtn.classList.remove('hidden');
    clearBtn.classList.add('flex');
    const targetEmp = trackedEmployees.find(e => e.cardId === selectedEmpFilter);
    document.getElementById('tableFilterNotice').textContent = `[${targetEmp ? targetEmp.empName : selectedEmpFilter}] 님의 근태 태깅 내역 필터링 중입니다.`;
  } else {
    clearBtn.classList.add('hidden');
    clearBtn.classList.remove('flex');
    document.getElementById('tableFilterNotice').textContent = `선택된 날짜의 태깅 기록이 시간순으로 표시됩니다.`;
  }

  renderEmpSummaryDBTable();
  renderDetailedTable();
};

// Render Detailed Tag Log Table
function renderDetailedTable() {
  const tbody = document.getElementById('attendanceTableBody');
  const emptyEl = document.getElementById('emptyState');
  const tableContainer = document.getElementById('tableContainer');

  let logs = [...filteredLogs];

  if (selectedEmpFilter) {
    logs = logs.filter(log => log.cardId === selectedEmpFilter);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    logs = logs.filter(log => 
      (log.empName || '').toLowerCase().includes(q) ||
      (log.empNo || '').toLowerCase().includes(q) ||
      (log.cardId || '').includes(q) ||
      (log.devNm || '').toLowerCase().includes(q) ||
      (log.evOccurDt || '').includes(q)
    );
  }

  if (logs.length === 0) {
    tableContainer.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    emptyEl.classList.add('flex');
    return;
  }

  emptyEl.classList.add('hidden');
  emptyEl.classList.remove('flex');
  tableContainer.classList.remove('hidden');

  tbody.innerHTML = logs.map((log, index) => {
    return `
      <tr class="theme-table-row">
        <td class="py-4 px-5 text-center font-mono text-slate-400 text-xs font-semibold">${index + 1}</td>
        <td class="py-4 px-5">
          <span class="font-bold text-base text-slate-900 dark:text-white">${log.empName}</span>
        </td>
        <td class="py-4 px-5 font-mono text-slate-500 dark:text-slate-400 text-xs">${log.empNo}</td>
        <td class="py-4 px-5 font-mono">
          <span class="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 text-xs font-bold">
            ${log.cardId}
          </span>
        </td>
        <td class="py-4 px-5 font-mono font-bold text-amber-600 dark:text-amber-400 text-sm whitespace-nowrap">
          ${log.evOccurDt}
        </td>
        <td class="py-4 px-5">
          <span class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-2 w-fit whitespace-nowrap">
            <i class="fa-solid fa-door-open text-amber-500"></i>
            ${log.devNm || '-'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// Event Listeners Setup (Collapsible toggles for Calendar & Meal)
function setupEventListeners() {
  // Calendar Collapsible Toggle
  const calendarHeaderToggle = document.getElementById('calendarHeaderToggle');
  const calendarBody = document.getElementById('calendarBody');
  const calendarChevron = document.getElementById('calendarChevron');
  let isCalendarCollapsed = false;

  if (calendarHeaderToggle && calendarBody) {
    calendarHeaderToggle.addEventListener('click', () => {
      isCalendarCollapsed = !isCalendarCollapsed;
      if (isCalendarCollapsed) {
        calendarBody.classList.add('hidden');
        if (calendarChevron) calendarChevron.style.transform = 'rotate(180deg)';
      } else {
        calendarBody.classList.remove('hidden');
        if (calendarChevron) calendarChevron.style.transform = 'rotate(0deg)';
      }
    });
  }

  // Meal Card Collapsible Toggle
  const mealHeaderToggle = document.getElementById('mealHeaderToggle');
  const mealBody = document.getElementById('mealBody');
  const mealChevron = document.getElementById('mealChevron');
  let isMealCollapsed = false;

  if (mealHeaderToggle && mealBody) {
    mealHeaderToggle.addEventListener('click', () => {
      isMealCollapsed = !isMealCollapsed;
      if (isMealCollapsed) {
        mealBody.classList.add('hidden');
        if (mealChevron) mealChevron.style.transform = 'rotate(180deg)';
      } else {
        mealBody.classList.remove('hidden');
        if (mealChevron) mealChevron.style.transform = 'rotate(0deg)';
      }
    });
  }

  // Theme Toggle
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  // Today Button
  document.getElementById('btnToday').addEventListener('click', () => {
    selectedDate = todayDateStr;
    const parts = todayDateStr.split('-');
    calendarViewDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    document.getElementById('selectedDateText').textContent = selectedDate;
    fetchYearHolidays(calendarViewDate.getFullYear());
    renderCalendar();
    fetchAttendance(selectedDate);
    fetchMealMenu(selectedDate);
  });

  // Refresh Button
  document.getElementById('btnRefresh').addEventListener('click', () => {
    fetchAttendance(selectedDate);
    fetchMealMenu(selectedDate);
  });

  // Month Navigation
  document.getElementById('btnPrevMonth').addEventListener('click', () => {
    const prevYear = calendarViewDate.getFullYear();
    calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
    if (calendarViewDate.getFullYear() !== prevYear) {
      fetchYearHolidays(calendarViewDate.getFullYear());
    }
    renderCalendar();
  });

  document.getElementById('btnNextMonth').addEventListener('click', () => {
    const prevYear = calendarViewDate.getFullYear();
    calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
    if (calendarViewDate.getFullYear() !== prevYear) {
      fetchYearHolidays(calendarViewDate.getFullYear());
    }
    renderCalendar();
  });

  // Search Filter
  document.getElementById('tableSearchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderDetailedTable();
  });

  // Clear Filter Buttons
  document.getElementById('btnClearEmpFilter').addEventListener('click', () => {
    toggleEmpFilter(selectedEmpFilter);
  });
  document.getElementById('btnClearEmpSummaryFilter').addEventListener('click', () => {
    toggleEmpFilter(selectedEmpFilter);
  });

  // Add Employee Modal
  const addEmpModal = document.getElementById('addEmpModal');
  document.getElementById('btnOpenAddEmpModal').addEventListener('click', () => {
    addEmpModal.classList.remove('hidden');
  });
  document.getElementById('btnCloseAddEmpModal').addEventListener('click', () => {
    addEmpModal.classList.add('hidden');
  });
  document.getElementById('btnCancelAddEmp').addEventListener('click', () => {
    addEmpModal.classList.add('hidden');
  });

  document.getElementById('addEmpForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const empNo = document.getElementById('inputEmpNo').value.trim();
    const empName = document.getElementById('inputEmpName').value.trim();
    const cardId = document.getElementById('inputCardId').value.trim();

    if (!empNo || !empName || !cardId) {
      alert('모든 필드를 입력해 주세요.');
      return;
    }

    if (trackedEmployees.some(emp => emp.cardId === cardId)) {
      alert(`이미 등록된 카드 번호입니다: ${cardId}`);
      return;
    }

    trackedEmployees.push({ empNo, empName, cardId });
    saveTrackedEmployees();

    document.getElementById('addEmpForm').reset();
    addEmpModal.classList.add('hidden');
  });

  document.getElementById('btnResetEmployees').addEventListener('click', () => {
    if (confirm('관리 대상 목록을 초기 7인으로 복원하시겠습니까?')) {
      trackedEmployees = [...DEFAULT_EMPLOYEES];
      saveTrackedEmployees();
    }
  });

  // Raw JSON Modal
  const jsonModal = document.getElementById('jsonModal');
  document.getElementById('btnViewRawJson').addEventListener('click', () => {
    jsonModal.classList.remove('hidden');
  });
  document.getElementById('btnCloseJsonModal').addEventListener('click', () => {
    jsonModal.classList.add('hidden');
  });
  jsonModal.addEventListener('click', (e) => {
    if (e.target === jsonModal) jsonModal.classList.add('hidden');
  });

  document.getElementById('btnCopyJson').addEventListener('click', () => {
    const jsonText = document.getElementById('jsonContent').textContent;
    navigator.clipboard.writeText(jsonText).then(() => {
      alert('JSON 데이터가 클립보드에 복사되었습니다.');
    }).catch(err => {
      console.error('Copy error:', err);
    });
  });
}
