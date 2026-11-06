import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedUser } from './supabaseClient.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = getAuthenticatedUser(req.headers);
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tgId = Number(user.id);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    // Return mock invoice link in dev / preview mode
    return res.status(200).json({
      invoiceUrl: `https://t.me/$mock_stars_invoice_${tgId}`
    });
  }

  try {
    const payload = `pro_scan_user_${tgId}`;
    const invoiceData = {
      title: 'MogLab PRO Analysis',
      description: 'Детальные Failos с баллами штрафов и персональный ИИ-протокол Softmaxxing',
      payload,
      currency: 'XTR', // Telegram Stars currency code
      prices: [
        {
          label: '1 PRO Scan & Protocol',
          amount: 100 // 100 Stars
        }
      ],
      provider_token: '' // Empty string required for Telegram Stars
    };

    const response = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData)
    });

    const resJson = await response.json();
    if (!resJson.ok) {
      console.error('Telegram createInvoiceLink error:', resJson);
      return res.status(500).json({ error: resJson.description || 'Failed to create invoice' });
    }

    return res.status(200).json({ invoiceUrl: resJson.result });
  } catch (err: any) {
    console.error('Create invoice error:', err);
    return res.status(500).json({ error: err.message });
  }
}
