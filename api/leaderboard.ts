import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedUser, supabaseAdmin } from './supabaseClient';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    if (!supabaseAdmin) {
      // Mock leaderboard
      return res.status(200).json([
        { id: '1', tg_id: 11111, username: 'alex_nordic', gender: 'male', score: 8.4, potential_score: 9.1, verified_camera: true },
        { id: '2', tg_id: 22222, username: 'elena_v', gender: 'female', score: 8.2, potential_score: 8.9, verified_camera: true },
        { id: '3', tg_id: 33333, username: 'mark_psl', gender: 'male', score: 7.8, potential_score: 8.5, verified_camera: true },
        { id: '4', tg_id: 44444, username: 'sofia_model', gender: 'female', score: 7.6, potential_score: 8.7, verified_camera: true },
        { id: '5', tg_id: 55555, username: 'dmitry_k', gender: 'male', score: 7.3, potential_score: 8.2, verified_camera: true }
      ]);
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('leaderboard')
        .select('*')
        .eq('verified_camera', true)
        .order('score', { ascending: false })
        .limit(50);

      if (error) throw error;
      return res.status(200).json(data || []);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const user = getAuthenticatedUser(req.headers);
    if (!user || !user.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { score, potential_score, gender, verified_camera } = req.body || {};

    // STRICT CHECK: verified_camera must be true!
    if (!verified_camera) {
      return res.status(403).json({
        error: 'В глобальный Leaderboard допускаются только сканы, сделанные через Live Camera'
      });
    }

    if (!supabaseAdmin) {
      return res.status(200).json({ success: true, mock: true });
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('leaderboard')
        .upsert(
          {
            tg_id: user.id,
            username: user.username || user.first_name || 'Anonymous',
            gender: gender || 'male',
            score: Number(score),
            potential_score: Number(potential_score),
            verified_camera: true,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'tg_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
