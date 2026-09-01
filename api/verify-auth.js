module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { password } = req.body || {};
  const adminKey = process.env.ADMIN_KEY || process.env.admin_key || '';

  if (password && password === adminKey) {
    const expiresAt = Date.now() + (2 * 60 * 60 * 1000); // 2 hours
    return res.status(200).json({
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
};
