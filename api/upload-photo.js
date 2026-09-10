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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { imageBase64, fileName, photoName } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: '이미지 데이터가 전달되지 않았습니다.' });
    }

    const config = getSupabaseConfig();
    let finalUrl = imageBase64;
    let savedDbValue = imageBase64;

    // 1. Upload binary file to Supabase Storage 'gallery' bucket if configured
    if (config.isConfigured && imageBase64.startsWith('data:image/')) {
      try {
        const matches = imageBase64.match(/^data:(image\/([a-zA-Z0-9+.-]+));base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          let ext = matches[2].toLowerCase();
          if (ext === 'jpeg') ext = 'jpg';
          const base64Str = matches[3];
          const buffer = Buffer.from(base64Str, 'base64');
          const uniqueName = `gallery_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;

          const uploadUrl = `${config.url}/storage/v1/object/gallery/${uniqueName}`;
          await axios.post(uploadUrl, buffer, {
            headers: {
              'apikey': config.key,
              'Authorization': `Bearer ${config.key}`,
              'Content-Type': mimeType,
              'x-upsert': 'true'
            },
            httpsAgent
          });

          finalUrl = `${config.url}/storage/v1/object/public/gallery/${uniqueName}`;
          savedDbValue = uniqueName;
          console.log('✅ [Storage Upload Success] Saved Filename:', uniqueName, 'Public URL:', finalUrl);
        }
      } catch (storageErr) {
        console.error('⚠️ [Storage Upload Fallback] Storage Upload Error:', storageErr.response ? storageErr.response.data : storageErr.message);
      }
    }

    // 2. Insert into gallery_photos DB table storing only the relative filename
    if (config.isConfigured) {
      try {
        const insertRes = await axios.post(`${config.url}/rest/v1/gallery_photos`, {
          photo_name: photoName || fileName || '포토 갤러리 이미지',
          photo_data: savedDbValue,
          display_order: 0
        }, {
          headers: {
            'apikey': config.key,
            'Authorization': `Bearer ${config.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          httpsAgent
        });

        const newPhotoObj = insertRes.data && insertRes.data[0] ? insertRes.data[0] : null;

        return res.status(200).json({
          success: true,
          message: '사진이 갤러리에 성공적으로 업로드되었습니다.',
          url: finalUrl,
          photo: newPhotoObj
        });
      } catch (dbErr) {
        console.error('❌ [Supabase Photo Insert Error]', dbErr.response ? dbErr.response.data : dbErr.message);
        return res.status(500).json({
          success: false,
          message: 'DB 저장 에러',
          error: dbErr.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: '사진이 업로드되었습니다.',
      url: finalUrl
    });
  } catch (err) {
    console.error('[Serverless Upload Error]', err.message);
    return res.status(500).json({
      success: false,
      message: '사진 업로드 에러',
      error: err.message
    });
  }
};
