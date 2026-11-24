import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { brand } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: `How ${brand.name} collects, uses and protects your personal information.`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="24 November 2026">
      <section>
        <p>
          This policy explains what information {brand.name} ({brand.url.replace("https://", "")}) collects when you use our EST, SAT and ACT practice
          platform, why we collect it, and the choices you have. If you have a question, email us at{" "}
          <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.
        </p>
      </section>

      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>
            <b>Account details:</b> your name, email address and password (stored only as a secure hash). If you sign in with Google, we receive your
            name, email address and profile picture from Google.
          </li>
          <li>
            <b>Profile details you choose to add:</b> phone number, school and grade.
          </li>
          <li>
            <b>Study activity:</b> the exams and practice questions you take, your answers, scores, time spent, bookmarks and progress.
          </li>
          <li>
            <b>Payments:</b> the plan you buy, the amount, the payment method and its status. For InstaPay and Vodafone Cash we also keep the sender
            number and the screenshot you upload so we can confirm the transfer. Card payments are processed by Paymob; we never see or store your full
            card number.
          </li>
          <li>
            <b>Security information:</b> your IP address, approximate location (city and country), browser and device type, and a device identifier
            cookie. We use these to keep accounts secure and to stop account sharing and copying of our content.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use your information</h2>
        <ul>
          <li>To create and run your account and sign you in.</li>
          <li>To deliver exams and practice, score your answers and show your progress.</li>
          <li>To process payments and give you the premium access you paid for.</li>
          <li>To send emails you need, such as sign-in links, password resets and account notices.</li>
          <li>To protect the platform: detecting shared accounts, unusual sign-ins and unauthorised copying of exam content.</li>
          <li>To answer your support requests and improve the platform.</li>
        </ul>
        <p>We do not sell your personal information and we do not use it for third-party advertising.</p>
      </section>

      <section>
        <h2>Who we share it with</h2>
        <p>We share information only with services that help us run {brand.name}, and only what they need:</p>
        <ul>
          <li>Supabase, which hosts our database, sign-in and file storage.</li>
          <li>Vercel, which hosts the website.</li>
          <li>Google, if you choose to sign in with Google.</li>
          <li>Paymob, for card payments.</li>
          <li>Cloudflare Turnstile, which checks that sign-ups and sign-ins come from real people.</li>
        </ul>
        <p>We may also disclose information if the law requires it, or to protect our rights and the safety of our users.</p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          We use essential cookies only: to keep you signed in, to remember your device for security, and to protect forms from bots. We do not use
          advertising cookies.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          We keep your account information and study history while your account is open. Payment records are kept as long as we need them for
          accounting. Security logs are kept for a limited time. When your account is deleted, your profile, attempts and subscriptions are removed.
        </p>
      </section>

      <section>
        <h2>Your choices and rights</h2>
        <ul>
          <li>You can see and update your profile details from your account.</li>
          <li>
            You can ask us for a copy of your information, ask us to correct it, or ask us to delete your account by emailing{" "}
            <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a> from the email address on your account.
          </li>
        </ul>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Connections to {brand.name} are encrypted, passwords are hashed, payment screenshots are stored privately, and staff access requires 2-step
          verification. No system is perfectly secure, so please use a strong password and don&apos;t share your account.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          {brand.name} is built for secondary-school students preparing for university admission tests. If you are under the age where your country
          requires parental consent to use online services, please use {brand.name} with your parent&apos;s or guardian&apos;s permission.
        </p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>If we change this policy, we will update the date at the top of this page. Important changes will be announced on the site or by email.</p>
      </section>
    </LegalPage>
  );
}
