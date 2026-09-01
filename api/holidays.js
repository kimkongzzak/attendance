const axios = require('axios');

const holidayCache = {};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const year = req.query.year || new Date().getFullYear();

  try {
    if (holidayCache[year]) {
      return res.status(200).json({ success: true, year, holidays: holidayCache[year] });
    }

    const targetUrl = `https://date.nager.at/api/v3/PublicHolidays/${year}/KR`;
    const response = await axios.get(targetUrl, { timeout: 5000 });
    const holidays = Array.isArray(response.data) ? response.data : [];

    holidayCache[year] = holidays;
    res.status(200).json({ success: true, year, holidays });
  } catch (error) {
    console.error('[Holidays API Error]', error.message);
    res.status(200).json({ success: false, year, holidays: [] });
  }
};
