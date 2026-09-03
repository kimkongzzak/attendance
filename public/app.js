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

// Top Unlimited Photo Carousel State & Supabase Integration
const MAX_PHOTO_SIZE_MB = 5;
const DEFAULT_CAROUSEL_PHOTOS = [
  { id: null, url: '/images/dog1.jpg', name: '기본 강아지 1' },
  { id: null, url: '/images/dog2.png', name: '기본 강아지 2' },
  { id: null, url: '/images/dog3.jpg', name: '기본 강아지 3' },
  { id: null, url: '/images/dog4.jpg', name: '기본 강아지 4' }
];

let carouselPhotos = [];
let currentCarouselIndex = 0;
let isCarouselAnimating = false;

async function loadCarouselPhotos() {
  const dbStatusEl = document.getElementById('carouselDbStatus');

  // First try fetching from Supabase DB via /api/photos
  try {
    const res = await fetch('/api/photos');
    const data = await res.json();

    if (data.success && Array.isArray(data.photos) && data.photos.length > 0) {
      // Clear old localStorage cache to ensure only Supabase DB images are rendered
      localStorage.removeItem('user_carousel_photos');
      currentCarouselIndex = 0;

      carouselPhotos = data.photos.map(p => ({
        id: p.id,
        url: p.photo_data,
        name: p.photo_name || '포토 갤러리 이미지',
        display_order: p.display_order || 0,
        like_count: p.like_count || 0
      }));

      if (dbStatusEl) {
        dbStatusEl.textContent = '🟢';
        dbStatusEl.title = `Supabase DB 실시간 연동 완료 (${data.photos.length}장)`;
      }

      console.log('✅ [Supabase DB 로드 성공] DB 사진 수:', data.photos.length, data.photos);

      renderCarousel();
      return;
    }

    // Detailed console output for debugging Supabase connection issues
    console.error('🚨 [Supabase DB 연동 실패 사유]', {
      isConfigured: data.isConfigured,
      httpStatus: data.status || 'N/A',
      message: data.message || '데이터 없음',
      detailMsg: data.detailMsg || 'N/A',
      hint: data.hint || 'N/A',
      rawResponse: data
    });
    if (data.hint) {
      console.warn('💡 [해결 힌트]:', data.hint);
    }

    if (dbStatusEl) {
      dbStatusEl.textContent = '🔴';
      dbStatusEl.title = !data.isConfigured 
        ? 'Supabase DB 미연동 (.env 키 미설정)' 
        : `Supabase DB 오류 (HTTP ${data.status || 'ERR'})`;
    }
  } catch (err) {
    console.error('🚨 [Supabase API 통신 네트워크/서버 에러]:', err);
    if (dbStatusEl) {
      dbStatusEl.textContent = '🔴';
      dbStatusEl.title = 'Supabase API 통신 오류 (로컬 이미지 표시 중)';
    }
  }

  // Fallback to local storage or defaults if Supabase is not configured yet
  const saved = localStorage.getItem('user_carousel_photos');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      carouselPhotos = parsed.map((item, idx) => typeof item === 'string' ? { id: null, url: item, name: `사진 ${idx+1}` } : item);
    } catch (e) {
      carouselPhotos = [...DEFAULT_CAROUSEL_PHOTOS];
    }
  } else {
    carouselPhotos = [...DEFAULT_CAROUSEL_PHOTOS];
  }
  renderCarousel();
}
window.loadCarouselPhotos = loadCarouselPhotos;

function saveCarouselPhotos() {
  try {
    localStorage.setItem('user_carousel_photos', JSON.stringify(carouselPhotos));
  } catch (err) {
    console.error('localStorage quota error:', err);
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
    if (btnPrev) btnPrev.classList.add('hidden');
    if (btnNext) btnNext.classList.add('hidden');
    if (dotsContainer) dotsContainer.classList.add('hidden');
    return;
  }

  const isMobile = window.innerWidth < 640;
  const visibleCount = isMobile ? 2 : 4;

  const createSlideHtml = (photo, idx, widthPercent) => {
    const realIndex = idx % total;
    const src = typeof photo === 'string' ? photo : (photo.url || photo);
    const photoObj = carouselPhotos[realIndex] || {};
    const photoId = photoObj.id;
    const likes = typeof photoObj.like_count === 'number' ? photoObj.like_count : 0;
    const commentsCount = photoId ? allLiveComments.filter(c => String(c.photo_id) === String(photoId)).length : 0;

    return `
      <div class="p-1" style="width: ${widthPercent}%;">
        <div class="theme-card rounded-2xl overflow-hidden shadow-sm aspect-[4/3] group relative transition-all duration-200 hover:shadow-md cursor-pointer select-none" onclick="openPhotoPreviewModal(${realIndex})">
          <img src="${src}" alt="사진 ${realIndex + 1}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
          
          <!-- Overlaid White Badge: Like & Comment Stats -->
          <div class="absolute bottom-2 left-2 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-extrabold shadow-md border border-white/20 flex items-center gap-2 select-none">
            <span class="flex items-center gap-1 text-rose-400">
              <i class="fa-solid fa-heart text-[10px]"></i>
              <span>${likes}</span>
            </span>
            <span class="flex items-center gap-1 text-amber-400">
              <i class="fa-solid fa-comment text-[10px]"></i>
              <span>${commentsCount}</span>
            </span>
          </div>

          <!-- Delete Button (Only on Hover) -->
          <button onclick="event.stopPropagation(); deleteCarouselPhoto(${realIndex})" title="사진 삭제" class="absolute top-2.5 right-2.5 w-8 h-8 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md backdrop-blur-sm">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>
    `;
  };

  if (total <= visibleCount) {
    track.style.transition = 'none';
    track.style.transform = 'translate3d(0, 0, 0)';
    track.style.width = '100%';
    track.innerHTML = carouselPhotos.map((photo, idx) => createSlideHtml(photo, idx, 100 / visibleCount)).join('');

    if (btnPrev) btnPrev.classList.add('hidden');
    if (btnNext) btnNext.classList.add('hidden');
    if (dotsContainer) dotsContainer.classList.add('hidden');
    return;
  }

  if (btnPrev) btnPrev.classList.remove('hidden');
  if (btnNext) btnNext.classList.remove('hidden');

  const fullList = [...carouselPhotos, ...carouselPhotos.slice(0, visibleCount)];
  const totalItems = fullList.length;
  const itemPercent = 100 / totalItems;

  track.style.width = `${(totalItems / visibleCount) * 100}%`;
  track.innerHTML = fullList.map((photo, idx) => createSlideHtml(photo, idx, itemPercent)).join('');

  updateCarouselTrackTransform(currentCarouselIndex, true);

  if (dotsContainer) {
    dotsContainer.classList.remove('hidden');
    dotsContainer.classList.add('flex');
    const activeIndex = (currentCarouselIndex % total + total) % total;
    dotsContainer.innerHTML = Array.from({ length: total }).map((_, i) => `
      <button onclick="setCarouselIndexDirect(${i})" class="h-2 rounded-full transition-all duration-300 ${
        i === activeIndex
          ? 'bg-amber-500 w-5' 
          : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 w-2'
      }"></button>
    `).join('');
  }
}

function updateCarouselTrackTransform(index, animated = true) {
  const track = document.getElementById('carouselTrack');
  if (!track) return;

  const isMobile = window.innerWidth < 640;
  const visibleCount = isMobile ? 2 : 4;
  const itemPercent = 100 / (carouselPhotos.length + visibleCount);
  const offsetPercent = index * itemPercent;

  if (animated) {
    track.style.transition = 'transform 600ms cubic-bezier(0.25, 1, 0.5, 1)';
  } else {
    track.style.transition = 'none';
  }

  track.style.transform = `translate3d(-${offsetPercent}%, 0, 0)`;
}

window.slideNextCarousel = function() {
  if (carouselPhotos.length <= 1 || isCarouselAnimating) return;
  
  const isMobile = window.innerWidth < 640;
  const visibleCount = isMobile ? 2 : 4;
  const total = carouselPhotos.length;

  if (total <= visibleCount) return;

  isCarouselAnimating = true;
  currentCarouselIndex++;

  updateCarouselTrackTransform(currentCarouselIndex, true);

  // Update dots
  const dotsContainer = document.getElementById('carouselDots');
  if (dotsContainer) {
    const activeIndex = (currentCarouselIndex % total + total) % total;
    const dots = dotsContainer.children;
    for (let i = 0; i < dots.length; i++) {
      dots[i].className = i === activeIndex
        ? 'h-2 rounded-full transition-all duration-300 bg-amber-500 w-5'
        : 'h-2 rounded-full transition-all duration-300 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 w-2';
    }
  }

  // Seamless Wrap-around to 0 when passing last photo
  if (currentCarouselIndex >= total) {
    setTimeout(() => {
      currentCarouselIndex = 0;
      updateCarouselTrackTransform(0, false);
      isCarouselAnimating = false;
    }, 600);
  } else {
    setTimeout(() => {
      isCarouselAnimating = false;
    }, 600);
  }
};

window.slidePrevCarousel = function() {
  if (carouselPhotos.length <= 1) return;
  currentCarouselIndex = (currentCarouselIndex - 1 + carouselPhotos.length) % carouselPhotos.length;
  renderCarousel();
};

window.setCarouselIndexDirect = function(index) {
  if (index < 0 || index >= carouselPhotos.length) return;
  currentCarouselIndex = index;
  renderCarousel();
};

window.refreshCarouselView = async function() {
  const iconEl = document.getElementById('iconRefreshCarousel');
  if (iconEl) iconEl.classList.add('fa-spin');

  try {
    // 1. Re-fetch photos directly from Supabase DB via /api/photos
    await loadCarouselPhotos();

    // 2. Ensure photos are sorted with recent photos first (display_order desc, id desc)
    if (Array.isArray(carouselPhotos) && carouselPhotos.length > 0) {
      carouselPhotos.sort((a, b) => {
        const orderA = typeof a.display_order === 'number' ? a.display_order : 0;
        const orderB = typeof b.display_order === 'number' ? b.display_order : 0;
        if (orderB !== orderA) return orderB - orderA;
        return (b.id || 0) - (a.id || 0);
      });
    }

    // 3. Reset carousel index to 0 and render
    currentCarouselIndex = 0;
    renderCarousel();
  } catch (err) {
    console.error('🚨 [포토 갤러리 Supabase DB 재조회 오류]:', err);
  } finally {
    if (iconEl) {
      setTimeout(() => {
        iconEl.classList.remove('fa-spin');
      }, 500);
    }
  }
};

window.refreshMealMenu = async function() {
  const iconEl = document.getElementById('iconRefreshMealMenu');
  if (iconEl) iconEl.classList.add('fa-spin');

  try {
    // Re-fetch meal menu for selected date
    await fetchMealMenu(selectedDate);
  } catch (err) {
    console.error('🚨 [오늘의 식단 API 재조회 오류]:', err);
  } finally {
    if (iconEl) {
      setTimeout(() => {
        iconEl.classList.remove('fa-spin');
      }, 500);
    }
  }
};

window.deleteCarouselPhoto = async function(index) {
  if (carouselPhotos.length <= 1) {
    alert('최소 1장의 사진은 갤러리에 남아있어야 합니다.');
    return;
  }
  const targetPhoto = carouselPhotos[index];
  if (!targetPhoto) return;

  if (confirm(`'사진 ${index + 1}'을(를) 갤러리에서 삭제하시겠습니까?`)) {
    // If photo has Supabase DB ID, delete from Supabase DB
    if (typeof targetPhoto === 'object' && targetPhoto.id) {
      try {
        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id: targetPhoto.id })
        });
        const data = await res.json();
        if (data && data.success) {
          console.log(`✅ [Supabase DB 사진 삭제 성공] ID: ${targetPhoto.id}`);
        } else {
          console.error('🚨 [Supabase DB 사진 삭제 실패]:', data.message || '삭제 실패');
          if (data.detailMsg) console.error('📌 [상세 오류 내역]:', data.detailMsg);
          if (data.hint) console.warn('💡 [해결 힌트]:', data.hint);
          alert(`🚨 Supabase DB 사진 삭제 실패!\n\n사유: ${data.message || '오류 발생'}\n${data.detailMsg ? '상세: ' + data.detailMsg : ''}`);
        }
      } catch (err) {
        console.error('🚨 [Supabase DB 사진 삭제 네트워크 예외]:', err);
        alert(`🚨 사진 삭제 중 네트워크 오류가 발생했습니다.\n${err.message}`);
      }
    }

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

// --- 4:3 Photo Editor Crop Modal Logic ---
let pendingCropFiles = [];
let cropCurrentFileIndex = 0;
let cropperInstance = null;
const currentAspectValue = 4 / 3; // Fixed 4:3 Landscape Aspect Ratio

window.handleCarouselUpload = function(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  const maxSizeBytes = 25 * 1024 * 1024; // 25MB
  const validFiles = files.filter(f => f.size <= maxSizeBytes);
  if (validFiles.length === 0) {
    alert('25MB 이하의 이미지 파일만 업로드 가능합니다.');
    event.target.value = '';
    return;
  }

  pendingCropFiles = validFiles;
  cropCurrentFileIndex = 0;
  event.target.value = '';

  loadCropModalForCurrentFile();
};

function loadCropModalForCurrentFile() {
  if (cropCurrentFileIndex >= pendingCropFiles.length) {
    closePhotoCropModal();
    return;
  }

  const file = pendingCropFiles[cropCurrentFileIndex];
  const counterEl = document.getElementById('cropFileCounter');
  const btnCropText = document.getElementById('btnCropText');

  if (counterEl) {
    counterEl.textContent = `${cropCurrentFileIndex + 1} / ${pendingCropFiles.length}`;
  }
  if (btnCropText) {
    btnCropText.textContent = cropCurrentFileIndex < pendingCropFiles.length - 1 ? '자르기 & 다음' : '자르기 & 업로드';
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const imageEl = document.getElementById('cropTargetImage');
    if (!imageEl) return;

    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }

    imageEl.src = e.target.result;

    const modal = document.getElementById('photoCropModal');
    if (modal) modal.classList.remove('hidden');

    cropperInstance = new Cropper(imageEl, {
      aspectRatio: 4 / 3, // Fixed 4:3
      viewMode: 1,
      autoCropArea: 0.9,
      responsive: true,
      background: false,
      zoomable: true,
      rotatable: true,
      touchDragZoom: true,
      mouseWheelZoom: true,
      cropBoxMovable: true,
      cropBoxResizable: true
    });
  };
  reader.readAsDataURL(file);
}

window.rotateCropImage = function(degree) {
  if (cropperInstance) {
    cropperInstance.rotate(degree);
  }
};

window.closePhotoCropModal = function() {
  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
  pendingCropFiles = [];
  cropCurrentFileIndex = 0;

  const modal = document.getElementById('photoCropModal');
  if (modal) modal.classList.add('hidden');
};

window.applyPhotoCrop = async function() {
  if (!cropperInstance) return;

  const file = pendingCropFiles[cropCurrentFileIndex];

  const canvas = cropperInstance.getCroppedCanvas({
    width: 800,
    height: 600,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });

  if (!canvas) {
    alert('이미지 크롭 처리에 실패했습니다.');
    return;
  }

  let quality = 0.85;
  let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

  while (compressedDataUrl.length > 2500000 && quality > 0.3) {
    quality -= 0.15;
    compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  const btnApply = document.getElementById('btnApplyCrop');
  if (btnApply) btnApply.disabled = true;

  try {
    const res = await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photo_name: file ? file.name : '3:4 크롭 이미지',
        photo_data: compressedDataUrl
      })
    });
    const dbRes = await res.json();
    if (dbRes.success && dbRes.photo && dbRes.photo.id) {
      console.log('✅ [Supabase DB 3:4 사진 크롭 추가 성공]:', dbRes.message);
      const newOrder = typeof dbRes.photo.display_order === 'number' ? dbRes.photo.display_order : (Date.now() / 1000);
      carouselPhotos.unshift({
        id: dbRes.photo.id,
        url: dbRes.photo.photo_data,
        name: dbRes.photo.photo_name,
        display_order: newOrder
      });
    } else {
      console.error('🚨 [Supabase DB 3:4 사진 저장 실패]:', dbRes.message);
      const maxOrder = carouselPhotos.reduce((max, p) => Math.max(max, p.display_order || 0), 0);
      carouselPhotos.unshift({ id: null, url: compressedDataUrl, name: file ? file.name : '3:4 크롭 이미지', display_order: maxOrder + 10 });
    }
  } catch (uploadErr) {
    console.warn('[Supabase Upload Warning] Fallback to local item:', uploadErr);
    const maxOrder = carouselPhotos.reduce((max, p) => Math.max(max, p.display_order || 0), 0);
    carouselPhotos.unshift({ id: null, url: compressedDataUrl, name: file ? file.name : '3:4 크롭 이미지', display_order: maxOrder + 10 });
  } finally {
    if (btnApply) btnApply.disabled = false;
    saveCarouselPhotos();

    cropCurrentFileIndex++;
    if (cropCurrentFileIndex < pendingCropFiles.length) {
      loadCropModalForCurrentFile();
    } else {
      closePhotoCropModal();
    }
  }
};

// --- Photo Gallery Manage Modal Functions (View All, Reorder, Delete) ---
let managePhotosList = [];

window.openGalleryManageModal = function() {
  const modal = document.getElementById('galleryManageModal');
  if (!modal) return;
  managePhotosList = JSON.parse(JSON.stringify(carouselPhotos));
  renderGalleryManageList();
  modal.classList.remove('hidden');
};

window.closeGalleryManageModal = function() {
  const modal = document.getElementById('galleryManageModal');
  if (modal) modal.classList.add('hidden');
};

window.renderGalleryManageList = function() {
  const listEl = document.getElementById('galleryManageList');
  const totalTextEl = document.getElementById('galleryManageTotalText');
  if (!listEl) return;

  if (totalTextEl) {
    totalTextEl.textContent = `총 ${managePhotosList.length}장의 이미지`;
  }

  if (managePhotosList.length === 0) {
    listEl.innerHTML = `
      <div class="py-12 text-center text-slate-400">
        <i class="fa-regular fa-image text-3xl mb-2 text-slate-300 dark:text-slate-600 block"></i>
        등록된 사진이 없습니다.
      </div>
    `;
    return;
  }

  listEl.innerHTML = managePhotosList.map((photo, idx) => `
    <div class="flex items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/70 transition-all hover:border-amber-400 dark:hover:border-amber-500 shadow-sm">
      <!-- 4:3 Aspect Ratio Compact Image Frame -->
      <div class="relative flex-1 aspect-[4/3] rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 cursor-pointer group/thumb" onclick="openPhotoPreviewModal(${idx})" title="클릭하여 크게 보기">
        <img src="${photo.url}" alt="갤러리 이미지 ${idx + 1}" class="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105">
        <!-- Order Badge Overlay -->
        <span class="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-amber-400 font-extrabold text-[11px] shadow-md border border-slate-700/50">
          #${idx + 1}
        </span>
      </div>

      <!-- Action Buttons Column -->
      <div class="flex flex-col gap-1.5 flex-shrink-0">
        <button onclick="moveGalleryPhotoUp(${idx})" ${idx === 0 ? 'disabled class="opacity-25 cursor-not-allowed w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center"' : 'class="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-amber-500 hover:text-white text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center cursor-pointer shadow-sm"'} title="위로 이동">
          <i class="fa-solid fa-chevron-up text-xs"></i>
        </button>
        <button onclick="moveGalleryPhotoDown(${idx})" ${idx === managePhotosList.length - 1 ? 'disabled class="opacity-25 cursor-not-allowed w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center"' : 'class="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-amber-500 hover:text-white text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center cursor-pointer shadow-sm"'} title="아래로 이동">
          <i class="fa-solid fa-chevron-down text-xs"></i>
        </button>
        <button onclick="deleteGalleryPhotoInModal(${idx})" class="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 transition-colors flex items-center justify-center cursor-pointer shadow-sm mt-0.5" title="삭제">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </div>
    </div>
  `).join('');
};

window.moveGalleryPhotoUp = function(index) {
  if (index <= 0) return;
  const temp = managePhotosList[index];
  managePhotosList[index] = managePhotosList[index - 1];
  managePhotosList[index - 1] = temp;
  renderGalleryManageList();
};

window.moveGalleryPhotoDown = function(index) {
  if (index >= managePhotosList.length - 1) return;
  const temp = managePhotosList[index];
  managePhotosList[index] = managePhotosList[index + 1];
  managePhotosList[index + 1] = temp;
  renderGalleryManageList();
};

window.deleteGalleryPhotoInModal = async function(index) {
  if (managePhotosList.length <= 1) {
    alert('최소 1장의 사진은 갤러리에 남아있어야 합니다.');
    return;
  }
  const targetPhoto = managePhotosList[index];
  if (!targetPhoto) return;

  if (confirm(`'${targetPhoto.name || '사진 ' + (index + 1)}'을(를) 삭제하시겠습니까?`)) {
    if (typeof targetPhoto === 'object' && targetPhoto.id) {
      try {
        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', id: targetPhoto.id })
        });
        const data = await res.json();
        if (data && data.success) {
          console.log(`✅ [Supabase DB 모달 사진 삭제 성공] ID: ${targetPhoto.id}`);
        } else {
          console.error('🚨 [Supabase DB 사진 삭제 실패]:', data.message || '삭제 실패');
          if (data.detailMsg) console.error('📌 [상세 오류 내역]:', data.detailMsg);
          if (data.hint) console.warn('💡 [해결 힌트]:', data.hint);
          alert(`🚨 Supabase DB 사진 삭제 실패!\n\n사유: ${data.message || '오류 발생'}\n${data.detailMsg ? '상세: ' + data.detailMsg : ''}`);
        }
      } catch (err) {
        console.error('🚨 [Supabase DB 사진 삭제 통신 오류]:', err);
        alert(`🚨 사진 삭제 중 네트워크 오류가 발생했습니다.\n${err.message}`);
      }
    }
    managePhotosList.splice(index, 1);
    renderGalleryManageList();
  }
};

window.saveGalleryPhotoOrder = async function() {
  carouselPhotos = JSON.parse(JSON.stringify(managePhotosList));
  currentCarouselIndex = 0;

  const dbPhotos = carouselPhotos.filter(p => p && p.id);
  if (dbPhotos.length > 0) {
    try {
      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', photos: carouselPhotos.map(p => ({ id: p.id })) })
      });
      const data = await res.json();
      if (data && data.success) {
        console.log('✅ [Supabase DB 순서 저장 성공]:', data.message || '사진 순서가 정상 저장되었습니다.');
      } else {
        console.error('🚨 [Supabase DB 순서 저장 실패]:', data.message || '순서 저장 실패');
        if (data.detailMsg) console.error('📌 [상세 오류 내역]:', data.detailMsg);
        if (data.hint) console.warn('💡 [해결 힌트]:', data.hint);
        alert(`🚨 Supabase DB 사진 순서 저장 실패!\n\n사유: ${data.message || '오류 발생'}\n${data.detailMsg ? '상세: ' + data.detailMsg : ''}`);
      }
    } catch (err) {
      console.error('🚨 [Supabase DB 순서 저장 네트워크/파싱 예외 발생]:', err);
      alert(`🚨 사진 순서 저장 중 통신 오류가 발생했습니다.\n${err.message}`);
    }
  }

  saveCarouselPhotos();
  saveCarouselPhotos();
  closeGalleryManageModal();
  loadCarouselPhotos();
};

// --- Photo Fullscreen Preview Modal Logic ---
let currentPreviewIndex = 0;

window.openPhotoPreviewModal = function(index) {
  if (!Array.isArray(carouselPhotos) || carouselPhotos.length === 0) return;
  if (typeof index !== 'number' || index < 0 || index >= carouselPhotos.length) index = 0;
  
  currentPreviewIndex = index;
  updatePhotoPreviewContent();

  const modal = document.getElementById('photoPreviewModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
};

window.closePhotoPreviewModal = function() {
  const modal = document.getElementById('photoPreviewModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
};

window.previewNextPhoto = function() {
  if (!Array.isArray(carouselPhotos) || carouselPhotos.length === 0) return;
  currentPreviewIndex = (currentPreviewIndex + 1) % carouselPhotos.length;
  updatePhotoPreviewContent();
};

window.previewPrevPhoto = function() {
  if (!Array.isArray(carouselPhotos) || carouselPhotos.length === 0) return;
  currentPreviewIndex = (currentPreviewIndex - 1 + carouselPhotos.length) % carouselPhotos.length;
  updatePhotoPreviewContent();
};

function updatePhotoPreviewContent() {
  const photo = carouselPhotos[currentPreviewIndex];
  if (!photo) return;

  const src = typeof photo === 'string' ? photo : (photo.url || photo);
  const name = typeof photo === 'object' ? (photo.name || photo.photo_name || `사진 ${currentPreviewIndex + 1}`) : `사진 ${currentPreviewIndex + 1}`;

  const imgEl = document.getElementById('photoPreviewImg');
  const titleEl = document.getElementById('photoPreviewTitle');
  const counterEl = document.getElementById('photoPreviewCounter');
  const likeCountEl = document.getElementById('previewLikeCount');

  if (imgEl) imgEl.src = src;
  if (titleEl) titleEl.textContent = name;
  if (counterEl) counterEl.textContent = `#${currentPreviewIndex + 1} / ${carouselPhotos.length}`;
  if (likeCountEl) likeCountEl.textContent = typeof photo.like_count === 'number' ? photo.like_count : 0;

  // Load comments for current photo
  if (photo && photo.id) {
    fetchAndRenderPhotoComments(photo.id);
  } else {
    renderPhotoCommentsList([]);
  }
}

let likeDebounceTimers = {};
let pendingLikeDeltas = {};

window.togglePhotoLike = function() {
  const photo = carouselPhotos[currentPreviewIndex];
  if (!photo) return;

  const photoId = photo.id;

  // 1. Optimistic UI update (Instant 60fps counter tick up & heart pop animation)
  photo.like_count = (photo.like_count || 0) + 1;
  const likeCountEl = document.getElementById('previewLikeCount');
  if (likeCountEl) likeCountEl.textContent = photo.like_count;

  // Pop animation effect on heart button
  const btnLike = document.getElementById('btnPreviewLike');
  if (btnLike) {
    btnLike.classList.remove('scale-110');
    void btnLike.offsetWidth;
    btnLike.classList.add('scale-110');
    setTimeout(() => btnLike.classList.remove('scale-110'), 150);
  }

  if (!photoId) return;

  // 2. Accumulate delta for batched atomic backend sync
  pendingLikeDeltas[photoId] = (pendingLikeDeltas[photoId] || 0) + 1;

  // 3. Debounce network request (send total batch delta 400ms after last click)
  if (likeDebounceTimers[photoId]) {
    clearTimeout(likeDebounceTimers[photoId]);
  }

  likeDebounceTimers[photoId] = setTimeout(async () => {
    const deltaToSend = pendingLikeDeltas[photoId];
    delete pendingLikeDeltas[photoId];
    delete likeDebounceTimers[photoId];

    if (!deltaToSend || deltaToSend <= 0) return;

    try {
      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', photo_id: photoId, delta: deltaToSend })
      });
      const data = await res.json();
      if (data && data.success && typeof data.like_count === 'number') {
        photo.like_count = data.like_count;
        if (likeCountEl && carouselPhotos[currentPreviewIndex] && carouselPhotos[currentPreviewIndex].id === photoId) {
          likeCountEl.textContent = photo.like_count;
        }
      }
    } catch (err) {
      console.warn('🚨 [좋아요 배치 원자적 반영 에러]:', err);
    }
  }, 400);
};

async function fetchAndRenderPhotoComments(photoId) {
  const listEl = document.getElementById('previewCommentsList');
  const badgeEl = document.getElementById('previewCommentCountBadge');

  if (listEl) {
    listEl.innerHTML = `
      <div class="py-4 text-center text-slate-400 text-xs flex items-center justify-center gap-1.5">
        <i class="fa-solid fa-spinner fa-spin"></i> 댓글을 불러오는 중입니다...
      </div>
    `;
  }

  try {
    const res = await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_comments', photo_id: photoId })
    });
    const data = await res.json();
    const comments = (data && data.success && Array.isArray(data.comments)) ? data.comments : [];
    renderPhotoCommentsList(comments);
  } catch (err) {
    console.error('🚨 [댓글 목록 조회 에러]:', err);
    renderPhotoCommentsList([]);
  }
}

let currentPhotoComments = [];
let commentLikeDebounceTimers = {};
let pendingCommentLikeDeltas = {};

window.toggleCommentLike = function(commentId, event) {
  if (event) event.stopPropagation();
  if (!commentId) return;

  const commentObj = currentPhotoComments.find(c => String(c.id) === String(commentId));
  if (!commentObj) return;

  // 1. Optimistic UI update (Instant 60fps counter tick up)
  commentObj.like_count = (commentObj.like_count || 0) + 1;
  const countEl = document.getElementById(`commentLikeCount_${commentId}`);
  if (countEl) countEl.textContent = commentObj.like_count;

  // Pop animation effect on comment like button
  const btnEl = document.getElementById(`btnCommentLike_${commentId}`);
  if (btnEl) {
    btnEl.classList.remove('scale-110');
    void btnEl.offsetWidth;
    btnEl.classList.add('scale-110');
    setTimeout(() => btnEl.classList.remove('scale-110'), 150);
  }

  // 2. Accumulate delta for batched atomic backend sync
  pendingCommentLikeDeltas[commentId] = (pendingCommentLikeDeltas[commentId] || 0) + 1;

  // 3. Debounce network request (send total batch delta 400ms after last click)
  if (commentLikeDebounceTimers[commentId]) {
    clearTimeout(commentLikeDebounceTimers[commentId]);
  }

  commentLikeDebounceTimers[commentId] = setTimeout(async () => {
    const deltaToSend = pendingCommentLikeDeltas[commentId];
    delete pendingCommentLikeDeltas[commentId];
    delete commentLikeDebounceTimers[commentId];

    if (!deltaToSend || deltaToSend <= 0) return;

    try {
      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like_comment', comment_id: commentId, delta: deltaToSend })
      });
      const data = await res.json();
      if (data && data.success && typeof data.like_count === 'number') {
        commentObj.like_count = data.like_count;
        if (countEl) countEl.textContent = commentObj.like_count;
      }
    } catch (err) {
      console.warn('🚨 [댓글 좋아요 배치 원자적 반영 에러]:', err);
    }
  }, 400);
};

let activeReplyParentId = null;

window.setReplyTarget = function(commentId, writerName, event) {
  if (event) event.stopPropagation();
  activeReplyParentId = commentId;

  const badge = document.getElementById('replyTargetBadge');
  const targetName = document.getElementById('replyTargetName');
  const textInput = document.getElementById('commentTextInput');

  if (targetName) targetName.textContent = `@${writerName} 님에게 답글 작성 중...`;
  if (badge) {
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  }
  if (textInput) {
    textInput.focus();
    textInput.placeholder = `@${writerName} 님에게 답글 남기는 중... 🐶`;
  }
};

window.cancelReplyTarget = function() {
  activeReplyParentId = null;

  const badge = document.getElementById('replyTargetBadge');
  const textInput = document.getElementById('commentTextInput');

  if (badge) {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
  }
  if (textInput) {
    textInput.placeholder = '댓글을 입력하세요... 🐶';
  }
};

function renderPhotoCommentsList(comments) {
  currentPhotoComments = Array.isArray(comments) ? comments : [];
  const listEl = document.getElementById('previewCommentsList');
  const badgeEl = document.getElementById('previewCommentCountBadge');

  if (badgeEl) badgeEl.textContent = currentPhotoComments.length;
  if (!listEl) return;

  if (currentPhotoComments.length === 0) {
    listEl.innerHTML = `
      <div class="py-4 text-center text-slate-400 text-xs">
        💬 등록된 댓글이 없습니다. 첫 번째 댓글을 남겨보세요! 🐶
      </div>
    `;
    return;
  }

  // 1. Sort chronological ASC
  const sorted = [...currentPhotoComments].sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    return timeA - timeB;
  });

  // 2. Group into parent-child hierarchy
  const commentMap = {};
  const rootComments = [];
  const itemsToRender = [];

  sorted.forEach(c => {
    c.children = [];
    commentMap[c.id] = c;
  });

  sorted.forEach(c => {
    if (c.parent_id && commentMap[c.parent_id]) {
      commentMap[c.parent_id].children.push(c);
    } else {
      rootComments.push(c);
    }
  });

  // Flatten tree into depth order
  function flattenNode(node, depth = 0) {
    node.depth = depth;
    itemsToRender.push(node);
    if (Array.isArray(node.children)) {
      node.children.forEach(child => flattenNode(child, depth + 1));
    }
  }

  rootComments.forEach(r => flattenNode(r, 0));

  listEl.innerHTML = itemsToRender.map(c => {
    const isChild = c.depth > 0;
    const depthIndentClass = isChild 
      ? 'ml-3 sm:ml-5 pl-2 sm:pl-3 border-l-2 border-amber-400/60 dark:border-amber-500/50' 
      : '';

    return `
      <div class="flex items-start justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-amber-400/50 transition-colors ${depthIndentClass}">
        
        <!-- Column 1: Author Badge (Top-Aligned) -->
        <span class="w-20 sm:w-24 font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1 text-[11px] truncate flex-shrink-0 self-start pt-0.5">
          ${isChild ? '<i class="fa-solid fa-reply rotate-180 text-[10px] text-amber-500 flex-shrink-0"></i>' : '<i class="fa-solid fa-paw text-[9px] flex-shrink-0"></i>'}
          <span class="truncate">${escapeHtml(c.writer || '익명 강아지')}</span>
        </span>

        <!-- Column 2: Comment Content (Full Multi-line Wrapped Text) -->
        <div class="flex-1 text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed break-words px-1" title="${escapeHtml(c.comment)}">
          ${escapeHtml(c.comment)}
        </div>

        <!-- Column 3: Actions & Timestamp (Top-Aligned) -->
        <div class="flex items-center gap-1.5 flex-shrink-0 self-start pt-0.5">
          <button onclick="setReplyTarget(${c.id}, '${escapeHtml(c.writer || '익명 강아지')}', event)" title="답글 달기" class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/70 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-slate-500 hover:text-amber-600 dark:text-slate-300 text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap">
            <i class="fa-regular fa-comment-dots text-[10px]"></i> 답글
          </button>

          <button id="btnCommentLike_${c.id}" onclick="toggleCommentLike(${c.id}, event)" title="댓글 좋아요" class="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-500 text-[10px] font-bold border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer active:scale-95 whitespace-nowrap">
            <i class="fa-solid fa-heart text-[9px]"></i>
            <span id="commentLikeCount_${c.id}">${c.like_count || 0}</span>
          </button>

          <span class="w-14 sm:w-20 text-[10px] text-slate-400 font-mono text-right hidden sm:inline whitespace-nowrap">
            ${formatCommentDate(c.created_at)}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

window.submitPhotoComment = async function(event) {
  event.preventDefault();
  const photo = carouselPhotos[currentPreviewIndex];
  if (!photo) return;

  const writerInput = document.getElementById('commentWriterInput');
  const textInput = document.getElementById('commentTextInput');
  const btnSubmit = document.getElementById('btnSubmitComment');

  const writer = writerInput ? writerInput.value.trim() : '';
  const comment = textInput ? textInput.value.trim() : '';

  if (!comment) {
    alert('댓글 내용을 입력해주세요.');
    return;
  }

  if (btnSubmit) btnSubmit.disabled = true;

  try {
    if (photo.id) {
      const payload = {
        action: 'add_comment',
        photo_id: photo.id,
        writer: writer || '익명 강아지',
        comment: comment
      };
      if (activeReplyParentId) {
        payload.parent_id = activeReplyParentId;
      }

      const res = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data && data.success) {
        if (textInput) textInput.value = '';
        cancelReplyTarget();
        fetchAndRenderPhotoComments(photo.id);
        loadLiveComments();
      } else {
        alert(`🚨 댓글 등록 실패: ${data.message || '오류 발생'}`);
      }
    } else {
      alert('Supabase DB에 등록된 사진에만 댓글을 저장할 수 있습니다.');
    }
  } catch (err) {
    console.error('🚨 [댓글 등록 예외]:', err);
    alert('댓글 등록 중 오류가 발생했습니다.');
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
  }
};

// Live Comments Section Logic
let allLiveComments = [];
let liveCommentsVisibleLimit = 10;

async function loadLiveComments() {
  const container = document.getElementById('liveCommentsContainer');
  try {
    const res = await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'recent_comments' })
    });
    const data = await res.json();
    if (data && data.success && Array.isArray(data.comments)) {
      allLiveComments = data.comments;
    } else {
      allLiveComments = [];
    }
  } catch (err) {
    console.error('🚨 [실시간 댓글 로드 에러]:', err);
    allLiveComments = [];
  }
  renderLiveCommentsList();
}

window.openPhotoPreviewByPhotoId = function(photoId) {
  if (!photoId || !Array.isArray(carouselPhotos)) return;
  const idx = carouselPhotos.findIndex(p => String(p.id) === String(photoId));
  if (idx !== -1) {
    openPhotoPreviewModal(idx);
  } else {
    openPhotoPreviewModal(0);
  }
};

function renderLiveCommentsList() {
  const container = document.getElementById('liveCommentsContainer');
  const btnLoadMoreWrapper = document.getElementById('liveCommentsLoadMoreWrapper');
  if (!container) return;

  if (allLiveComments.length === 0) {
    container.innerHTML = `
      <div class="py-4 text-center text-slate-400 text-xs">
        💬 등록된 댓글이 없습니다.
      </div>
    `;
    if (btnLoadMoreWrapper) btnLoadMoreWrapper.classList.add('hidden');
    return;
  }

  const visibleList = allLiveComments.slice(0, liveCommentsVisibleLimit);

  container.innerHTML = visibleList.map(c => `
    <div onclick="openPhotoPreviewByPhotoId(${c.photo_id})" class="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 shadow-2xs hover:border-amber-400/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-all text-xs cursor-pointer group">
      <span class="w-16 sm:w-20 font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1 text-[11px] truncate flex-shrink-0">
        <i class="fa-solid fa-paw text-[9px]"></i>
        <span class="truncate">${escapeHtml(c.writer || '익명 강아지')}</span>
      </span>

      <span class="flex-1 text-xs text-slate-800 dark:text-slate-200 font-medium truncate px-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" title="${escapeHtml(c.comment)}">
        ${escapeHtml(c.comment)}
      </span>

      <span class="w-16 sm:w-20 text-[10px] text-slate-400 font-mono text-right flex-shrink-0">
        ${formatCommentDate(c.created_at)}
      </span>
    </div>
  `).join('');

  if (btnLoadMoreWrapper) {
    if (liveCommentsVisibleLimit >= allLiveComments.length) {
      btnLoadMoreWrapper.classList.add('hidden');
    } else {
      btnLoadMoreWrapper.classList.remove('hidden');
    }
  }
}

window.loadMoreLiveComments = function() {
  liveCommentsVisibleLimit += 5;
  renderLiveCommentsList();
};

window.refreshLiveComments = async function() {
  const icon = document.getElementById('iconRefreshLiveComments');
  if (icon) icon.classList.add('fa-spin');
  liveCommentsVisibleLimit = 10;
  await loadLiveComments();
  setTimeout(() => {
    if (icon) icon.classList.remove('fa-spin');
  }, 400);
};

function formatCommentDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Global Keyboard Handler for Photo Preview (Only Escape key closes modal; Arrow keys photo navigation disabled)
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('photoPreviewModal');
  if (!modal || modal.classList.contains('hidden')) return;

  if (e.key === 'Escape') {
    closePhotoPreviewModal();
  }
});

// --- Carousel Auto-Play Logic (2.5-Second Smooth Auto Slide) ---
let carouselAutoPlayInterval = null;
let isCarouselHovered = false;

function startCarouselAutoPlay() {
  stopCarouselAutoPlay();
  carouselAutoPlayInterval = setInterval(() => {
    const previewModal = document.getElementById('photoPreviewModal');
    const manageModal = document.getElementById('galleryManageModal');
    const isPreviewOpen = previewModal && !previewModal.classList.contains('hidden');
    const isManageOpen = manageModal && !manageModal.classList.contains('hidden');

    if (!isCarouselHovered && !isPreviewOpen && !isManageOpen && carouselPhotos.length > 1) {
      slideNextCarousel();
    }
  }, 2500);
}

function stopCarouselAutoPlay() {
  if (carouselAutoPlayInterval) {
    clearInterval(carouselAutoPlayInterval);
    carouselAutoPlayInterval = null;
  }
}

function setupCarouselAutoPlayListeners() {
  const container = document.getElementById('photoCarouselContainer');
  if (container) {
    container.addEventListener('mouseenter', () => {
      isCarouselHovered = true;
    });
    container.addEventListener('mouseleave', () => {
      isCarouselHovered = false;
    });
  }
  startCarouselAutoPlay();
}

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
  loadLiveComments();
  setupCarouselAutoPlayListeners();
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

    if (authBtnText) authBtnText.textContent = '';
    if (authIcon) authIcon.className = 'fa-solid fa-lock-open text-sm';
    if (btnAuthToggle) {
      btnAuthToggle.title = '관리자 인증 완료 (클릭 시 로그아웃/잠금)';
      btnAuthToggle.className = 'px-3 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/30 whitespace-nowrap flex-shrink-0 cursor-pointer';
    }
  } else {
    // Blur sensitive areas (Only Calendar & Meal Menu remain visible)
    if (trackedEmpCard) trackedEmpCard.classList.add('content-locked');
    if (dashboardRightPanel) dashboardRightPanel.classList.add('content-locked');
    if (rightPanelLockOverlay) rightPanelLockOverlay.classList.remove('hidden');

    if (authBtnText) authBtnText.textContent = '';
    if (authIcon) authIcon.className = 'fa-solid fa-lock text-sm';
    if (btnAuthToggle) {
      btnAuthToggle.title = '관리자 비밀번호 인증하기';
      btnAuthToggle.className = 'px-3 py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm bg-amber-500 hover:bg-amber-600 text-white border border-amber-400/30 whitespace-nowrap flex-shrink-0 cursor-pointer';
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

window.openTrackedEmpModal = function() {
  const modal = document.getElementById('trackedEmpModal');
  if (modal) {
    modal.classList.remove('hidden');
    renderTrackedEmployeesList();
  }
};

window.closeTrackedEmpModal = function() {
  const modal = document.getElementById('trackedEmpModal');
  if (modal) {
    modal.classList.add('hidden');
  }
};

function renderTrackedEmployeesList() {
  const container = document.getElementById('trackedEmployeesList');
  const countEl = document.getElementById('trackedEmpCount');
  const summaryBadgeEl = document.getElementById('empSummaryTrackedBadge');
  if (!container) return;

  if (countEl) countEl.textContent = trackedEmployees.length;
  if (summaryBadgeEl) summaryBadgeEl.textContent = trackedEmployees.length;

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

// Date State Initialization (Defaults to Today in UI & Logic)
function initDateState() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  todayDateStr = `${yyyy}-${mm}-${dd}`;
  
  selectedDate = todayDateStr;
  calendarViewDate = new Date(now.getFullYear(), now.getMonth(), 1);

  // Set initial text elements to today's date dynamically
  const selectedDateText = document.getElementById('selectedDateText');
  const mealDateText = document.getElementById('mealDateText');
  if (selectedDateText) selectedDateText.textContent = selectedDate;
  if (mealDateText) mealDateText.textContent = selectedDate;
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
          등록된 우리 편이 없습니다.
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
    document.getElementById('tableFilterNotice').textContent = `[${targetEmp ? targetEmp.empName : selectedEmpFilter}] 님의 태깅 현황 구경 중`;
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
