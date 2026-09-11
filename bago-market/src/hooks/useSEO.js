import { useEffect } from 'react';

const SITE_NAME = 'Bago Shop Express';
const DEFAULT_DESCRIPTION =
  'Discover local products from Bago City, Negros Occidental. Shop fresh produce, handmade crafts, electronics, clothing and more from trusted local sellers.';
const DEFAULT_IMAGE = '/favicon.svg';
const SITE_URL = typeof window !== 'undefined' ? window.location.origin : '';

/**
 * useSEO — updates <title>, meta description, Open Graph and Twitter Card tags.
 *
 * @param {Object} opts
 * @param {string} [opts.title]          - Page-specific title (appended with " | Bago Shop Express")
 * @param {string} [opts.description]    - Meta description
 * @param {string} [opts.image]          - OG image URL
 * @param {string} [opts.url]            - Canonical URL (defaults to current path)
 * @param {string} [opts.type]           - OG type, e.g. "product" or "website"
 * @param {Object} [opts.product]        - Product-specific structured data (price, availability, etc.)
 */
export function useSEO({ title, description, image, url, type = 'website', product } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    const metaDesc  = description || DEFAULT_DESCRIPTION;
    const metaImage = image || `${SITE_URL}${DEFAULT_IMAGE}`;
    const canonical = url || `${SITE_URL}${window.location.pathname}`;

    // ── <title> ──
    document.title = fullTitle;

    // Helper to upsert a <meta> tag
    const setMeta = (selector, attr, value) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        const [attrName, attrValue] = selector.match(/\[([^=]+)="([^"]+)"\]/)?.slice(1) ?? [];
        if (attrName) el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    // Helper to upsert a <link> tag
    const setLink = (rel, href) => {
      let el = document.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    // Standard meta
    setMeta('meta[name="description"]',         'content', metaDesc);
    setMeta('meta[name="keywords"]',            'content',
      'Bago Shop Express, Bago City, local products, Negros Occidental, online shopping, buy local, Filipino marketplace');
    setMeta('meta[name="robots"]',              'content', 'index, follow');

    // Canonical
    setLink('canonical', canonical);

    // Open Graph
    setMeta('meta[property="og:title"]',        'content', fullTitle);
    setMeta('meta[property="og:description"]',  'content', metaDesc);
    setMeta('meta[property="og:image"]',        'content', metaImage);
    setMeta('meta[property="og:url"]',          'content', canonical);
    setMeta('meta[property="og:type"]',         'content', type);
    setMeta('meta[property="og:site_name"]',    'content', SITE_NAME);
    setMeta('meta[property="og:locale"]',       'content', 'en_PH');

    // Twitter Card
    setMeta('meta[name="twitter:card"]',        'content', 'summary_large_image');
    setMeta('meta[name="twitter:title"]',       'content', fullTitle);
    setMeta('meta[name="twitter:description"]', 'content', metaDesc);
    setMeta('meta[name="twitter:image"]',       'content', metaImage);

    // Product structured data (JSON-LD)
    const ldId = 'seo-json-ld';
    let ldEl   = document.getElementById(ldId);

    if (product) {
      const schema = {
        '@context': 'https://schema.org',
        '@type':    'Product',
        name:        product.name,
        description: product.description,
        image:       product.images || [metaImage],
        sku:         product.sku || String(product.id),
        offers: {
          '@type':       'Offer',
          priceCurrency: 'PHP',
          price:         product.price,
          availability:  product.stock > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Organization',
            name:    product.store_name || product.seller_name || SITE_NAME,
          },
        },
        ...(product.rating && {
          aggregateRating: {
            '@type':       'AggregateRating',
            ratingValue:   product.rating,
            reviewCount:   product.rating_count || 0,
            bestRating:    5,
            worstRating:   1,
          },
        }),
      };

      if (!ldEl) {
        ldEl    = document.createElement('script');
        ldEl.id = ldId;
        ldEl.setAttribute('type', 'application/ld+json');
        document.head.appendChild(ldEl);
      }
      ldEl.textContent = JSON.stringify(schema);
    } else if (ldEl) {
      ldEl.remove();
    }

    // Cleanup on unmount — restore defaults
    return () => {
      document.title = SITE_NAME;
    };
  }, [title, description, image, url, type, product]);
}
