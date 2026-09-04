const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const imgCache = {};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const imgUrl = req.query.url;
  if (!imgUrl) return res.status(400).send('Missing url parameter');

  try {
    if (imgCache[imgUrl]) {
      res.setHeader('Content-Type', imgCache[imgUrl].contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).send(imgCache[imgUrl].buffer);
    }

    const response = await axios.get(imgUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 8000,
      httpsAgent
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    const buffer = Buffer.from(response.data);

    if (Object.keys(imgCache).length > 30) {
      delete imgCache[Object.keys(imgCache)[0]];
    }
    imgCache[imgUrl] = { contentType, buffer };

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(buffer);
  } catch (error) {
    console.error('[Image Proxy Error]', error.message);
    res.status(500).send('Image fetch failed');
  }
};
