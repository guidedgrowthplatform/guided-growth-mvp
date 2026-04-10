import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';

export function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Header — matches SettingsHeader styling */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface shadow-card"
        >
          <Icon icon="ic:round-arrow-back" width={16} className="text-content" />
        </button>
        <h1 className="text-xl font-bold text-content">Privacy Policy</h1>
        <div className="h-10 w-10" />
      </div>

      {/* Content */}
      <div className="mt-6 text-sm leading-relaxed text-content-secondary">
        <p className="text-xs text-content-tertiary">Last updated: April 6, 2026</p>

        <h2 className="mt-6 text-base font-semibold text-content">1. Information We Collect</h2>
        <p className="mt-2">
          Guided Growth collects the following information to provide and improve our service:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Account information</strong>: email address used for authentication via Supabase
            Auth.
          </li>
          <li>
            <strong>Profile data</strong>: nickname, age range, and selected preferences during
            onboarding.
          </li>
          <li>
            <strong>Usage data</strong>: habits, metrics, journal entries, check-ins, and focus
            sessions you create.
          </li>
          <li>
            <strong>Voice data</strong>: voice transcripts are processed in real-time for voice
            commands and are not stored on our servers.
          </li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-content">
          2. How We Use Your Information
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>To provide and maintain the Guided Growth service.</li>
          <li>To personalize your AI coaching experience.</li>
          <li>To process voice commands via OpenAI and Cartesia APIs.</li>
          <li>To generate insights and progress reports.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-content">3. Data Storage & Security</h2>
        <p className="mt-2">
          Your data is stored securely in Supabase with row-level security policies. Journal entries
          are encrypted client-side using AES-GCM 256-bit encryption before being stored in the
          database.
        </p>

        <h2 className="mt-6 text-base font-semibold text-content">4. Third-Party Services</h2>
        <p className="mt-2">We use the following third-party services:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Supabase</strong>: authentication and data storage.
          </li>
          <li>
            <strong>OpenAI</strong>: voice command processing (transcript analysis only, no data
            stored).
          </li>
          <li>
            <strong>Cartesia</strong>: text-to-speech (Sonic) and speech-to-text (Ink) processing.
          </li>
          <li>
            <strong>Vercel</strong>: application hosting and serverless API functions.
          </li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-content">5. Your Rights</h2>
        <p className="mt-2">You have the right to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Access your personal data.</li>
          <li>Delete your account and all associated data via Settings.</li>
          <li>Opt out of voice features at any time.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-content">6. Contact</h2>
        <p className="mt-2">
          For questions about this privacy policy, please contact us at{' '}
          <a href="mailto:support@guidedgrowth.app" className="text-primary underline">
            support@guidedgrowth.app
          </a>
          .
        </p>
      </div>
    </div>
  );
}
