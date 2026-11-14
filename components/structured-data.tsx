const structuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Jay-Be Gubot',
    url: 'https://www.jverse.site',
    jobTitle: 'Full-Stack Developer & Innovator',
    email: 'mailto:jaybe.gubot01@gmail.com',
    worksFor: { '@type': 'Organization', name: 'JVerse' },
    knowsAbout: ['Next.js', 'React', 'Flutter', 'Node.js', 'Business systems', 'Web development'],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'JVerse',
    url: 'https://www.jverse.site',
    email: 'jaybe.gubot01@gmail.com',
    areaServed: { '@type': 'Country', name: 'Philippines' },
    serviceType: ['Web development', 'Full-stack software development', 'Business systems', 'Mobile application development'],
  },
];

export function StructuredData() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />;
}
