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
    const supabaseRes = await axios.get(`${config.url}/rest/v1/gallery_photos?select=*&order=display_order.desc,id.desc`, {
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

// POST /api/photos - Insert or Delete photo in Supabase DB
app.post('/api/photos', async (req, res) => {
  const config = getSupabaseConfig();
  const { action, id, photo_name, photo_data, display_order } = req.body || {};

  // LIKE Action (Supports RPC Atomic Increment & Delta Batching)
  if (action === 'like') {
    const targetPhotoId = id || req.body.photo_id;
    const delta = parseInt(req.body.delta || 1, 10) || 1;

    if (!targetPhotoId) {
      return res.status(400).json({ success: false, message: 'photo_id 가 필요합니다.' });
    }

    if (!config.isConfigured) {
      return res.status(200).json({ success: false, isConfigured: false, message: 'Supabase 미설정' });
    }

    try {
      let newLikes = null;

      // 1. Try Supabase RPC atomic function first (100% Concurrency Safe)
      try {
        const rpcRes = await axios.post(`${config.url}/rest/v1/rpc/increment_photo_likes`, {
          p_photo_id: targetPhotoId,
          p_count: delta
        }, {
          headers: {
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`,
            'Content-Type': 'application/json'
          },
          httpsAgent
        });
        if (typeof rpcRes.data === 'number') {
          newLikes = rpcRes.data;
        }
      } catch (rpcErr) {
        // RPC fallback
      }

      // 2. Fallback to REST fetch & patch if RPC function is not created yet
      if (newLikes === null) {
        let currentLikes = 0;
        try {
          const fetchRes = await axios.get(`${config.url}/rest/v1/gallery_photos?id=eq.${targetPhotoId}&select=like_count`, {
            headers: {
              'apikey': config.key,
              'Authorization': `Bearer ${config.key}`
            },
            httpsAgent
          });
          if (fetchRes.data && fetchRes.data.length > 0 && typeof fetchRes.data[0].like_count === 'number') {
            currentLikes = fetchRes.data[0].like_count;
          }
        } catch (e) {}

        newLikes = currentLikes + delta;
        await axios.patch(`${config.url}/rest/v1/gallery_photos?id=eq.${targetPhotoId}`, {
          like_count: newLikes
        }, {
          headers: {
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          httpsAgent
        });
      }

      return res.status(200).json({
        success: true,
        photo_id: targetPhotoId,
        like_count: newLikes,
        delta: delta,
        message: '좋아요가 성공적으로 반영되었습니다.'
      });
    } catch (err) {
      console.error('[Supabase Like Photo Error]', err.response ? err.response.data : err.message);
      return res.status(500).json({ success: false, message: '좋아요 처리 실패', error: err.message });
    }
  }

  // LIKE COMMENT Action
  if (action === 'like_comment') {
    const commentId = id || req.body.comment_id;
    const delta = parseInt(req.body.delta || 1, 10) || 1;

    if (!commentId) {
      return res.status(400).json({ success: false, message: 'comment_id 가 필요합니다.' });
    }

    if (!config.isConfigured) {
      return res.status(200).json({ success: false, isConfigured: false, message: 'Supabase 미설정' });
    }

    try {
      let currentLikes = 0;
      try {
        const fetchRes = await axios.get(`${config.url}/rest/v1/gallery_comments?id=eq.${commentId}&select=like_count`, {
          headers: {
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`
          },
          httpsAgent
        });
        if (fetchRes.data && fetchRes.data.length > 0 && typeof fetchRes.data[0].like_count === 'number') {
          currentLikes = fetchRes.data[0].like_count;
        }
      } catch (e) {}

      const newLikes = currentLikes + delta;
      await axios.patch(`${config.url}/rest/v1/gallery_comments?id=eq.${commentId}`, {
        like_count: newLikes
      }, {
        headers: {
          'apikey': config.key,
          'Authorization': `Bearer ${config.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        httpsAgent
      });

      return res.status(200).json({
        success: true,
        comment_id: commentId,
        like_count: newLikes,
        delta: delta,
        message: '댓글 좋아요가 반영되었습니다.'
      });
    } catch (err) {
      console.error('[Supabase Like Comment Error]', err.response ? err.response.data : err.message);
      return res.status(500).json({ success: false, message: '댓글 좋아요 처리 실패', error: err.message });
    }
  }

  // RECENT COMMENTS Action (Fetches all recent comments for Live Comments card)
  if (action === 'recent_comments') {
    if (!config.isConfigured) {
      return res.status(200).json({ success: false, isConfigured: false, comments: [] });
    }

    try {
      const commentsRes = await axios.get(`${config.url}/rest/v1/gallery_comments?select=*&order=created_at.desc&limit=100`, {
        headers: {
          'apikey': config.key,
          'Authorization': `Bearer ${config.key}`
        },
        httpsAgent
      });

      return res.status(200).json({
        success: true,
        comments: commentsRes.data || []
      });
    } catch (err) {
      console.error('[Supabase Recent Comments Error]', err.response ? err.response.data : err.message);
      return res.status(200).json({ success: false, comments: [], error: err.message });
    }
  }

  // GET COMMENTS Action
  if (action === 'get_comments') {
    const targetPhotoId = id || req.body.photo_id;
    if (!targetPhotoId) {
      return res.status(400).json({ success: false, message: 'photo_id 가 필요합니다.' });
    }

    if (!config.isConfigured) {
      return res.status(200).json({ success: false, isConfigured: false, comments: [] });
    }

    try {
      const commentsRes = await axios.get(`${config.url}/rest/v1/gallery_comments?photo_id=eq.${targetPhotoId}&order=created_at.asc`, {
        headers: {
          'apikey': config.key,
          'Authorization': `Bearer ${config.key}`
        },
        httpsAgent
      });

      return res.status(200).json({
        success: true,
        comments: commentsRes.data || []
      });
    } catch (err) {
      console.error('[Supabase Get Comments Error]', err.response ? err.response.data : err.message);
      return res.status(200).json({ success: false, comments: [], error: err.message });
    }
  }

  // ADD COMMENT Action (Supports parent_id for nested child comments/replies)
  if (action === 'add_comment') {
    const targetPhotoId = id || req.body.photo_id;
    const { writer, comment, parent_id } = req.body || {};

    if (!targetPhotoId || !comment) {
      return res.status(400).json({ success: false, message: 'photo_id 및 comment 내용이 필요합니다.' });
    }

    if (!config.isConfigured) {
      return res.status(200).json({ success: false, isConfigured: false, message: 'Supabase 미설정' });
    }

    try {
      const payload = {
        photo_id: targetPhotoId,
        writer: writer || '익명 강아지',
        comment: comment
      };
      if (parent_id) {
        payload.parent_id = parent_id;
      }

      const insertRes = await axios.post(`${config.url}/rest/v1/gallery_comments`, payload, {
        headers: {
          'apikey': config.key,
          'Authorization': `Bearer ${config.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        httpsAgent
      });

      const newCommentObj = insertRes.data && insertRes.data[0] ? insertRes.data[0] : insertRes.data;
      return res.status(200).json({
        success: true,
        comment: newCommentObj,
        message: '댓글이 성공적으로 등록되었습니다.'
      });
    } catch (err) {
      console.error('[Supabase Add Comment Error]', err.response ? err.response.data : err.message);
      return res.status(500).json({ success: false, message: '댓글 등록 실패', error: err.message });
    }
  }

  // DELETE COMMENT Action
  if (action === 'delete_comment') {
    const commentId = req.body.comment_id || id;
    if (!commentId) {
      return res.status(400).json({ success: false, message: 'comment_id 가 필요합니다.' });
    }

    if (!config.isConfigured) {
      return res.status(200).json({ success: false, isConfigured: false, message: 'Supabase 미설정' });
    }

    try {
      await axios.delete(`${config.url}/rest/v1/gallery_comments?id=eq.${commentId}`, {
        headers: {
          'apikey': config.key,
          'Authorization': `Bearer ${config.key}`,
          'Prefer': 'return=representation'
        },
        httpsAgent
      });

      return res.status(200).json({
        success: true,
        message: '댓글이 성공적으로 삭제되었습니다.'
      });
    } catch (err) {
      console.error('[Supabase Delete Comment Error]', err.response ? err.response.data : err.message);
      return res.status(500).json({ success: false, message: '댓글 삭제 실패', error: err.message });
    }
  }

  // Reorder Action
  if (action === 'reorder') {
    const photosList = req.body.photos;
    if (!Array.isArray(photosList)) {
      return res.status(200).json({ success: false, message: 'photos 배열이 누락되었습니다.' });
    }

    if (!config.isConfigured) {
      return res.status(200).json({ success: false, isConfigured: false, message: 'Supabase 미설정 상태입니다.' });
    }

    try {
      const startOrder = 10000;
      let updatedCount = 0;
      for (let i = 0; i < photosList.length; i++) {
        const item = photosList[i];
        if (item && item.id) {
          const newOrder = startOrder - (i * 10);
          const patchRes = await axios.patch(`${config.url}/rest/v1/gallery_photos?id=eq.${item.id}`, {
            display_order: newOrder
          }, {
            headers: {
              'apikey': config.key,
              'Authorization': `Bearer ${config.key}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            httpsAgent
          });

          if (patchRes.data && Array.isArray(patchRes.data) && patchRes.data.length > 0) {
            updatedCount += patchRes.data.length;
            console.log(`✅ [Supabase DB PATCH 성공] ID: ${item.id} -> display_order: ${newOrder}`);
          } else {
            console.error(`🚨 [Supabase DB PATCH 실패] ID: ${item.id} (0건 수정됨 - RLS UPDATE 정책 확인 필요)`);
          }
        }
      }

      if (updatedCount === 0) {
        return res.status(200).json({
          success: false,
          isConfigured: true,
          message: 'Supabase DB 사진 순서 변경 실패 (0건 수정됨)',
          detailMsg: 'Supabase DB에서 UPDATE 행이 0개 수정되었습니다. Supabase RLS UPDATE 정책을 확인해주세요.',
          hint: 'Supabase Dashboard -> Table Editor -> gallery_photos -> RLS Policies -> Enable UPDATE policy for anon/authenticated'
        });
      }

      return res.status(200).json({
        success: true,
        isConfigured: true,
        message: `사진 순서가 저장되었습니다. (총 ${updatedCount}건 DB 업데이트 완료)`
      });
    } catch (err) {
      const errDetail = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
      console.error('🚨 [Supabase Reorder Patch Error Detail]:', errDetail);
      return res.status(200).json({
        success: false,
        isConfigured: true,
        message: 'Supabase DB 사진 순서 저장 실패',
        detailMsg: errDetail
      });
    }
  }

  // Delete Action
  if (action === 'delete' || (id && !photo_data)) {
    const deleteId = id || req.body.id;
    if (!deleteId) {
      return res.status(400).json({ success: false, message: '삭제할 photo ID가 지정되지 않았습니다.' });
    }

    if (!config.isConfigured) {
      return res.json({ success: false, isConfigured: false, message: 'Supabase가 설정되지 않은 상태입니다.' });
    }

    try {
      await axios.delete(`${config.url}/rest/v1/gallery_photos?id=eq.${deleteId}`, {
        headers: {
          'apikey': config.key,
          'Authorization': `Bearer ${config.key}`
        },
        httpsAgent
      });
      return res.json({
        success: true,
        isConfigured: true,
        message: `Supabase DB에서 ID ${deleteId} 사진이 삭제되었습니다.`
      });
    } catch (err) {
      console.error('[Supabase Delete Photo Error]', err.response ? err.response.data : err.message);
      return res.status(500).json({ success: false, isConfigured: true, message: 'Supabase DB 사진 삭제에 실패했습니다.', error: err.message });
    }
  }

  // Insert Action
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
    let newDisplayOrder = 10000;
    try {
      const maxRes = await axios.get(`${config.url}/rest/v1/gallery_photos?select=display_order&order=display_order.desc&limit=1`, {
        headers: {
          'apikey': config.key,
          'Authorization': `Bearer ${config.key}`
        },
        httpsAgent
      });
      if (maxRes.data && maxRes.data.length > 0 && typeof maxRes.data[0].display_order === 'number') {
        newDisplayOrder = maxRes.data[0].display_order + 10;
      }
    } catch (maxErr) {
      console.warn('[Supabase Max Order Fetch Warning]', maxErr.message);
    }

    const supabaseRes = await axios.post(`${config.url}/rest/v1/gallery_photos`, {
      photo_name: photo_name || '포토 갤러리 이미지',
      photo_data: photo_data,
      display_order: display_order || newDisplayOrder
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
      message: `Supabase DB에 사진이 성공적으로 저장되었습니다! (display_order: ${newDisplayOrder})`,
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
