import Image from 'next/image';

type ProjectCaseStudyProps = {
  project: string;
  image: string;
  imageAlt: string;
  challenge: string;
  approach: string;
  outcome: string;
  technologies: string[];
  workflow: string[];
};

export function ProjectCaseStudy({ project, image, imageAlt, challenge, approach, outcome, technologies, workflow }: ProjectCaseStudyProps) {
  return <section className="next-section next-container next-case-study" aria-labelledby={`${project.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-case-study`}>
    <div className="next-section-heading"><div><span className="next-eyebrow">Case study</span><h2 id={`${project.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-case-study`}>How {project} is shaped around real work.</h2></div><p>Project context, delivery approach, and intended operational value.</p></div>
    <div className="next-case-study-grid">
      <div className="next-case-study-story">
        <article><span>Challenge</span><p>{challenge}</p></article>
        <article><span>Approach</span><p>{approach}</p></article>
        <article><span>Outcome focus</span><p>{outcome}</p></article>
        <div className="next-case-study-tech"><span className="next-eyebrow">Technology used</span><div>{technologies.map((technology) => <span className="next-tag" key={technology}>{technology}</span>)}</div></div>
      </div>
      <figure className="next-case-study-preview">
        <div className="next-case-study-logo"><Image src={image} alt={imageAlt} fill sizes="(max-width: 800px) 100vw, 40vw" /></div>
        <figcaption><span>Illustrative workflow snapshot</span><ol>{workflow.map((step) => <li key={step}>{step}</li>)}</ol></figcaption>
      </figure>
    </div>
  </section>;
}
