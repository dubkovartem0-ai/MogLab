import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedUser, supabaseAdmin } from './supabaseClient';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = getAuthenticatedUser(req.headers);
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tgId = Number(user.id);

  if (!supabaseAdmin) {
    return res.status(200).json({ success: true, mock: true });
  }

  try {
    // 1. Fetch current user
    const { data: currentUser, error: userErr } = await supabaseAdmin
      .from('users')
      .select('referred_by, referral_rewarded')
      .eq('tg_id', tgId)
      .single();

    if (userErr || !currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2. If user has referred_by and hasn't been rewarded yet
    if (currentUser.referred_by && !currentUser.referral_rewarded) {
      // Mark as rewarded for this user to prevent double count
      await supabaseAdmin
        .from('users')
        .update({ referral_rewarded: true })
        .eq('tg_id', tgId);

      // Fetch the referrer
      const referrerId = currentUser.referred_by;
      const { data: referrer, error: refErr } = await supabaseAdmin
        .from('users')
        .select('qualified_referrals_count, credits')
        .eq('tg_id', referrerId)
        .single();

      if (referrer) {
        const newQualifiedCount = (referrer.qualified_referrals_count || 0) + 1;
        // Award +1 credit for every 2 qualified referrals
        const awardCredit = newQualifiedCount % 2 === 0;
        const newCredits = awardCredit ? (referrer.credits || 0) + 1 : (referrer.credits || 0);

        await supabaseAdmin
          .from('users')
          .update({
            qualified_referrals_count: newQualifiedCount,
            credits: newCredits
          })
          .eq('tg_id', referrerId);

        return res.status(200).json({
          success: true,
          referralCounted: true,
          awardedCredit: awardCredit
        });
      }
    }

    return res.status(200).json({ success: true, referralCounted: false });
  } catch (err: any) {
    console.error('Complete scan error:', err);
    return res.status(500).json({ error: err.message });
  }
}
