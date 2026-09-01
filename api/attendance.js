const axios = require('axios');

const DEFAULT_TARGET_EMPLOYEES = [
  { empNo: 'BF202306014', empName: '서보연', cardId: '1814' },
  { empNo: 'BF202303018', empName: '황은별', cardId: '0548' },
  { empNo: 'BF202111029', empName: '최해리', cardId: '1247' },
  { empNo: 'BF202306015', empName: '김민성', cardId: '1813' },
  { empNo: 'BF202004002', empName: '이슬기', cardId: '1440' },
  { empNo: 'BF202110022', empName: '강정민', cardId: '0611' },
  { empNo: 'BF202306010', empName: '이유정', cardId: '0425' }
];

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const searchDate = req.query.searchDate || new Date().toISOString().split('T')[0];
    const targetUrl = `https://svc.bodyfriend.co.kr/api/attendance-or-meal?searchType=ATTENDANCE&searchDate=${searchDate}`;

    // Environment variables strictly
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

    res.status(200).json({
      success: true,
      searchDate,
      totalRawRecords: rawList.length,
      rawList,
      rawData: apiResult,
      defaultEmployees: DEFAULT_TARGET_EMPLOYEES
    });
  } catch (error) {
    console.error('[API Proxy Error]', error.message);
    res.status(500).json({
      success: false,
      message: '근태 API 호출에 실패하였습니다.',
      error: error.message
    });
  }
};
