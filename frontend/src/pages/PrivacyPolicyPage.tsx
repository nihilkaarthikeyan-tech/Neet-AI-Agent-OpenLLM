import { BookOpen, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

const LAST_UPDATED = '1 June 2026';

export default function PrivacyPolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--accent)', borderRadius: '10px', padding: '8px', display: 'flex' }}>
            <BookOpen size={18} color="#fff" />
          </div>
          <div>
            <p style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>NEET AI</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>Tamil Nadu Government Platform</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
          <Shield size={20} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Privacy Policy</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
          Last updated: {LAST_UPDATED} · Compliant with the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

          <Section title="1. Data Fiduciary">
            <p>This platform is operated by the <strong>Government of Tamil Nadu</strong> as an initiative to support NEET aspirants from Tamil Nadu, with particular focus on students from government schools and economically weaker sections.</p>
            <p>For privacy enquiries, contact: <strong>dpo@neetai.tn.gov.in</strong></p>
          </Section>

          <Section title="2. Personal Data We Collect">
            <ul>
              <li><strong>Account data:</strong> Name, email address, and password (stored as a secure hash — your plaintext password is never stored).</li>
              <li><strong>Study data:</strong> Test scores, flashcard reviews, study plan entries, and AI tutor conversations — used solely to personalise your learning experience.</li>
              <li><strong>Usage data:</strong> Feature usage logs and session timestamps — used for platform analytics and improvement.</li>
              <li><strong>Photos submitted for doubt:</strong> Images you upload are processed by the AI model and are <em>not</em> stored beyond the duration of your request.</li>
            </ul>
            <p>We do not collect Aadhaar numbers, financial data, or any sensitive personal data as defined under Section 2(t) of the DPDP Act.</p>
          </Section>

          <Section title="3. Purpose of Processing">
            <ul>
              <li>Providing personalised NEET preparation services (AI tutor, study planner, mock tests)</li>
              <li>Tracking and displaying your own learning progress</li>
              <li>Generating anonymised cohort analytics for government programme reporting</li>
              <li>Sending transactional emails (OTP, password reset)</li>
            </ul>
            <p>Your data is <strong>not</strong> used for advertising and is <strong>not</strong> sold to third parties.</p>
          </Section>

          <Section title="4. Your Rights under the DPDP Act 2023">
            <p>Under Sections 11–14 of the DPDP Act, you have the right to:</p>
            <ul>
              <li><strong>Access</strong> a summary of the personal data we hold about you</li>
              <li><strong>Correct</strong> inaccurate or incomplete personal data</li>
              <li><strong>Erasure</strong> — request deletion of your account and associated data</li>
              <li><strong>Grievance redressal</strong> — raise a complaint with our Data Protection Officer</li>
              <li><strong>Nomination</strong> — nominate another individual to exercise your rights in case of death or incapacity</li>
            </ul>
            <p>To exercise any of these rights, email <strong>dpo@neetai.tn.gov.in</strong>. We will respond within 72 hours.</p>
          </Section>

          <Section title="5. Data Retention">
            <ul>
              <li><strong>Active accounts:</strong> Data is retained for the duration of your account.</li>
              <li><strong>Deleted accounts:</strong> Personal data is permanently erased within 30 days of a verified deletion request.</li>
              <li><strong>Anonymised analytics:</strong> Aggregated, non-identifiable cohort data may be retained indefinitely for government programme reporting.</li>
            </ul>
          </Section>

          <Section title="6. Data Sharing">
            <p>We share personal data only in the following limited circumstances:</p>
            <ul>
              <li><strong>AI processing:</strong> Tutor conversations and photo doubts are sent to an AI model running on government-managed infrastructure. No data leaves India.</li>
              <li><strong>Legal obligation:</strong> If required by a competent court or authority under applicable Indian law.</li>
            </ul>
            <p>We do not share data with any commercial third party.</p>
          </Section>

          <Section title="7. Security">
            <p>We implement appropriate technical and organisational measures including:</p>
            <ul>
              <li>Passwords hashed with bcrypt (never stored in plaintext)</li>
              <li>All data transmitted over HTTPS/TLS</li>
              <li>JWT tokens with short expiry and secure refresh flow</li>
              <li>Rate limiting on all authenticated endpoints</li>
            </ul>
          </Section>

          <Section title="8. Cookies">
            <p>We use only necessary cookies (authentication refresh token). No tracking or advertising cookies are used.</p>
          </Section>

          <Section title="9. Children's Data">
            <p>NEET aspirants are typically aged 17–25. We do not knowingly process data of children under 18 without verifiable parental consent as required under Section 9 of the DPDP Act.</p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>We will notify registered users via email at least 15 days before any material changes to this policy take effect.</p>
          </Section>

        </div>

        <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            Questions? Email <strong>dpo@neetai.tn.gov.in</strong>
          </p>
          <Link to="/register" style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Registration
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>{title}</h2>
      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.75 }}>
        {children}
      </div>
    </div>
  );
}
