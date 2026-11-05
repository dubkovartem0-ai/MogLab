import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Server-side Supabase client with Service Role privileges (bypasses RLS safely on backend)
export const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
  : null;

/**
 * Validates Telegram WebApp initData HMAC-SHA256 signature
 */
export function verifyTelegramWebAppData(initData: string, botToken: string): { isValid: boolean; user?: any } {
  if (!initData || !botToken) {
    return { isValid: false };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { isValid: false };

    params.delete('hash');

    // Sort parameters alphabetically
    const dataCheckArr: string[] = [];
    Array.from(params.keys())
      .sort()
      .forEach(key => {
        dataCheckArr.push(`${key}=${params.get(key)}`);
      });
    const dataCheckString = dataCheckArr.join('\n');

    // HMAC secret key derived from bot token with "WebAppData"
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const isValid = calculatedHash === hash;
    const userStr = params.get('user');
    const user = userStr ? JSON.parse(userStr) : undefined;

    return { isValid, user };
  } catch (err) {
    console.error('Error verifying initData:', err);
    return { isValid: false };
  }
}

/**
 * Extracts and verifies Telegram user from request headers
 */
export function getAuthenticatedUser(reqHeaders: Record<string, string | string[] | undefined>) {
  const initDataHeader = reqHeaders['x-telegram-init-data'];
  const initData = Array.isArray(initDataHeader) ? initDataHeader[0] : initDataHeader;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (botToken && initData) {
    const { isValid, user } = verifyTelegramWebAppData(initData, botToken);
    if (isValid && user) {
      return user;
    }
  }

  // If in development mode or token not set, allow dev header or fallback user
  if (process.env.NODE_ENV !== 'production' || !botToken) {
    return {
      id: 99999999,
      first_name: 'Tester',
      username: 'biometric_user'
    };
  }

  return null;
}
