import react from '@vitejs/plugin-react';
import { defineConfig, Plugin } from 'vite';

// Vite dev server API mock middleware for local preview & testing
function apiDevMiddleware(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        res.setHeader('Content-Type', 'application/json');

        // Read request body if present
        let body: any = {};
        if (req.method === 'POST') {
          const buffers: Buffer[] = [];
          for await (const chunk of req) {
            buffers.push(chunk);
          }
          const raw = Buffer.concat(buffers).toString('utf-8');
          try {
            if (raw) body = JSON.parse(raw);
          } catch {
            body = {};
          }
        }

        // 1. /api/auth
        if (pathname === '/api/auth') {
          const startParam = body.startParam || '';
          let referredBy = null;
          if (typeof startParam === 'string' && startParam.startsWith('ref_')) {
            referredBy = parseInt(startParam.replace('ref_', ''), 10);
          }
          res.end(JSON.stringify({
            tg_id: 99999999,
            username: 'biometric_user',
            first_name: 'Tester',
            credits: 0,
            referred_by: referredBy,
            referral_rewarded: false,
            qualified_referrals_count: 0
          }));
          return;
        }

        // 2. /api/complete-scan
        if (pathname === '/api/complete-scan') {
          res.end(JSON.stringify({
            success: true,
            referralCounted: false
          }));
          return;
        }

        // 3. /api/unlock-pro
        if (pathname === '/api/unlock-pro') {
          const gender = body.gender || 'male';
          const isMale = gender === 'male';
          const contrast = Math.round((body.extractedProfile?.colorimetry?.overallFacialContrast || 0.22) * 100);
          const variance = body.extractedProfile?.colorimetry?.skinLuminanceVariance || 14.2;

          res.end(JSON.stringify({
            failos_detailed: [
              {
                id: 'low_facial_contrast',
                title: 'Низкий контраст верхней трети',
                penalty: -0.7,
                explanation: `Брови и ресничный контур имеют относительный контраст ${contrast}% (ниже нормы 24%), из-за чего глубина взгляда визуально рассеивается.`
              },
              {
                id: 'buccal_puffiness_debuff',
                title: 'Скрытый рельеф скул (Задержка жидкости)',
                penalty: -0.6,
                explanation: `Индекс вариации яркости в щечной зоне (${variance}) свидетельствует о микро-отечности, маскирующей генетическую выраженность челюстных углов.`
              },
              {
                id: 'subnasale_symmetry_variance',
                title: 'Микро-асимметрия нижней трети',
                penalty: -0.4,
                explanation: `Индекс центральной симметрии демонстрирует незначительный латеральный сдвиг подбородка при мимическом тонусе.`
              }
            ],
            softmaxxing_plan: {
              hairstyle: {
                recommended_style: isMale ? 'Textured Fringe / Messy Crop' : 'Face-Framing Soft Layers with Curtain Bangs',
                reasoning: isMale
                  ? 'При текущем соотношении верхней трети лица текстурная челка снижает визуальную высоту лба и акцентирует горизонтальную линию челюсти.'
                  : 'Каскадные пряди мягко обрамляют скуловую дугу (Ogee curve), визуально сужая нижнюю треть лица.',
                products: ['Морская соль (Sea Salt Spray)', 'Матовая пудра для текстурирования и прикорневого объема']
              },
              grooming_and_contrast: {
                actions: [
                  'Уплотнение и тонирование волосков бровей на 0.5–1 тон темнее естественного тона кожи (пептидные сыворотки с биотином)',
                  'Выравнивание нижнего контура брови с сохранением плотного прямого вектора без завышения арки'
                ]
              },
              skin_and_debloating: {
                need_debloating: true,
                actions: [
                  'Контроль баланса натрия/калия (снижение соли до <2г/сутки, калиевая минеральная вода для устранения отечности овала лица)',
                  'Сыворотка с 10% азелаиновой кислотой или 5% ниацинамидом для стабилизации индекса покраснения (Redness Index)',
                  'Холодный контрастный гидромассаж по массажным линиям от подбородка к околоушным лимфоузлам каждое утро'
                ]
              }
            },
            newCredits: 0
          }));
          return;
        }

        // 4. /api/create-invoice
        if (pathname === '/api/create-invoice') {
          res.end(JSON.stringify({
            invoiceUrl: 'https://t.me/$mock_stars_invoice_url'
          }));
          return;
        }

        // 5. /api/leaderboard
        if (pathname === '/api/leaderboard') {
          res.end(JSON.stringify([
            { id: '1', tg_id: 11111, username: 'alex_nordic', gender: 'male', score: 8.4, potential_score: 9.1, verified_camera: true },
            { id: '2', tg_id: 22222, username: 'elena_v', gender: 'female', score: 8.2, potential_score: 8.9, verified_camera: true },
            { id: '3', tg_id: 33333, username: 'mark_psl', gender: 'male', score: 7.8, potential_score: 8.5, verified_camera: true },
            { id: '4', tg_id: 44444, username: 'sofia_model', gender: 'female', score: 7.6, potential_score: 8.7, verified_camera: true },
            { id: '5', tg_id: 55555, username: 'dmitry_k', gender: 'male', score: 7.3, potential_score: 8.2, verified_camera: true }
          ]));
          return;
        }

        // 6. /api/battle
        if (pathname === '/api/battle') {
          res.end(JSON.stringify({
            id: 'battle_demo_123',
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
          }));
          return;
        }

        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), apiDevMiddleware()],
  server: {
    port: 5173,
    host: true
  }
});
