import { TelegramUser } from '../types/telegram';

export class TelegramService {
  private static get webApp() {
    return typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  }

  public static init() {
    const wa = this.webApp;
    if (wa) {
      wa.ready();
      wa.expand();
      // Set clinical dark theme background
      if (wa.headerColor) wa.headerColor = '#09090B';
      if (wa.backgroundColor) wa.backgroundColor = '#09090B';
    }
  }

  public static get isAvailable(): boolean {
    return Boolean(this.webApp && this.webApp.initData);
  }

  public static get initData(): string {
    return this.webApp?.initData || '';
  }

  public static getUser(): TelegramUser {
    if (this.webApp?.initDataUnsafe?.user) {
      return this.webApp.initDataUnsafe.user;
    }
    // Browser / Dev fallback
    return {
      id: 99999999,
      first_name: 'Tester',
      username: 'biometric_user',
      language_code: 'ru'
    };
  }

  public static getStartParam(): string | null {
    return this.webApp?.initDataUnsafe?.start_param || null;
  }

  // Haptic feedback methods
  public static hapticImpact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') {
    try {
      this.webApp?.HapticFeedback?.impactOccurred(style);
    } catch {
      // ignore
    }
  }

  public static hapticNotification(type: 'error' | 'success' | 'warning') {
    try {
      this.webApp?.HapticFeedback?.notificationOccurred(type);
    } catch {
      // ignore
    }
  }

  public static hapticSelection() {
    try {
      this.webApp?.HapticFeedback?.selectionChanged();
    } catch {
      // ignore
    }
  }

  public static get botUsername(): string {
    return (
      (import.meta as any)?.env?.VITE_TELEGRAM_BOT_USERNAME ||
      (typeof process !== 'undefined' ? process.env?.TELEGRAM_BOT_USERNAME : undefined) ||
      'MogLabAppBot'
    );
  }

  // Viral Sharing & Referral links
  public static shareReferral(botUsernameOrUserId: string | number, maybeUserId?: number) {
    this.hapticImpact('heavy');
    const username = typeof botUsernameOrUserId === 'string' ? botUsernameOrUserId : this.botUsername;
    const userId = typeof botUsernameOrUserId === 'number' ? botUsernameOrUserId : (maybeUserId ?? 0);
    const referralLink = `https://t.me/${username}/app?startapp=ref_${userId}`;
    const shareText = `🧬 Пройди клинический биометрический скан лица в MogLab. Оцени костную базу (PSL/Harmony) и получи персональный Softmaxxing протокол: ${referralLink}`;
    
    if (this.webApp?.switchInlineQuery) {
      this.webApp.switchInlineQuery(shareText, ['users', 'groups']);
    } else {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('🧬 Пройди биометрический скан лица в MogLab!')}`;
      window.open(shareUrl, '_blank');
    }
  }

  public static shareBattle(botUsernameOrBattleId: string, battleIdOrScore: string | number, maybeScore?: number) {
    this.hapticImpact('heavy');
    let username = this.botUsername;
    let battleId = botUsernameOrBattleId;
    let score = typeof battleIdOrScore === 'number' ? battleIdOrScore : (maybeScore ?? 6.0);

    if (typeof battleIdOrScore === 'string') {
      username = botUsernameOrBattleId;
      battleId = battleIdOrScore;
      score = maybeScore ?? 6.0;
    }

    const battleLink = `https://t.me/${username}/app?startapp=battle_${battleId}`;
    const text = `⚔️ Я бросаю тебе вызов в Mog Battle! Мой показатель: ${score.toFixed(1)}/10. Прими дуэль и сравни свои пропорции лица: ${battleLink}`;
    
    if (this.webApp?.switchInlineQuery) {
      this.webApp.switchInlineQuery(text, ['users', 'groups']);
    } else {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(battleLink)}&text=${encodeURIComponent(text)}`;
      window.open(shareUrl, '_blank');
    }
  }

  // Telegram Stars Invoice
  public static openInvoice(invoiceUrl: string): Promise<'paid' | 'cancelled' | 'failed' | 'pending'> {
    this.hapticImpact('medium');
    return new Promise((resolve) => {
      const wa = this.webApp;
      if (wa && typeof wa.openInvoice === 'function') {
        wa.openInvoice(invoiceUrl, (status) => {
          resolve(status);
        });
      } else {
        // Dev simulation
        const mockPaid = window.confirm('Симуляция Telegram Stars: Подтвердить оплату 100 Stars?');
        resolve(mockPaid ? 'paid' : 'cancelled');
      }
    });
  }
}
