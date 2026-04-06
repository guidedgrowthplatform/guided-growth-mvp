import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';

export function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-content">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/80 px-4 py-4 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface"
        >
          <Icon icon="ic:round-arrow-back" width={20} className="text-content" />
        </button>
        <h1 className="text-lg font-semibold">Privacy Policy</h1>
      </div>

      <div className="px-6 pb-12">
        <div className="prose prose-sm max-w-none text-content-secondary">
          <p className="text-xs text-content-tertiary">Last updated: April 6, 2026</p>

          <h2 className="mt-6 text-base font-semibold text-content">1. Information We Collect</h2>
          <p>
            Guided Growth collects the following information to provide and improve our service:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account information</strong>: email address used for authentication via Supabase Auth.</li>
            <li><strong>Profile data</strong>: nickname, age range, and selected preferences during onboarding.</li>
            <li><strong>Usage data</strong>: habits, metrics, journal entries, check-ins, and focus sessions you create.</li>
            <li><strong>Voice data</strong>: voice transcripts are processed in real-time for voice commands and are not stored on our servers.</li>
          </ul>

          <h2 className="mt-6 text-base font-semibold text-content">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To provide and maintain the Guided Growth service.</li>
            <li>To personalize your AI coaching experience.</li>
            <li>To process voice commands via OpenAI and ElevenLabs APIs.</li>
            <li>To generate insights and progress reports.</li>
          </ul>

          <h2 className="mt-6 text-base font-semibold text-content">3. Data Storage & Security</h2>
          <p>
            Your data is stored securely in Supabase with row-level security policies.
            Journal entries are encrypted client-side using AES-GCM 256-bit encryption
            before being stored in the database.
          </p>

          <h2 className="mt-6 text-base font-semibold text-content">4. Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Supabase</strong>: authentication and data storage.</li>
            <li><strong>OpenAI</strong>: voice command processing (transcript analysis only, no data stored).</li>
            <li><strong>ElevenLabs</strong>: text-to-speech and speech-to-text processing.</li>
            <li><strong>Vercel</strong>: application hosting and serverless API functions.</li>
          </ul>

          <h2 className="mt-6 text-base font-semibold text-content">5. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access your personal data.</li>
            <li>Delete your account and all associated data via Settings.</li>
            <li>Opt out of voice features at any time.</li>
          </ul>

          <h2 className="mt-6 text-base font-semibold text-content">6. Contact</h2>
          <p>
            For questions about this privacy policy, please contact us at{' '}
            <a href="mailto:support@guidedgrowth.app" className="text-primary underline">
              support@guidedgrowth.app
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
