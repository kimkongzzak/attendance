const fs = require('fs');
const path = require('path');

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
    const { imageBase64, fileName } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: '이미지 데이터가 전달되지 않았습니다.' });
    }

    const ext = fileName && fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'jpg';
    const uniqueName = `gallery_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;

    return res.status(200).json({
      success: true,
      message: '사진이 갤러리에 업로드되었습니다.',
      url: imageBase64,
      fileName: uniqueName
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
