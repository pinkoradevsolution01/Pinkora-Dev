import type { MetadataRoute } from 'next';

const siteUrl = 'https://www.jverse.site';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['/overview', '/solutions', '/portfolio', '/portfolio/voices-of-innovation', '/collaborations', '/who-am-i', '/get-in-touch'];
  return routes.map((route) => ({ url: `${siteUrl}${route}`, lastModified: new Date(), changeFrequency: route === '/overview' ? 'weekly' : 'monthly', priority: route === '/overview' ? 1 : route === '/portfolio' ? 0.9 : 0.7 }));
}
