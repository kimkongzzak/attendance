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
      const supabaseRes = await axios.get(`${config.url}/rest/v1/gallery_photos?select=*&order=display_order.desc,id.desc`, {
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

  // POST: Insert, Delete, or Reorder photo
  if (req.method === 'POST') {
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

    // DELETE COMMENT Action (Always soft delete by updating is_deleted=true & comment='삭제된 댓글입니다')
    if (action === 'delete_comment') {
      const commentId = req.body.comment_id || id;
      if (!commentId) {
        return res.status(400).json({ success: false, message: 'comment_id 가 필요합니다.' });
      }

      if (!config.isConfigured) {
        return res.status(200).json({ success: false, isConfigured: false, message: 'Supabase 미설정' });
      }

      try {
        const patchPayload = { comment: '삭제된 댓글입니다' };
        try {
          patchPayload.is_deleted = true;
          await axios.patch(`${config.url}/rest/v1/gallery_comments?id=eq.${commentId}`, patchPayload, {
            headers: {
              'apikey': config.key,
              'Authorization': `Bearer ${config.key}`,
              'Content-Type': 'application/json'
            },
            httpsAgent
          });
        } catch (patchErr) {
          delete patchPayload.is_deleted;
          await axios.patch(`${config.url}/rest/v1/gallery_comments?id=eq.${commentId}`, patchPayload, {
            headers: {
              'apikey': config.key,
              'Authorization': `Bearer ${config.key}`,
              'Content-Type': 'application/json'
            },
            httpsAgent
          });
        }

        return res.status(200).json({
          success: true,
          message: '댓글이 삭제 처리되었습니다.'
        });
      } catch (err) {
        console.error('[Supabase Delete Comment Error]', err.response ? err.response.data : err.message);
        return res.status(500).json({ success: false, message: '댓글 삭제 실패', error: err.message });
      }
    }

    // REORDER Action
    if (action === 'reorder') {
      const photosList = req.body.photos;
      if (!Array.isArray(photosList)) {
        return res.status(200).json({ success: false, message: 'photos 배열이 필요합니다.' });
      }

      if (!config.isConfigured) {
        return res.status(200).json({ success: false, isConfigured: false, message: 'Supabase 미설정' });
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
              console.log(`✅ [Vercel Supabase DB PATCH 성공] ID: ${item.id} -> display_order: ${newOrder}`);
            } else {
              console.error(`🚨 [Vercel Supabase DB PATCH 실패] ID: ${item.id} (0건 수정됨 - RLS UPDATE 정책 확인 필요)`);
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
        console.error('[Vercel Supabase Reorder Error]', errDetail);
        return res.status(200).json({
          success: false,
          isConfigured: true,
          message: '사진 순서 저장 실패',
          detailMsg: errDetail
        });
      }
    }

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
        console.warn('[Vercel Supabase Max Order Fetch Warning]', maxErr.message);
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
      return res.status(200).json({
        success: true,
        isConfigured: true,
        message: `Supabase DB 사진 저장 성공 (display_order: ${newDisplayOrder})`,
        photo: newPhoto
      });
    } catch (err) {
      console.error('[Vercel Supabase Insert Photo Error]', err.response ? err.response.data : err.message);
      return res.status(500).json({ success: false, isConfigured: true, message: '사진 저장 실패', error: err.message });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
};
