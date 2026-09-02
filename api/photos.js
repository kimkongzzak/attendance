const axios = require('axios');
const https = require('https');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return { url, key, isConfigured: Boolean(url && key) };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const config = getSupabaseConfig();

  // GET: Fetch all photos from Supabase with full diagnostics
  if (req.method === 'GET') {
    if (!config.isConfigured) {
      return res.status(200).json({
        success: false,
        isConfigured: false,
        message: 'SUPABASE_URL 또는 SUPABASE_ANON_KEY가 설정되지 않았습니다.',
        hint: '.env 파일 또는 Vercel 환경변수에 SUPABASE_URL 및 SUPABASE_ANON_KEY를 등록해주세요.',
        photos: []
      });
    }

    try {
      const supabaseRes = await axios.get(`${config.url}/rest/v1/gallery_photos?select=*&order=id.desc`, {
        headers: {
          'apikey': config.key,
          'Authorization': `Bearer ${config.key}`
        },
        httpsAgent
      });
      return res.status(200).json({
        success: true,
        isConfigured: true,
        photos: supabaseRes.data || []
      });
    } catch (err) {
      const status = err.response ? err.response.status : 'ERR';
      const detailMsg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
      console.error('[Vercel Supabase GET Photos Error]', detailMsg);

      return res.status(200).json({
        success: false,
        isConfigured: true,
        status: status,
        message: `Supabase DB 연동 실패 (HTTP ${status})`,
        detailMsg: detailMsg,
        hint: status === 401 ? 'ANON KEY 권한 오류 (JWT Key 불일치)' : status === 404 ? 'gallery_photos 테이블이 없음 (SQL 스크립트 실행 필요)' : 'Supabase 연결 상태 및 URL 확인 필요',
        photos: []
      });
    }
  }

  // POST: Insert or Delete photo
  if (req.method === 'POST') {
    const { action, id, photo_name, photo_data, display_order } = req.body || {};

    // DELETE Action
    if (action === 'delete' || id) {
      const deleteId = id || req.body.id;
      if (!deleteId) {
        return res.status(400).json({ success: false, message: '삭제할 photo ID가 필요합니다.' });
      }

      if (!config.isConfigured) {
        return res.status(200).json({ success: false, isConfigured: false, message: 'Supabase 미설정' });
      }

      try {
        await axios.delete(`${config.url}/rest/v1/gallery_photos?id=eq.${deleteId}`, {
          headers: {
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`
          },
          httpsAgent
        });
        return res.status(200).json({
          success: true,
          isConfigured: true,
          message: `ID ${deleteId} 사진이 삭제되었습니다.`
        });
      } catch (err) {
        console.error('[Vercel Supabase Delete Photo Error]', err.response ? err.response.data : err.message);
        return res.status(500).json({ success: false, isConfigured: true, message: '사진 삭제 실패', error: err.message });
      }
    }

    // INSERT Action
    if (!photo_data) {
      return res.status(400).json({ success: false, message: 'photo_data가 누락되었습니다.' });
    }

    if (!config.isConfigured) {
      return res.status(200).json({ success: false, isConfigured: false, message: 'Supabase 미설정' });
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
      return res.status(200).json({
        success: true,
        isConfigured: true,
        message: 'Supabase DB 사진 추가 성공',
        photo: newPhoto
      });
    } catch (err) {
      console.error('[Vercel Supabase Insert Photo Error]', err.response ? err.response.data : err.message);
      return res.status(500).json({ success: false, isConfigured: true, message: '사진 저장 실패', error: err.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
};
