import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedUser, supabaseAdmin } from './supabaseClient';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const battleId = req.query.id as string;
    if (!battleId) {
      return res.status(400).json({ error: 'Missing battle ID' });
    }

    if (!supabaseAdmin) {
      // Mock battle
      return res.status(200).json({
        id: battleId,
        challenger_name: 'alex_nordic',
        challenger_score: 8.2,
        challenger_metrics: {
          radar: [
            { subject: 'Eye Area', value: 88, fullMark: 100 },
            { subject: 'Midface', value: 82, fullMark: 100 },
            { subject: 'Jawline', value: 85, fullMark: 100 },
            { subject: 'Symmetry', value: 92, fullMark: 100 },
            { subject: 'Skin Quality', value: 78, fullMark: 100 },
            { subject: 'Contrast', value: 80, fullMark: 100 }
          ],
          boneBase: 8.4,
          appeal: 7.9
        }
      });
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('battles')
        .select('*')
        .eq('id', battleId)
        .single();

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err: any) {
      return res.status(404).json({ error: 'Battle not found' });
    }
  }

  if (req.method === 'POST') {
    const user = getAuthenticatedUser(req.headers);
    const { battleId, name, score, metrics, isJoin } = req.body || {};

    if (!supabaseAdmin) {
      return res.status(200).json({ id: battleId || 'mock_battle_' + Date.now(), success: true });
    }

    try {
      if (isJoin && battleId) {
        // Opponent joining
        const { data, error } = await supabaseAdmin
          .from('battles')
          .update({
            opponent_tg_id: user?.id || null,
            opponent_name: name || user?.username || 'Opponent',
            opponent_score: score,
            opponent_metrics: metrics
          })
          .eq('id', battleId)
          .select()
          .single();

        if (error) throw error;
        return res.status(200).json(data);
      } else {
        // Creating new battle challenge
        const { data, error } = await supabaseAdmin
          .from('battles')
          .insert({
            challenger_tg_id: user?.id || null,
            challenger_name: name || user?.username || user?.first_name || 'Challenger',
            challenger_score: score,
            challenger_metrics: metrics
          })
          .select()
          .single();

        if (error) throw error;
        return res.status(200).json(data);
      }
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
