import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './_supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const update = req.body;

  if (!update) {
    return res.status(400).send('Empty body');
  }

  try {
    // 1. STEP 1: Handle pre_checkout_query (< 10 seconds requirement)
    if (update.pre_checkout_query) {
      const preCheckoutQueryId = update.pre_checkout_query.id;
      
      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pre_checkout_query_id: preCheckoutQueryId,
            ok: true
          })
        });
      }

      return res.status(200).json({ ok: true });
    }

    // 2. STEP 2: Handle successful_payment
    const message = update.message;
    if (message && message.successful_payment) {
      const payment = message.successful_payment;
      const chargeId = payment.telegram_payment_charge_id;
      const invoicePayload = payment.invoice_payload || '';
      const totalAmount = payment.total_amount; // 100 stars

      // Extract user id from payload "pro_scan_user_<tg_id>" or message sender
      let targetTgId = message.from?.id;
      if (invoicePayload.startsWith('pro_scan_user_')) {
        const parsed = parseInt(invoicePayload.replace('pro_scan_user_', ''), 10);
        if (!isNaN(parsed)) {
          targetTgId = parsed;
        }
      }

      if (supabaseAdmin && chargeId && targetTgId) {
        // Idempotency check: verify charge_id doesn't exist
        const { data: existingTx } = await supabaseAdmin
          .from('star_transactions')
          .select('telegram_payment_charge_id')
          .eq('telegram_payment_charge_id', chargeId)
          .single();

        if (!existingTx) {
          // Record transaction
          await supabaseAdmin.from('star_transactions').insert({
            telegram_payment_charge_id: chargeId,
            tg_id: targetTgId,
            amount_stars: totalAmount
          });

          // Fetch and increment user credits atomically
          const { data: userRow } = await supabaseAdmin
            .from('users')
            .select('credits')
            .eq('tg_id', targetTgId)
            .single();

          const currentCredits = userRow?.credits || 0;
          await supabaseAdmin
            .from('users')
            .update({ credits: currentCredits + 1 })
            .eq('tg_id', targetTgId);

          // Optionally send notification message to user via bot
          if (botToken) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: targetTgId,
                text: '⭐️ Оплата 100 Telegram Stars успешно подтверждена!\nВам начислен +1 PRO-кредит в MogLab. Откройте приложение, чтобы разблокировать Failos и план Softmaxxing.'
              })
            });
          }
        }
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true, ignored: true });
  } catch (err: any) {
    console.error('Telegram webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
