import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { PrivacyScreen } from './components/PrivacyScreen';
import { CameraScanner } from './components/CameraScanner';
import { PhotoUploader } from './components/PhotoUploader';
import { ResultsDashboard } from './components/ResultsDashboard';
import { ProUnlockModal } from './components/modals/ProUnlockModal';
import { MogBattleModal } from './components/modals/MogBattleModal';
import { LeaderboardModal } from './components/modals/LeaderboardModal';
import { TelegramService } from './services/telegram';
import { ApiClient } from './services/apiClient';
import { BiometricReport, GenderMode } from './types/biometrics';
import { DbUser } from './types/database';

type ViewMode = 'privacy' | 'camera' | 'gallery' | 'dashboard';

export const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('privacy');
  const [gender, setGender] = useState<GenderMode>('male');
  const [report, setReport] = useState<BiometricReport | null>(null);

  // User state
  const [user, setUser] = useState<DbUser>({
    tg_id: 99999999,
    username: 'biometric_user',
    first_name: 'Tester',
    credits: 0,
    referred_by: null,
    referral_rewarded: false,
    qualified_referrals_count: 0
  });

  // Modal visibility states
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [isBattleModalOpen, setIsBattleModalOpen] = useState(false);
  const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false);

  // Initialize Telegram WebApp & Authenticate
  useEffect(() => {
    TelegramService.init();

    async function loadUser() {
      try {
        const dbUser = await ApiClient.authenticate();
        setUser(dbUser);
      } catch (err) {
        console.error('Failed to auth user:', err);
      }
    }

    loadUser();
  }, []);

  // When a scan completes
  const handleScanComplete = async (newReport: BiometricReport) => {
    setReport(newReport);
    setView('dashboard');

    // Trigger complete-scan signal to reward inviter if this is first scan
    try {
      await ApiClient.completeScan(newReport.id);
    } catch {
      // ignore
    }

    // If verified camera, auto-sync with leaderboard
    if (newReport.verifiedCamera) {
      try {
        await ApiClient.submitToLeaderboard(newReport);
      } catch {
        // ignore
      }
    }
  };

  const handleUnlockedReport = (updatedReport: BiometricReport, newCredits: number) => {
    setReport(updatedReport);
    setUser(prev => ({ ...prev, credits: newCredits }));
  };

  return (
    <div className="min-h-screen bg-background text-zinc-100 flex flex-col">
      {/* Top Header with Brand, Gender Switcher, Credits & Quick Nav */}
      <Header
        gender={gender}
        onGenderChange={setGender}
        credits={user.credits}
        onOpenProModal={() => setIsProModalOpen(true)}
        onOpenLeaderboard={() => setIsLeaderboardModalOpen(true)}
        onOpenBattle={() => setIsBattleModalOpen(true)}
      />

      {/* Main View Flow */}
      <main className="flex-1 flex flex-col">
        {view === 'privacy' && (
          <PrivacyScreen
            onStartLiveCamera={() => setView('camera')}
            onSelectGallery={() => setView('gallery')}
          />
        )}

        {view === 'camera' && (
          <CameraScanner
            gender={gender}
            onScanComplete={handleScanComplete}
            onBack={() => setView('privacy')}
          />
        )}

        {view === 'gallery' && (
          <PhotoUploader
            gender={gender}
            onScanComplete={handleScanComplete}
            onBack={() => setView('privacy')}
          />
        )}

        {view === 'dashboard' && report && (
          <ResultsDashboard
            report={report}
            onOpenUnlockModal={() => setIsProModalOpen(true)}
            onOpenBattleModal={() => setIsBattleModalOpen(true)}
            onOpenLeaderboardModal={() => setIsLeaderboardModalOpen(true)}
            onRetakeScan={() => setView('camera')}
          />
        )}
      </main>

      {/* PRO Unlock Modal */}
      <ProUnlockModal
        isOpen={isProModalOpen}
        onClose={() => setIsProModalOpen(false)}
        user={user}
        report={report}
        onUnlocked={handleUnlockedReport}
      />

      {/* Mog Battle Modal */}
      <MogBattleModal
        isOpen={isBattleModalOpen}
        onClose={() => setIsBattleModalOpen(false)}
        user={user}
        report={report}
      />

      {/* Leaderboard Modal */}
      <LeaderboardModal
        isOpen={isLeaderboardModalOpen}
        onClose={() => setIsLeaderboardModalOpen(false)}
        user={user}
      />
    </div>
  );
};
