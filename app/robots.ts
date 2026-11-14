import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/my-account', '/auth/', '/api/'] },
    sitemap: 'https://www.jverse.site/sitemap.xml',
    host: 'https://www.jverse.site',
  };
}
