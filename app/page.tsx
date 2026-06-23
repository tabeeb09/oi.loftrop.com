import { papers } from "@/src/lib/papers";
import { resourceUrl } from "@/src/lib/resource-schema";
import StoryFeatureGrid from "@/components/StoryFeatureGrid";

const bestGrades = [
  { module: "Scientific Presentation", grade: "100%" },
  { module: "Climate Change Advanced Data Analysis", grade: "90%", href: "/climate_data_analysis" },
  { module: "Reflectance in Dielectric Structures", grade: "75%", href: "/reflectance" },
  { module: "Scientific Computing", grade: "75%" },
  { module: "Mathematical Modelling", grade: "70%" },
];

const skills = [
  ["Software", "Next.js, React, TypeScript, Docker, PostgreSQL"],
  ["Data science", "Python, Pandas, SciPy, TensorFlow, PyTorch"],
  ["Infrastructure", "GitHub Actions, OpenBao, Keycloak, RustFS, Caddy"],
  ["Engineering", "Fusion 360, AutoCAD, MATLAB, parametric modelling"],
];

const leadStories = [
  {
    href: "/neuromorphic",
    label: "Technical report",
    title: papers.neuromorphic.title,
    summary:
      "A report on memristive devices, spiking neural networks, and neuromorphic approaches to efficient computation.",
    heroImageUrl: resourceUrl(papers.neuromorphic.heroResourceId),
    heroTone: "auto" as const,
  },
  {
    href: "/hhg",
    label: "Research",
    title: papers.hhg.title,
    summary:
      "Experimental physics and data analysis notes from the ORBYTS programme, with the source report embedded.",
    heroImageUrl: resourceUrl(papers.hhg.heroResourceId),
    heroTone: "auto" as const,
  },
  {
    href: "https://print.loftrop.com",
    label: "Fabrication",
    title: "Print farm",
    summary:
      "A backend-sliced print submission service for quoting, payment, queueing, and managed print execution.",
  },
  {
    href: "/reflectance",
    label: "Computational physics",
    title: papers.reflectance.title,
    summary:
      "Transfer-matrix modelling of dielectric coatings, from anti-reflection layers to multilayer dielectric mirrors.",
  },
  {
    href: "/climate_data_analysis",
    label: "Data analysis",
    title: papers.climate.title,
    summary:
      "A scientific computing project that frames climate observations through analysis, modelling, and report presentation.",
  },
];

export default function Home() {
  return (
    <div className="home-page editorial-page">
      <section className="home-masthead">
        <div>
          <p className="eyebrow">Portfolio journal</p>
          <h1>Tabeeb Rahman</h1>
          <p className="home-deck">
            Software engineer, data scientist, physicist, and mathematician. This site presents
            research artifacts as journal-style papers backed by a self-hosted media registry.
          </p>
        </div>
        <figure>
          <img src={resourceUrl("image.profile")} alt="Tabeeb Rahman" />
          <figcaption>Mathematics with Physics, University of Bath.</figcaption>
        </figure>
      </section>

      <StoryFeatureGrid stories={leadStories} />

      <section className="home-band">
        <div>
          <p className="eyebrow">Education</p>
          <h2>University of Bath</h2>
          <p>Graduated in 2026 in Mathematics with Physics, with portfolio work spanning software, data science, and computational physics.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Selected module</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            {bestGrades.map((grade) => (
              <tr key={grade.module}>
                <td>
                  {grade.href ? <a href={grade.href}>{grade.module}</a> : grade.module}
                </td>
                <td>{grade.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="home-columns">
        <article>
          <p className="eyebrow">Engineering record</p>
          <h2>Project lead, Team Bath Drones</h2>
          <img src={resourceUrl("image.teamBathUav")} alt="Team Bath UAV competition team" />
          <p>
            Led a four-person UAV engineering group and delivered a thermoelectric payload
            mechanism with a 40% weight reduction over the previous design.
          </p>
        </article>
        <article>
          <p className="eyebrow">Methods</p>
          <h2>Skills and tooling</h2>
          <dl className="skill-list">
            {skills.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </article>
      </section>
    </div>
  );
}
