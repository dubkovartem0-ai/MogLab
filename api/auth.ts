import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedUser, supabaseAdmin } from './supabaseClient.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { initData, startParam } = req.body || {};
  const user = getAuthenticatedUser({
    ...req.headers,
    'x-telegram-init-data': initData || req.headers['x-telegram-init-data']
  });

  if (!user || !user.id) {
    return res.status(401).json({ error: 'Unauthorized Telegram WebApp data' });
  }

  const tgId = Number(user.id);
  const username = user.username || null;
  const firstName = user.first_name || null;

  let referredBy: number | null = null;
  if (typeof startParam === 'string' && startParam.startsWith('ref_')) {
    const parsedRef = parseInt(startParam.replace('ref_', ''), 10);
    if (!isNaN(parsedRef) && parsedRef !== tgId) {
      referredBy = parsedRef;
    }
  }

  // If Supabase is connected
  if (supabaseAdmin) {
    try {
      // 1. Check if user already exists
      const { data: existingUser, error: fetchErr } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('tg_id', tgId)
        .single();

      if (existingUser) {
        return res.status(200).json(existingUser);
      }

      // 2. Insert new user
      const { data: newUser, error: insertErr } = await supabaseAdmin
        .from('users')
        .insert({
          tg_id: tgId,
          username,
          first_name: firstName,
          credits: 0,
          referred_by: referredBy,
          referral_rewarded: false,
          qualified_referrals_count: 0
        })
        .select()
        .single();

      if (insertErr) {
        console.error('Supabase user insert error:', insertErr);
        return res.status(500).json({ error: 'Failed to create user in database' });
      }

      return res.status(200).json(newUser);
    } catch (err: any) {
      console.error('Auth error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // Fallback if Supabase not yet configured (mock response)
  return res.status(200).json({
    tg_id: tgId,
    username,
    first_name: firstName,
    credits: 0,
    referred_by: referredBy,
    referral_rewarded: false,
    qualified_referrals_count: 0
  });
}
