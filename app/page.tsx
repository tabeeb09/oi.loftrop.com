import { papers } from "@/src/lib/papers";
import { resourceUrl } from "@/src/lib/resource-schema";
import StoryFeatureGrid from "@/components/StoryFeatureGrid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bestGrades = [
  { module: "Scientific Presentation", grade: "100%" },
  { module: "Climate Change Advanced Data Analysis", grade: "90%", href: "/climate_data_analysis" },
  { module: "Reflectance in Dielectric Structures", grade: "75%", href: "/reflectance" },
  { module: "Memristive Machine Learning Thesis", grade: "73%", href: "/neuromorphic" },
  { module: "Mathematical Modelling", grade: "70%" },
];

const skills = [
  ["Web", "Next.js, React, TypeScript, NextAuth, Playwright"],
  ["Backend", "Node.js, Python, Bash, PowerShell, REST APIs"],
  ["Identity and security", "Keycloak, OpenBao, OAuth2 Proxy, OAuth/OIDC, Stripe"],
  ["Storage", "RustFS, Supabase Storage, S3, AWS SDK, presigned URLs"],
  ["Infrastructure", "Docker, Docker Compose, GitHub Actions, Terraform, Hetzner Cloud, Cloudflare DNS, Caddy"],
  ["Data science", "Python, Pandas, SciPy, TensorFlow, PyTorch, MATLAB"],
  ["Engineering", "Fusion 360, AutoCAD, OrcaSlicer, Bambu Lab X1 Carbon, 3MF/STL workflows"],
];

const leadStories = [
  {
    href: "/neuromorphic",
    label: "Technical report",
    title: papers.neuromorphic.title,
    summary:
      "A report on memristive devices, spiking neural networks, and neuromorphic approaches to efficient computation.",
    heroImageUrl: resourceUrl(papers.neuromorphic.heroResourceId),
    heroImagePosition: "100% center",
    heroImageSize: "80% auto",
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
    heroImageUrl: resourceUrl("image.printFarmMakerspace"),
    heroTone: "auto" as const,
  },
  {
    href: "/reflectance",
    label: "Computational physics",
    title: papers.reflectance.title,
    summary:
      "Transfer-matrix modelling of dielectric coatings, from anti-reflection layers to multilayer dielectric mirrors.",
    heroImageUrl: resourceUrl("image.reflectanceDielectricMirror"),
    heroTone: "auto" as const,
  },
  {
    href: "/climate_data_analysis",
    label: "Data analysis",
    title: papers.climate.title,
    summary:
      "A scientific computing project that frames climate observations through analysis, modelling, and report presentation.",
    heroImageUrl: resourceUrl("image.climateForest"),
    heroTone: "auto" as const,
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
            BSc Mathematics & Physics Graduate from the University of Bath (2:1).
          </p>
        </div>
        <figure>
          <img src={resourceUrl("image.profile")} alt="Tabeeb Rahman" />
          <figcaption>BSc Mathematics & Physics, University of Bath (2:1).</figcaption>
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
