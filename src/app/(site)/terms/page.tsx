import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/legal-page";
import { brand } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description: `The rules for using ${brand.name}, including accounts, payments and use of our practice content.`,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="24 November 2026">
      <section>
        <p>
          These terms apply when you use {brand.name} ({brand.url.replace("https://", "")}). By creating an account or using the platform you agree to
          them. If you don&apos;t agree, please don&apos;t use {brand.name}. Questions? Email{" "}
          <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.
        </p>
      </section>

      <section>
        <h2>1. The service</h2>
        <p>
          {brand.name} provides online practice tests, practice questions, explanations and score reports for the EST, SAT and ACT. Some exams are
          free with an account; others need a premium plan. {brand.name} is an independent preparation platform and is not affiliated with or endorsed
          by the EST, SAT or ACT organisers. We don&apos;t guarantee any particular score on the real test.
        </p>
      </section>

      <section>
        <h2>2. Your account</h2>
        <ul>
          <li>Give accurate details and keep your password private.</li>
          <li>Each account is for one person only. Sharing an account, or letting others use it, is not allowed.</li>
          <li>
            To protect accounts, signing in on a new device may sign you out of other devices. We may suspend accounts that show signs of sharing.
          </li>
          <li>You are responsible for activity on your account. Tell us straight away if you think someone else has used it.</li>
        </ul>
      </section>

      <section>
        <h2>3. Premium plans and payments</h2>
        <ul>
          <li>
            Prices are shown on the <Link href="/pricing">pricing page</Link> in Egyptian pounds. Premium gives access to all premium content for the
            length of the plan you buy.
          </li>
          <li>
            Card payments start your access as soon as they are confirmed. InstaPay and Vodafone Cash payments start once we have checked your transfer
            and screenshot. We may reject a payment we can&apos;t confirm.
          </li>
          <li>Plans don&apos;t renew automatically. Buying again before your plan ends adds the new time on top.</li>
          <li>
            If you paid by mistake or there was a problem with your access, contact us at <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.
            Refunds are reviewed case by case. When a payment is refunded, the premium access it bought ends.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Our content</h2>
        <p>
          The exams, questions, explanations, images and software on {brand.name} belong to us or our licensors and are for your personal study only.
          You must not:
        </p>
        <ul>
          <li>copy, screenshot, record, download, print, share or republish questions or explanations;</li>
          <li>use bots, scrapers or other tools to collect content;</li>
          <li>sell, teach from, or build another product with our content.</li>
        </ul>
        <p>Content may carry invisible marks that identify the account it was shown to. We may suspend or close accounts that break these rules.</p>
      </section>

      <section>
        <h2>5. Acceptable use</h2>
        <p>
          Don&apos;t try to break, overload or get around the security of the platform, access other people&apos;s accounts, or use {brand.name} for
          anything unlawful.
        </p>
      </section>

      <section>
        <h2>6. Suspension and closing your account</h2>
        <p>
          You can ask us to delete your account at any time. We may suspend or close an account that breaks these terms. If we close an account for
          breaking these terms, any remaining premium time is not refunded.
        </p>
      </section>

      <section>
        <h2>7. Availability and liability</h2>
        <p>
          We work to keep {brand.name} available and accurate, but the service is provided &quot;as is&quot; and may sometimes be unavailable or contain
          mistakes. To the extent the law allows, we are not liable for indirect losses, and our total liability to you is limited to the amount you
          paid us in the last 12 months.
        </p>
      </section>

      <section>
        <h2>8. Privacy</h2>
        <p>
          How we handle your information is explained in our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <section>
        <h2>9. Changes and governing law</h2>
        <p>
          We may update these terms; the date at the top shows the latest version, and continuing to use {brand.name} means you accept it. These terms
          are governed by the laws of the Arab Republic of Egypt.
        </p>
      </section>
    </LegalPage>
  );
}
