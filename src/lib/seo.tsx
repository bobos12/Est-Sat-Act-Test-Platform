import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { CONTACT } from "@/lib/marketing";

export const absoluteUrl = (path = "/") => new URL(path, brand.url).toString();

/** Raster logo for structured data (Google needs a bitmap of at least 112 px). */
export const LOGO_URL = absoluteUrl("/icon-512.png");

type PageSeo = {
  /** Page title without the brand suffix (the root template appends "| TargetScore"). */
  title: string;
  description: string;
  /** Canonical path, e.g. "/sat". */
  path: string;
  /** Use the title as-is, without the brand template. */
  absoluteTitle?: boolean;
  noindex?: boolean;
  /** The segment has its own opengraph-image file: leave the image to it. */
  ownImage?: boolean;
};

/** Complete per-page metadata: canonical, robots, Open Graph and X card. */
/**
 * Metadata merges shallowly, so a page that sets `openGraph` must name its image too. The site-wide card is the
 * default; segments with their own opengraph-image file (/est, /sat, /act) pass `ownImage`.
 */
export function pageMetadata({ title, description, path, absoluteTitle, noindex, ownImage }: PageSeo): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${brand.name}`;
  const images = [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${brand.name}: EST, SAT and ACT practice tests for American Diploma students` }];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    robots: noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      siteName: brand.name,
      locale: "en_US",
      url: path,
      title: fullTitle,
      description,
      ...(ownImage ? {} : { images }),
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, ...(ownImage ? {} : { images: ["/opengraph-image"] }) },
  };
}

const socials = [
  CONTACT.instagram && `https://www.instagram.com/${CONTACT.instagram}`,
  CONTACT.tiktok && `https://www.tiktok.com/@${CONTACT.tiktok}`,
].filter(Boolean) as string[];

export const ORG_ID = `${brand.url}/#organization`;
export const SITE_ID = `${brand.url}/#website`;

/** Site-wide entities, rendered once in the root layout. */
export const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: brand.name,
      url: brand.url,
      logo: { "@type": "ImageObject", url: LOGO_URL, width: 512, height: 512 },
      description: brand.description,
      slogan: brand.tagline,
      knowsAbout: ["EST (Egyptian Scholastic Test)", "SAT", "ACT", "American Diploma", "Standardized test preparation"],
      areaServed: [{ "@type": "Country", name: "Egypt" }, { "@type": "Place", name: "Middle East and North Africa" }],
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: brand.supportEmail, availableLanguage: ["English", "Arabic"] },
      ...(socials.length ? { sameAs: socials } : {}),
    },
    {
      "@type": "WebSite",
      "@id": SITE_ID,
      name: brand.name,
      url: brand.url,
      description: brand.description,
      inLanguage: "en",
      publisher: { "@id": ORG_ID },
    },
  ],
};

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

export function faqPage(faqs: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** ISO 8601 duration for schema.org, e.g. 75 → "PT1H15M". */
export const isoDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `PT${h ? `${h}H` : ""}${m || !h ? `${m}M` : ""}`;
};

/** Renders JSON-LD. `<` is escaped so content can never close the script tag. */
export function JsonLd({ data }: { data: object | object[] }) {
  const payload = Array.isArray(data) ? { "@context": "https://schema.org", "@graph": data } : { "@context": "https://schema.org", ...data };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(payload).replace(/</g, "\\u003c") }} />;
}
