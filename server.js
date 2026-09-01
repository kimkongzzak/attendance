require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// In-memory cache for holidays
const holidayCache = {};

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
    res.status(500).json({
      success: false,
      message: '근태 API 호출에 실패하였습니다.',
      error: error.message
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

    console.log(`[Meal API Proxy] Fetching meal menu for date: ${searchDate}`);
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

// Serve frontend for all other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Attendance Service Server running at http://localhost:${PORT}`);
  console.log(`==================================================`);
});
