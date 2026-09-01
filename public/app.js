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

// Auth State Management (2-hour Expiration)
const AUTH_KEY = 'admin_auth_session';
const AUTH_DURATION_MS = 2 * 60 * 60 * 1000; // 2 Hours

let isAuthenticated = false;

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

// Top Unlimited Photo Carousel State & 1-by-1 Smooth Infinite Loop Logic
const MAX_PHOTO_SIZE_MB = 5;
const DEFAULT_CAROUSEL_PHOTOS = [
  '/images/dog1.jpg',
  '/images/dog2.png',
  '/images/dog3.jpg',
  '/images/dog4.jpg'
];

let carouselPhotos = [];
let currentCarouselIndex = 0;
let isCarouselAnimating = false;

function loadCarouselPhotos() {
  const saved = localStorage.getItem('user_carousel_photos');
  if (saved) {
    try {
      carouselPhotos = JSON.parse(saved);
    } catch (e) {
      carouselPhotos = [...DEFAULT_CAROUSEL_PHOTOS];
    }
  } else {
    carouselPhotos = [...DEFAULT_CAROUSEL_PHOTOS];
  }
  renderCarousel();
}

function saveCarouselPhotos() {
  try {
    localStorage.setItem('user_carousel_photos', JSON.stringify(carouselPhotos));
  } catch (err) {
    console.error('localStorage quota error:', err);
    alert('브라우저 저장 공간이 부족하여 일부 입력을 보관하지 못했습니다.');
  }
  renderCarousel();
}

function renderCarousel() {
  const track = document.getElementById('carouselTrack');
  const countBadge = document.getElementById('carouselCountBadge');
  const dotsContainer = document.getElementById('carouselDots');
  const btnPrev = document.getElementById('btnPrevCarousel');
  const btnNext = document.getElementById('btnNextCarousel');

  if (!track) return;

  const total = carouselPhotos.length;
  if (countBadge) countBadge.textContent = `${total}장`;

  if (total === 0) {
    track.innerHTML = '<div class="py-8 text-center text-xs text-slate-400 w-full">등록된 사진이 없습니다.</div>';
    return;
  }

  const isMobile = window.innerWidth < 640;
  const visibleCount = isMobile ? 2 : 4;

  if (total <= visibleCount) {
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
    track.style.width = '100%';

    track.innerHTML = carouselPhotos.map((photoUrl, idx) => `
      <div class="p-1" style="width: ${100 / visibleCount}%;">
        <div class="theme-card rounded-2xl overflow-hidden shadow-sm aspect-[4/3] group relative transition-all duration-200 hover:shadow-md">
          <img src="${photoUrl}" alt="사진 ${idx + 1}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
          <button onclick="deleteCarouselPhoto(${idx})" title="사진 삭제" class="absolute top-2.5 right-2.5 w-8 h-8 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md backdrop-blur-sm">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (btnPrev) btnPrev.classList.add('hidden');
    if (btnNext) btnNext.classList.add('hidden');
    if (dotsContainer) dotsContainer.classList.add('hidden');
    return;
  }

  if (btnPrev) btnPrev.classList.remove('hidden');
  if (btnNext) btnNext.classList.remove('hidden');

  const renderCount = visibleCount + 1;
  const itemWidthPercent = 100 / visibleCount;
  const trackWidthPercent = itemWidthPercent * renderCount;

  track.style.width = `${trackWidthPercent}%`;

  const slideItems = [];
  for (let i = 0; i < renderCount; i++) {
    const itemIndex = (currentCarouselIndex + i) % total;
    slideItems.push({ photoUrl: carouselPhotos[itemIndex], index: itemIndex });
  }

  track.innerHTML = slideItems.map(item => `
    <div class="p-1" style="width: ${100 / renderCount}%;">
      <div class="theme-card rounded-2xl overflow-hidden shadow-sm aspect-[4/3] group relative transition-all duration-200 hover:shadow-md">
        <img src="${item.photoUrl}" alt="사진 ${item.index + 1}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
        <button onclick="deleteCarouselPhoto(${item.index})" title="사진 삭제" class="absolute top-2.5 right-2.5 w-8 h-8 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md backdrop-blur-sm">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </div>
    </div>
  `).join('');

  if (dotsContainer) {
    dotsContainer.classList.remove('hidden');
    dotsContainer.classList.add('flex');
    dotsContainer.innerHTML = Array.from({ length: total }).map((_, i) => `
      <button onclick="setCarouselIndexDirect(${i})" class="h-2 rounded-full transition-all duration-200 ${
        i === (currentCarouselIndex % total)
          ? 'bg-amber-500 w-5' 
          : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 w-2'
      }"></button>
    `).join('');
  }
}

window.slideNextCarousel = function() {
  if (isCarouselAnimating) return;
  const total = carouselPhotos.length;
  const isMobile = window.innerWidth < 640;
  const visibleCount = isMobile ? 2 : 4;
  if (total <= visibleCount) return;

  isCarouselAnimating = true;
  const track = document.getElementById('carouselTrack');
  const renderCount = visibleCount + 1;
  const shiftPercent = 100 / renderCount;

  track.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)';
  track.style.transform = `translateX(-${shiftPercent}%)`;

  setTimeout(() => {
    currentCarouselIndex = (currentCarouselIndex + 1) % total;
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
    renderCarousel();
    isCarouselAnimating = false;
  }, 350);
};

window.slidePrevCarousel = function() {
  if (isCarouselAnimating) return;
  const total = carouselPhotos.length;
  const isMobile = window.innerWidth < 640;
  const visibleCount = isMobile ? 2 : 4;
  if (total <= visibleCount) return;

  isCarouselAnimating = true;
  const track = document.getElementById('carouselTrack');
  const renderCount = visibleCount + 1;
  const shiftPercent = 100 / renderCount;

  currentCarouselIndex = (currentCarouselIndex - 1 + total) % total;
  track.style.transition = 'none';
  track.style.transform = `translateX(-${shiftPercent}%)`;
  renderCarousel();

  void track.offsetWidth; // Force reflow

  track.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)';
  track.style.transform = 'translateX(0)';

  setTimeout(() => {
    isCarouselAnimating = false;
  }, 350);
};

window.setCarouselIndexDirect = function(index) {
  if (isCarouselAnimating) return;
  currentCarouselIndex = index;
  renderCarousel();
};

window.deleteCarouselPhoto = function(index) {
  if (carouselPhotos.length <= 1) {
    alert('최소 1장의 사진은 갤러리에 남아있어야 합니다.');
    return;
  }
  if (confirm(`'사진 ${index + 1}'을(를) 갤러리에서 삭제하시겠습니까?`)) {
    carouselPhotos.splice(index, 1);
    if (currentCarouselIndex >= carouselPhotos.length) {
      currentCarouselIndex = 0;
    }
    saveCarouselPhotos();
  }
};

window.resetCarouselPhotos = function() {
  if (confirm('포토 갤러리를 초기 4장으로 복원하시겠습니까?')) {
    carouselPhotos = [...DEFAULT_CAROUSEL_PHOTOS];
    currentCarouselIndex = 0;
    saveCarouselPhotos();
  }
};

window.handleCarouselUpload = function(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  const maxSizeBytes = MAX_PHOTO_SIZE_MB * 1024 * 1024;
  const oversized = files.filter(f => f.size > maxSizeBytes);

  if (oversized.length > 0) {
    alert(`⚠️ 5MB를 초과하는 파일이 ${oversized.length}건 있습니다!\n\n5MB 이하의 사진 파일만 갤러리에 추가할 수 있습니다.`);
  }

  const validFiles = files.filter(f => f.size <= maxSizeBytes);
  if (validFiles.length === 0) {
    event.target.value = '';
    return;
  }

  let processedCount = 0;
  validFiles.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const rawDataUrl = e.target.result;
      const img = new Image();
      img.onload = async function() {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

        // Upload photo to backend (saves to public/images/ & auto-commits to GitHub repository!)
        try {
          const res = await fetch('/api/upload-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: compressedDataUrl, fileName: file.name })
          });
          const uploadRes = await res.json();
          if (uploadRes.success && uploadRes.url) {
            carouselPhotos.push(uploadRes.url);
          } else {
            carouselPhotos.push(compressedDataUrl);
          }
        } catch (uploadErr) {
          console.warn('[Upload Server Warning]', uploadErr);
          carouselPhotos.push(compressedDataUrl);
        }

        processedCount++;
        if (processedCount === validFiles.length) {
          saveCarouselPhotos();
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });

  event.target.value = '';
};

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  checkAuthState();
  loadCarouselPhotos();
  loadTrackedEmployees();
  initDateState();
  fetchYearHolidays(calendarViewDate.getFullYear());
  renderCalendar();
  setupEventListeners();
  fetchAttendance(selectedDate);
  fetchMealMenu(selectedDate);
  window.addEventListener('resize', renderCarousel);
});

// Check Admin Auth State & Expiration
function checkAuthState() {
  const saved = localStorage.getItem(AUTH_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.authenticated && data.expiresAt && Date.now() < data.expiresAt) {
        isAuthenticated = true;
        updateAuthUI(true, data.expiresAt);
        return;
      }
    } catch (e) {}
  }
  isAuthenticated = false;
  updateAuthUI(false);
}

function updateAuthUI(authenticated, expiresAt = null) {
  const trackedEmpCard = document.getElementById('trackedEmpCard');
  const dashboardRightPanel = document.getElementById('dashboardRightPanel');
  const rightPanelLockOverlay = document.getElementById('rightPanelLockOverlay');

  const authBtnText = document.getElementById('authBtnText');
  const authIcon = document.getElementById('authIcon');
  const btnAuthToggle = document.getElementById('btnAuthToggle');

  if (authenticated) {
    // Unblur sensitive areas
    if (trackedEmpCard) trackedEmpCard.classList.remove('content-locked');
    if (dashboardRightPanel) dashboardRightPanel.classList.remove('content-locked');
    if (rightPanelLockOverlay) rightPanelLockOverlay.classList.add('hidden');

    if (authBtnText) authBtnText.textContent = '인증완료';
    if (authIcon) authIcon.className = 'fa-solid fa-lock-open text-sm';
    if (btnAuthToggle) {
      btnAuthToggle.className = 'px-3 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/30 whitespace-nowrap flex-shrink-0';
    }
  } else {
    // Blur sensitive areas (Only Calendar & Meal Menu remain visible)
    if (trackedEmpCard) trackedEmpCard.classList.add('content-locked');
    if (dashboardRightPanel) dashboardRightPanel.classList.add('content-locked');
    if (rightPanelLockOverlay) rightPanelLockOverlay.classList.remove('hidden');

    if (authBtnText) authBtnText.textContent = '인증하기';
    if (authIcon) authIcon.className = 'fa-solid fa-lock text-sm';
    if (btnAuthToggle) {
      btnAuthToggle.className = 'px-3 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-sm bg-amber-500 hover:bg-amber-600 text-white border border-amber-400/30 whitespace-nowrap flex-shrink-0';
    }
  }
}

function openAuthModal() {
  const modal = document.getElementById('authModal');
  const errorMsg = document.getElementById('authErrorMsg');
  const input = document.getElementById('inputAdminPassword');

  if (errorMsg) errorMsg.classList.add('hidden');
  if (input) input.value = '';
  if (modal) modal.classList.remove('hidden');
  setTimeout(() => input && input.focus(), 100);
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.add('hidden');
}

window.openAuthModal = openAuthModal;

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

window.handleMealImgError = function(imgEl, proxyUrl) {
  if (!imgEl.dataset.triedProxy) {
    imgEl.dataset.triedProxy = '1';
    imgEl.src = proxyUrl;
  } else {
    const parentContainer = imgEl.closest('.group');
    if (parentContainer) {
      parentContainer.outerHTML = `
        <div class="mt-2 aspect-[4/3] w-full rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700/60 flex flex-col items-center justify-center text-center p-4 transition-colors">
          <span class="text-3xl mb-2 opacity-80 animate-bounce">🍽️</span>
          <span class="text-xs font-bold text-slate-600 dark:text-slate-300">이미지가 등록되지 않았습니다</span>
          <span class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">식단 텍스트 메뉴를 참고해주세요</span>
        </div>
      `;
    }
  }
};

// Fetch Daily Meal Menu from Proxy API (Beautiful 4:3 Aspect Ratio Placeholder when No Image)
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

    const noImagePlaceholder = `
      <div class="mt-2 aspect-[4/3] w-full rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700/60 flex flex-col items-center justify-center text-center p-4 transition-colors">
        <span class="text-3xl mb-2 opacity-80 animate-bounce">🍽️</span>
        <span class="text-xs font-bold text-slate-600 dark:text-slate-300">이미지가 등록되지 않았습니다</span>
        <span class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">식단 텍스트 메뉴를 참고해주세요</span>
      </div>
    `;

    if (resultData.length === 0) {
      container.innerHTML = `
        <div class="mt-2 aspect-[4/3] w-full rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700/60 flex flex-col items-center justify-center text-center p-4 transition-colors">
          <span class="text-3xl mb-2 opacity-80 animate-bounce">🍽️</span>
          <span class="text-xs font-bold text-slate-600 dark:text-slate-300">등록된 식단 정보가 없습니다</span>
          <span class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">해당 일자의 메뉴 정보가 입력되지 않았습니다</span>
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

      let imageMarkup = noImagePlaceholder;

      if (meal.imgList && Array.isArray(meal.imgList) && meal.imgList.length > 0) {
        const firstImg = meal.imgList[0];
        if (firstImg && firstImg.imgSrc) {
          const directImgUrl = `https://t.bodyfriend.co.kr${firstImg.imgSrc}`;
          const proxyImgUrl = `/api/img-proxy?url=${encodeURIComponent(directImgUrl)}`;

          // Preload image in background
          const preloader = new Image();
          preloader.src = directImgUrl;

          imageMarkup = `
            <div class="mt-2 group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/60 shadow-sm bg-slate-100 dark:bg-slate-800 aspect-[4/3] w-full">
              <a href="${directImgUrl}" target="_blank" rel="noopener noreferrer" class="block relative w-full h-full">
                <img src="${directImgUrl}" 
                     referrerpolicy="no-referrer" 
                     loading="eager"
                     decoding="async"
                     alt="식단 이미지" 
                     class="w-full h-full object-cover transition-all duration-200 group-hover:scale-105" 
                     onerror="handleMealImgError(this, '${proxyImgUrl}')">
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

// Calendar Component Logic (ALWAYS UNBLURRED & VISIBLE)
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

// Trigger Red Flash Animation & Display Error Alert Banner on empSummaryCard
function handleApiErrorUI(errorInfo) {
  const summaryCard = document.getElementById('empSummaryCard');
  const alertBanner = document.getElementById('apiErrorAlertBanner');
  const errorCode = document.getElementById('apiErrorCode');
  const errorReason = document.getElementById('apiErrorReasonText');
  const errorHint = document.getElementById('apiErrorHintText');

  if (summaryCard) {
    summaryCard.classList.remove('api-error-flash');
    void summaryCard.offsetWidth; // Trigger reflow for animation restart
    summaryCard.classList.add('api-error-flash');
    setTimeout(() => {
      summaryCard.classList.remove('api-error-flash');
    }, 2800);
  }

  const detailMsg = errorInfo.detailMsg || errorInfo.error || errorInfo.message || '근태 API 수신 중 오류가 발생하였습니다.';
  const hintMsg = errorInfo.hint || '.env 파일에 ATTENDANCE_API_CODE 및 ATTENDANCE_API_KEY 환경변수 설정을 확인하세요.';

  if (alertBanner) {
    if (errorCode) errorCode.textContent = `HTTP ${errorInfo.status || 500} ${errorInfo.statusText || 'ERROR'}`;
    if (errorReason) errorReason.textContent = detailMsg;
    if (errorHint) errorHint.textContent = `힌트: ${hintMsg}`;

    alertBanner.classList.remove('hidden');
    alertBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Pop up explicit browser alert dialog
  alert(`⚠️ [근태 API 연동 실패 (HTTP ${errorInfo.status || 500})]\n\n- 상세 사유: ${detailMsg}\n- 힌트: ${hintMsg}`);
}

function clearApiErrorUI() {
  const alertBanner = document.getElementById('apiErrorAlertBanner');
  if (alertBanner) alertBanner.classList.add('hidden');
}

// Fetch Attendance API via Proxy with Full Loading Overlay & Failure Visual Feedback
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

  clearApiErrorUI();

  try {
    const response = await fetch(`/api/attendance?searchDate=${dateStr}`);
    const data = await response.json();

    if (response.ok && data.success) {
      rawApiResponse = data;
      processAndRenderData(data);
    } else {
      handleApiErrorUI(data);
    }
  } catch (err) {
    console.error('Fetch error:', err);
    handleApiErrorUI({
      status: 500,
      statusText: 'FETCH_ERROR',
      message: '서버 통신 실패',
      error: err.message,
      detailMsg: '로컬 서버(node server.js)가 실행 중인지, 네트워크 상태가 정상인지 확인해주세요.',
      hint: '로컬 환경(.env)에 ATTENDANCE_API_CODE 및 ATTENDANCE_API_KEY가 설정되었는지 점검해보세요.'
    });
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
}

// Render Top KPI Stats (Safe Null Checks for Gallery Replacements)
function renderDashboardStats(data) {
  const totalTracked = trackedEmployees.length;
  const attendedCount = employeeSummaries.filter(s => s.tagCount > 0).length;
  const absentCount = totalTracked - attendedCount;

  const kpiAttendedCount = document.getElementById('kpiAttendedCount');
  if (kpiAttendedCount) kpiAttendedCount.textContent = attendedCount;

  const kpiAttendedTotal = document.getElementById('kpiAttendedTotal');
  if (kpiAttendedTotal) kpiAttendedTotal.textContent = `/ ${totalTracked} 명`;

  const kpiAttendedBar = document.getElementById('kpiAttendedBar');
  if (kpiAttendedBar) kpiAttendedBar.style.width = totalTracked > 0 ? `${(attendedCount / totalTracked) * 100}%` : '0%';

  const kpiAbsentCount = document.getElementById('kpiAbsentCount');
  if (kpiAbsentCount) kpiAbsentCount.textContent = absentCount;

  const kpiTotalTags = document.getElementById('kpiTotalTags');
  if (kpiTotalTags) kpiTotalTags.textContent = filteredLogs.length;

  const kpiTotalRawSub = document.getElementById('kpiTotalRawSub');
  if (kpiTotalRawSub) kpiTotalRawSub.textContent = `전체 API: ${data.totalRawRecords || 0}건 중 필터링`;

  const kpiRegisteredEmpCount = document.getElementById('kpiRegisteredEmpCount');
  if (kpiRegisteredEmpCount) kpiRegisteredEmpCount.textContent = totalTracked;
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
        <td class="py-3 px-4 text-center font-mono text-slate-400 text-xs whitespace-nowrap">${index + 1}</td>
        <td class="py-3 px-4 whitespace-nowrap">
          <span class="font-bold text-slate-900 dark:text-white text-xs sm:text-sm whitespace-nowrap">${emp.empName}</span>
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
  if (!isAuthenticated) {
    openAuthModal();
    return;
  }

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
        <td class="py-4 px-5 text-center font-mono text-slate-400 text-xs font-semibold whitespace-nowrap">${index + 1}</td>
        <td class="py-4 px-5 whitespace-nowrap">
          <span class="font-bold text-base text-slate-900 dark:text-white whitespace-nowrap">${log.empName}</span>
        </td>
        <td class="py-4 px-5 font-mono text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">${log.empNo}</td>
        <td class="py-4 px-5 font-mono whitespace-nowrap">
          <span class="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 text-xs font-bold whitespace-nowrap">
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

// Event Listeners Setup
function setupEventListeners() {
  // Auth Lock / Unlock Button Handler (Left of Theme Toggle)
  document.getElementById('btnAuthToggle').addEventListener('click', () => {
    if (isAuthenticated) {
      if (confirm('인증 상태를 해제하고 화면을 잠그시겠습니까?')) {
        localStorage.removeItem(AUTH_KEY);
        checkAuthState();
      }
    } else {
      openAuthModal();
    }
  });

  document.getElementById('btnCloseAuthModal').addEventListener('click', closeAuthModal);
  document.getElementById('btnCancelAuth').addEventListener('click', closeAuthModal);

  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('inputAdminPassword').value.trim();
    const errorMsg = document.getElementById('authErrorMsg');

    try {
      const res = await fetch('/api/verify-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem(AUTH_KEY, JSON.stringify({
          authenticated: true,
          expiresAt: data.expiresAt || (Date.now() + AUTH_DURATION_MS)
        }));
        checkAuthState();
        closeAuthModal();
      } else {
        if (errorMsg) {
          errorMsg.textContent = data.message || '비밀번호가 올바르지 않습니다.';
          errorMsg.classList.remove('hidden');
        }
      }
    } catch (err) {
      console.error('Auth verify error:', err);
      if (errorMsg) {
        errorMsg.textContent = '서버 연결 중 오류가 발생하였습니다.';
        errorMsg.classList.remove('hidden');
      }
    }
  });

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

  // Photo Gallery Carousel Collapsible Toggle (EXCLUSIVELY VIA CHEVRON BUTTON)
  const btnToggleCarousel = document.getElementById('btnToggleCarousel');
  const carouselHeaderContainer = document.getElementById('carouselHeaderContainer');
  const carouselBody = document.getElementById('carouselBody');
  const carouselChevron = document.getElementById('carouselChevron');
  let isCarouselCollapsed = false;

  if (btnToggleCarousel && carouselBody) {
    btnToggleCarousel.addEventListener('click', (e) => {
      e.stopPropagation();
      isCarouselCollapsed = !isCarouselCollapsed;
      if (isCarouselCollapsed) {
        carouselBody.classList.add('hidden');
        if (carouselChevron) carouselChevron.style.transform = 'rotate(180deg)';
        if (carouselHeaderContainer) carouselHeaderContainer.classList.remove('mb-3');
      } else {
        carouselBody.classList.remove('hidden');
        if (carouselChevron) carouselChevron.style.transform = 'rotate(0deg)';
        if (carouselHeaderContainer) carouselHeaderContainer.classList.add('mb-3');
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
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
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
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    if (confirm('관리 대상 목록을 초기 7인으로 복원하시겠습니까?')) {
      trackedEmployees = [...DEFAULT_EMPLOYEES];
      saveTrackedEmployees();
    }
  });

  // Check auth session every 1 minute for automatic 2-hour expiration
  setInterval(checkAuthState, 60000);
}
