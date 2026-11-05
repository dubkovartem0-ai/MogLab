import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Safely resolves Supabase admin client using dynamic import & env validation
 * Never throws or blocks execution if Supabase is unconfigured or module is missing
 */
async function getSupabaseAdminSafe() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  try {
    // 1. Try to import from supabaseClient
    const mod = await import('./supabaseClient.js').catch(async () => {
      return await import('./supabaseClient');
    }).catch(() => null);

    if (mod && mod.supabaseAdmin) {
      return mod.supabaseAdmin;
    }

    // 2. Direct fallback using @supabase/supabase-js
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });
  } catch (err) {
    console.warn('[tg-webhook] Safe Supabase initialization notice:', err);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Always log method and headers for Vercel debugging
  console.log('[tg-webhook] Incoming request:', {
    method: req.method,
    headers: req.headers
  });

  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'Use POST for Telegram Webhook' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const appBaseUrl =
    process.env.VITE_APP_URL ||
    process.env.APP_URL ||
    'https://mog-lab-oeyw.vercel.app';

  if (!botToken) {
    console.error('[tg-webhook] CRITICAL: TELEGRAM_BOT_TOKEN environment variable is not defined!');
    return res.status(200).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured in Vercel' });
  }

  const update = req.body;
  console.log('[tg-webhook] Received update body:', JSON.stringify(update, null, 2));

  if (!update) {
    return res.status(200).json({ ok: true, error: 'Empty update body' });
  }

  try {
    // -------------------------------------------------------------------------
    // 1. STEP 1: Handle pre_checkout_query for Telegram Stars (< 10s SLA)
    // -------------------------------------------------------------------------
    if (update.pre_checkout_query) {
      const preCheckoutQueryId = update.pre_checkout_query.id;
      console.log('[tg-webhook] Processing pre_checkout_query:', preCheckoutQueryId);

      try {
        const preRes = await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pre_checkout_query_id: preCheckoutQueryId,
            ok: true
          })
        });
        const preData = await preRes.json();
        console.log('[tg-webhook] answerPreCheckoutQuery result:', preData);
      } catch (preErr) {
        console.error('[tg-webhook] Error answering pre_checkout_query:', preErr);
      }

      return res.status(200).json({ ok: true });
    }

    // -------------------------------------------------------------------------
    // 2. STEP 2: Handle incoming Message (/start, text, payments)
    // -------------------------------------------------------------------------
    const message = update.message;
    if (message) {
      const chatId = message.chat?.id;
      const text = message.text?.trim() || '';

      // --- A) Handle /start command ---
      if (text.startsWith('/start')) {
        console.log('[tg-webhook] Detected /start command from chat:', chatId, 'Text:', text);

        // Parse optional referral/battle payload from /start (e.g. "/start ref_12345" or "/start battle_xyz")
        let appUrl = appBaseUrl;
        if (text.startsWith('/start ') && text.length > 7) {
          const startParam = text.substring(7).trim();
          if (startParam) {
            const separator = appBaseUrl.includes('?') ? '&' : '?';
            appUrl = `${appBaseUrl}${separator}startapp=${encodeURIComponent(startParam)}`;
          }
        }

        console.log('[tg-webhook] Launching WebApp button with URL:', appUrl);

        // Immediate SendMessage to user - NEVER BLOCKED BY DATABASE
        try {
          const sendRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: 'Добро пожаловать в MogLab v2.0! Нажмите кнопку ниже, чтобы запустить биометрический сканер лица.',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🧬 Запустить MogLab',
                      web_app: { url: appUrl }
                    }
                  ]
                ]
              }
            })
          });

          const sendJson = await sendRes.json();
          console.log('[tg-webhook] sendMessage response:', sendJson);

          if (!sendJson.ok) {
            console.error('[tg-webhook] Telegram API sendMessage error:', sendJson.description);
          }
        } catch (sendErr) {
          console.error('[tg-webhook] Network error while sending message to Telegram:', sendErr);
        }

        // Non-blocking background registration in Supabase (never fails the webhook response)
        if (message.from?.id) {
          (async () => {
            try {
              const supabase = await getSupabaseAdminSafe();
              if (!supabase) {
                console.log('[tg-webhook] Supabase not configured, skipping background user upsert.');
                return;
              }

              const tgId = message.from.id;
              let referredBy: number | null = null;
              if (text.startsWith('/start ref_')) {
                const refId = parseInt(text.replace('/start ref_', '').trim(), 10);
                if (!isNaN(refId) && refId !== tgId) {
                  referredBy = refId;
                }
              }

              await supabase.from('users').upsert(
                {
                  tg_id: tgId,
                  username: message.from.username || null,
                  first_name: message.from.first_name || null,
                  ...(referredBy ? { referred_by: referredBy } : {})
                },
                { onConflict: 'tg_id', ignoreDuplicates: true }
              );
              console.log('[tg-webhook] Background user registration synced for tg_id:', tgId);
            } catch (dbErr) {
              console.warn('[tg-webhook] Supabase user registration notice:', dbErr);
            }
          })();
        }

        return res.status(200).json({ ok: true, command: '/start', sentTo: chatId });
      }

      // --- B) Handle successful_payment (Telegram Stars) ---
      if (message.successful_payment) {
        console.log('[tg-webhook] Detected successful_payment:', message.successful_payment);
        const payment = message.successful_payment;
        const chargeId = payment.telegram_payment_charge_id;
        const invoicePayload = payment.invoice_payload || '';
        const totalAmount = payment.total_amount;

        let targetTgId = message.from?.id;
        if (invoicePayload.startsWith('pro_scan_user_')) {
          const parsed = parseInt(invoicePayload.replace('pro_scan_user_', ''), 10);
          if (!isNaN(parsed)) {
            targetTgId = parsed;
          }
        }

        if (chargeId && targetTgId) {
          try {
            const supabase = await getSupabaseAdminSafe();
            if (supabase) {
              const { data: existingTx } = await supabase
                .from('star_transactions')
                .select('telegram_payment_charge_id')
                .eq('telegram_payment_charge_id', chargeId)
                .single();

              if (!existingTx) {
                await supabase.from('star_transactions').insert({
                  telegram_payment_charge_id: chargeId,
                  tg_id: targetTgId,
                  amount_stars: totalAmount
                });

                const { data: userRow } = await supabase
                  .from('users')
                  .select('credits')
                  .eq('tg_id', targetTgId)
                  .single();

                const currentCredits = userRow?.credits || 0;
                await supabase
                  .from('users')
                  .update({ credits: currentCredits + 1 })
                  .eq('tg_id', targetTgId);

                // Notify user of stars credit
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: targetTgId,
                    text: '⭐️ Оплата 100 Telegram Stars подтверждена!\nВам начислен +1 PRO-кредит в MogLab. Откройте приложение для детального анализа.'
                  })
                });
                console.log('[tg-webhook] Credited +1 PRO to user:', targetTgId);
              }
            }
          } catch (payDbErr) {
            console.error('[tg-webhook] Error processing star transaction:', payDbErr);
          }
        }

        return res.status(200).json({ ok: true, payment: 'processed' });
      }
    }

    // Default fallback response
    return res.status(200).json({ ok: true, ignored: true });
  } catch (err: any) {
    console.error('[tg-webhook] Unhandled webhook exception:', err);
    // Always return 200 OK so Telegram does not retry failed updates infinitely
    return res.status(200).json({ ok: true, error: err?.message || 'Internal error' });
  }
}
