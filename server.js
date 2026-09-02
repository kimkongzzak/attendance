require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const fs = require('fs');
const exec = require('child_process').exec;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Supabase Database Credentials & Helper Functions
function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return { url, key, isConfigured: Boolean(url && key) };
}

const https = require('https');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// GET /api/photos - Fetch all photos from Supabase DB (gallery_photos table) with full diagnostics
app.get('/api/photos', async (req, res) => {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    return res.json({
      success: false,
      isConfigured: false,
      message: 'SUPABASE_URL 또는 SUPABASE_ANON_KEY가 .env 파일에 설정되지 않았습니다.',
      hint: '.env 파일 또는 Vercel 환경변수에 SUPABASE_URL 및 SUPABASE_ANON_KEY를 추가하고 서버를 재시작하세요.',
      photos: []
    });
  }

  try {
    const supabaseRes = await axios.get(`${config.url}/rest/v1/gallery_photos?select=*&order=display_order.asc,id.asc`, {
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`
      },
      httpsAgent
    });
    return res.json({
      success: true,
      isConfigured: true,
      photos: supabaseRes.data || []
    });
  } catch (err) {
    const status = err.response ? err.response.status : 'ERR';
    const detailMsg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    console.error('[Supabase GET /api/photos Error]', detailMsg);

    return res.json({
      success: false,
      isConfigured: true,
      status: status,
      message: `Supabase DB 연동 실패 (HTTP ${status})`,
      detailMsg: detailMsg,
      hint: status === 401 ? 'ANON KEY 권한 오류 (JWT Key 불일치)' : status === 404 ? 'gallery_photos 테이블이 없음 (SQL 스크립트 실행 필요)' : 'Supabase 연결 상태 및 URL 확인 필요',
      photos: []
    });
  }
});

// POST /api/photos - Insert new photo into Supabase DB
app.post('/api/photos', async (req, res) => {
  const config = getSupabaseConfig();
  const { photo_name, photo_data, display_order } = req.body || {};

  if (!photo_data) {
    return res.status(400).json({ success: false, message: 'photo_data가 누락되었습니다.' });
  }

  if (!config.isConfigured) {
    return res.json({
      success: false,
      isConfigured: false,
      message: 'Supabase가 설정되지 않아 로컬 모드로 동작합니다.'
    });
  }

  try {
    const supabaseRes = await axios.post(`${config.url}/rest/v1/gallery_photos`, {
      photo_name: photo_name || '포토 갤러리 이미지',
      photo_data: photo_data,
      display_order: display_order || 0
    }, {
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      httpsAgent
    });

    const newPhoto = supabaseRes.data && supabaseRes.data[0] ? supabaseRes.data[0] : supabaseRes.data;
    return res.json({
      success: true,
      isConfigured: true,
      message: 'Supabase DB에 사진이 성공적으로 저장되었습니다!',
      photo: newPhoto
    });
  } catch (err) {
    console.error('[Supabase POST /api/photos Error]', err.response ? err.response.data : err.message);
    return res.status(500).json({
      success: false,
      isConfigured: true,
      message: 'Supabase DB 사진 저장에 실패했습니다.',
      error: err.message
    });
  }
});

// POST /api/photos/delete - Delete photo from Supabase DB by ID
app.post('/api/photos/delete', async (req, res) => {
  const config = getSupabaseConfig();
  const { id } = req.body || {};

  if (!id) {
    return res.status(400).json({ success: false, message: '삭제할 photo ID가 지정되지 않았습니다.' });
  }

  if (!config.isConfigured) {
    return res.json({
      success: false,
      isConfigured: false,
      message: 'Supabase가 설정되지 않은 상태입니다.'
    });
  }

  try {
    await axios.delete(`${config.url}/rest/v1/gallery_photos?id=eq.${id}`, {
      headers: {
        'apikey': config.key,
        'Authorization': `Bearer ${config.key}`
      },
      httpsAgent
    });
    return res.json({
      success: true,
      isConfigured: true,
      message: `Supabase DB에서 ID ${id} 사진이 삭제되었습니다.`
    });
  } catch (err) {
    console.error('[Supabase DELETE /api/photos/delete Error]', err.response ? err.response.data : err.message);
    return res.status(500).json({
      success: false,
      isConfigured: true,
      message: 'Supabase DB 사진 삭제에 실패했습니다.',
      error: err.message
    });
  }
});

// GitHub Repository Photo Upload Endpoint (Saves to public/images/ & Auto-commits to GitHub)
app.post('/api/upload-photo', (req, res) => {
  try {
    const { imageBase64, fileName } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: '이미지 데이터가 전달되지 않았습니다.' });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const ext = fileName && fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'jpg';
    const uniqueName = `gallery_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    const imagesDir = path.join(__dirname, 'public', 'images');

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const targetPath = path.join(imagesDir, uniqueName);
    fs.writeFileSync(targetPath, buffer);

    const publicUrl = `/images/${uniqueName}`;

    // Auto Git Commit & Push directly to GitHub remote repository!
    const gitCmd = `git add public/images/${uniqueName} && git commit -m "feat: Upload photo ${uniqueName} to GitHub repository gallery" && git push origin main`;
    exec(gitCmd, { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        console.warn('[GitHub Auto-Push Notice]', error.message);
      } else {
        console.log('[GitHub Auto-Push Success]', stdout.trim());
      }
    });

    return res.json({
      success: true,
      message: '사진이 깃허브(GitHub) 리포지토리에 저장 및 자동 푸시되었습니다!',
      url: publicUrl,
      fileName: uniqueName
    });
  } catch (err) {
    console.error('[Photo Upload Error]', err.message);
    return res.status(500).json({
      success: false,
      message: '사진 저장 실패',
      error: err.message
    });
  }
});

// Default Target Employees Fallback
const DEFAULT_TARGET_EMPLOYEES = [
  { empNo: 'BF202306014', empName: '서보연', cardId: '1814' },
  { empNo: 'BF202303018', empName: '황은별', cardId: '0548' },
  { empNo: 'BF202111029', empName: '최해리', cardId: '1247' },
  { empNo: 'BF202306015', empName: '김민성', cardId: '1813' },
  { empNo: 'BF202004002', empName: '이슬기', cardId: '1440' },
  { empNo: 'BF202110022', empName: '강정민', cardId: '0611' },
  { empNo: 'BF202306010', empName: '이유정', cardId: '0425' }
];

// In-memory cache for holidays & meal images
const holidayCache = {};
const imgCache = {};

// Attendance API Core Handler
async function handleAttendanceFetch(searchDate) {
  const targetUrl = `https://svc.bodyfriend.co.kr/api/attendance-or-meal?searchType=ATTENDANCE&searchDate=${searchDate}`;

  const apiCode = process.env.ATTENDANCE_API_CODE || process.env.CODE || process.env.code || '';
  const apiKey = process.env.ATTENDANCE_API_KEY || process.env.KEY || process.env.key || '';

  const response = await axios.get(targetUrl, {
    headers: {
      'code': apiCode,
      'key': apiKey
    },
    timeout: 10000
  });

  const apiResult = response.data;
  const rawList = (apiResult && Array.isArray(apiResult.data)) ? apiResult.data : [];

  return {
    success: true,
    searchDate,
    totalRawRecords: rawList.length,
    rawList,
    rawData: apiResult,
    defaultEmployees: DEFAULT_TARGET_EMPLOYEES
  };
}

// Attendance Proxy Endpoint
app.get('/api/attendance', async (req, res) => {
  try {
    const searchDate = req.query.searchDate || new Date().toISOString().split('T')[0];
    const result = await handleAttendanceFetch(searchDate);
    res.json(result);
  } catch (error) {
    console.error('[API Proxy Error]', error.message);
    const apiCode = process.env.ATTENDANCE_API_CODE || process.env.CODE || process.env.code || '';
    const apiKey = process.env.ATTENDANCE_API_KEY || process.env.KEY || process.env.key || '';

    const hasKeys = Boolean(apiCode && apiKey);
    const status = error.response ? error.response.status : 500;
    const statusText = error.response ? error.response.statusText : 'NETWORK_ERROR';
    const detailMsg = error.response && error.response.data ? (typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : String(error.response.data)) : error.message;

    let hint = '';
    if (!hasKeys) {
      hint = '로컬 환경에 .env 파일이 없거나 ATTENDANCE_API_CODE 및 ATTENDANCE_API_KEY 환경변수가 설정되지 않았습니다.';
    } else {
      hint = `외부 근태 API 응답 오류입니다 (HTTP ${status} ${statusText}). API 키/코드 값을 확인하세요.`;
    }

    res.status(status >= 400 && status < 600 ? status : 500).json({
      success: false,
      message: '근태 API 호출에 실패하였습니다.',
      status,
      statusText,
      error: error.message,
      detailMsg,
      hasKeys,
      hint
    });
  }
});

// Admin Authentication Verification Endpoint
app.post('/api/verify-auth', (req, res) => {
  const { password } = req.body;
  const adminKey = process.env.ADMIN_KEY || process.env.admin_key || '';

  if (!adminKey) {
    console.warn('[Auth Warning] ADMIN_KEY environment variable is not configured.');
  }

  if (password && password === adminKey) {
    const expiresAt = Date.now() + (2 * 60 * 60 * 1000); // 2 hours valid
    return res.json({
      success: true,
      message: '인증에 성공하였습니다. (2시간 유지)',
      expiresAt
    });
  } else {
    return res.status(401).json({
      success: false,
      message: '비밀번호가 올바르지 않습니다.'
    });
  }
});

// Korean Public Holidays Proxy Endpoint
app.get('/api/holidays', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    if (holidayCache[year]) {
      return res.json({ success: true, year, holidays: holidayCache[year] });
    }

    const targetUrl = `https://date.nager.at/api/v3/PublicHolidays/${year}/KR`;
    const response = await axios.get(targetUrl, { timeout: 5000 });
    const holidays = Array.isArray(response.data) ? response.data : [];

    holidayCache[year] = holidays;
    res.json({ success: true, year, holidays });
  } catch (error) {
    console.error('[Holidays API Error]', error.message);
    res.json({ success: false, year: req.query.year, holidays: [] });
  }
});

// Meal Carte List Proxy Endpoint
app.get('/api/meal', async (req, res) => {
  try {
    const searchDate = req.query.searchDate || new Date().toISOString().split('T')[0];
    const targetUrl = `https://t.bodyfriend.co.kr/restaurant/api/CarteListByDate.json?startDate=${searchDate}&endDate=${searchDate}`;

    const response = await axios.get(targetUrl, { timeout: 5000 });
    res.json({
      success: true,
      searchDate,
      data: response.data
    });
  } catch (error) {
    console.error('[Meal API Error]', error.message);
    res.json({
      success: false,
      searchDate: req.query.searchDate,
      message: '식단 데이터를 가져오지 못했습니다.',
      error: error.message
    });
  }
});

// High-performance Image Proxy Endpoint with Caching
app.get('/api/img-proxy', async (req, res) => {
  try {
    const imgUrl = req.query.url;
    if (!imgUrl) return res.status(400).send('Missing url parameter');

    if (imgCache[imgUrl]) {
      res.setHeader('Content-Type', imgCache[imgUrl].contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(imgCache[imgUrl].buffer);
    }

    const response = await axios.get(imgUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 8000
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    const buffer = Buffer.from(response.data);

    if (Object.keys(imgCache).length > 50) {
      delete imgCache[Object.keys(imgCache)[0]];
    }
    imgCache[imgUrl] = { contentType, buffer };

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  } catch (error) {
    console.error('[Image Proxy Error]', error.message);
    res.status(500).send('Image fetch failed');
  }
});

// Serve frontend for all other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Attendance Service Server running at http://localhost:${PORT}`);
  console.log(`==================================================`);
});
