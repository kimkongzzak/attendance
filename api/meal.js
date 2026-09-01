const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const searchDate = req.query.searchDate || new Date().toISOString().split('T')[0];
  const targetUrl = `https://t.bodyfriend.co.kr/restaurant/api/CarteListByDate.json?startDate=${searchDate}&endDate=${searchDate}`;

  try {
    const response = await axios.get(targetUrl, { timeout: 5000 });
    res.status(200).json({
      success: true,
      searchDate,
      data: response.data
    });
  } catch (error) {
    console.error('[Meal API Error]', error.message);
    res.status(200).json({
      success: false,
      searchDate,
      message: '식단 데이터를 가져오지 못했습니다.',
      error: error.message
    });
  }
};
