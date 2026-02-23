"use client";
import { useEffect, useRef, useState } from "react";
import AuthNav from "@/components/AuthNav";
import VerticalNavBar from "@/components/VerticalNavBartest";
import HeroPhotoFrame from "@/components/HeroPhotoFrame";
import SectionBlock from "@/components/SectionBlock";
import SkillGroup from "@/components/SkillGroup";
import ExperienceCard from "@/components/ExperienceCard";

const bestGrades = [
  { module: "Scientific Presentation", grade: "100%" },
  { module: <><a href="/climate_data_analysis">Climate Change Advanced data analysis</a></>, grade: "90%" },
  { module: "Programmatic Astrophysics Modelling", grade: "84%" },
  { module: "Scientific computing", grade: "75%" },
  { module: "Mathematical modelling", grade: "70%" },
];

const skills = {
  "Web Development": [
    "Postgresql",
    "Docker",
    "Typescript / Javascript",
    "Next Auth",
    "React.js",
  ],
    "Databases & Caching": [  
      "Prisma",
      "Next.js",
      "HTML",
      "CSS",
      "WebGL/ammo.js",
      "Redis",
    ],
    "Computer Graphics": [
      "OpenGL/CL",
      "Bullet 3",
    ],
    "Cloud": [
      "GCP",
      "Azure",
      "GitHub actions",
    ],
    "Machine Learning": [
      "NLTK",
      "Tensor flow",
      "Pytorch",
      "Integrating LLM APIs, Google and OpenAI",
      "Vision Language Model fine tuning",
      "Online learning using Spiking Hopfield Networks",
      "Spiking Neural Networks",
    ],
    "Programming Languages": [
      "Type script/ Javascript",
      "Python",
      "C/C++/C#",
    ],

  "Engineering": [
    "Parametric modelling",
    "Fusion 360",
    "FreeFem",
    "AutoCAD",
    "Matlab"
  ]
}




export default function Home() {
 const [navExpanded, setNavExpanded] = useState(true);

 const mainRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (navExpanded) {
    console.log("hello world1");
  }
}, [navExpanded]);

return (
  <div ref={mainRef} className="app-shell">
    <VerticalNavBar
  onExpandedChange={(expanded) => {
    console.log("PARENT CALLBACK FIRED:", expanded);
    setNavExpanded(expanded);
  }}
/>
      <main className="app-main">
        <div className="container py-4">      {/* Hero */}
          <section className="row g-4 align-items-center mb-5">
            <div className="col-12 col-md-4">
              <HeroPhotoFrame
                src="/images/tabeeb-photo.jpg"
                alt="Photo of Tabeeb Rahman"
                
              />
            </div>
            <div className="col-12 col-md-8">
              <h1 className="display-5 fw-bold mb-3">Tabeeb Rahman</h1>
              <p className="lead mb-0">
                Software engineer, Data scientist, Physicist, Mathematician.
              </p>
            </div>
          </section>

          {/* Education */}
          <SectionBlock title="Education">
            <p className="mb-3">
              <strong>University of Bath </strong>graduating in <strong>June 2026</strong>, with a{" "}
              <strong>predicted First</strong> in <strong>Mathematics with Physics</strong>.
            </p>

            <h3 className="h5 mb-3">Best Grades</h3>
            <div className="table-responsive">
              <table className="table table-sm table-striped align-middle mb-0">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th className="text-end">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {bestGrades.map((g) => (
                    <tr key={g.module}>
                      <td>{g.module}</td>
                      <td className="text-end fw-semibold">{g.grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionBlock>

          {/* Skills */}
          <SectionBlock title="Skills">
            <div className="row g-3">
              {Object.entries(skills).map(([category, items]) => (
                <div className="col-12 col-md-6" key={category}>
                  <SkillGroup title={category} items={items} />
                </div>
              ))}
            </div>
          </SectionBlock>

          {/* Work Experience */}
          <SectionBlock title="Work Experience">
            <div className="row g-4">
              <div className="col-12">
                <ExperienceCard
                  role={<a href="/hhg"><strong>Junior Data Analyst (Research)</strong></a>}
                  org="UCL / University of Zurich (ORBYTS Programme)"
                  meta="Competitive research placement"
                >
                  <p>
                    I was selected through a competitive process to contribute to
                    cutting-edge experimental physics and data science research on
                    subatomic particle behaviour. During the ORBYTS programme, I
                    analysed real high-energy XUV laboratory data to investigate
                    plasmonic ionisation and electron recombination in ultra-high
                    energy regimes.
                  </p>
                  <p>
                    I worked with <strong>TensorFlow</strong>, <strong>Pandas</strong>, and{" "}
                    <strong>SciPy</strong> to process and extract meaningful statistical
                    insights from terabytes of experimental data. Novel findings from the
                    broader collaboration contributed to a published quantum physics paper.
                  </p>
                  <p className="mb-0">
                    <a
                      href="https://iopscience.iop.org/article/10.1088/1361-6455/ac2e4a"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Published paper (IOP Science)
                    </a>
                  </p>
                </ExperienceCard>
              </div>

              <div className="col-12">
                <ExperienceCard
                  role={<strong>Project Lead</strong>}
                  org="Team Bath Drones"
                  meta="2023–2024 • 2nd place, IMechE European Division UAV Competition"
                  imageSrc="/images/team-bath-uav.jpg"
                  imageAlt="Team Bath UAV competition"
                  imageLink="https://www.bath.ac.uk/announcements/team-bath-drones-take-second-place-in-world-contest/"
                >
                  <p>
                    I led a team of 4 engineers in a multifaceted championship UAV campaign,
                    delivering innovative payload delivery mechanisms using thermoelectric
                    actuators designed from first principles.
                  </p>
                  <p>
                    My design achieved a <strong>40% weight reduction</strong> compared to
                    the previous design while improving reliability under dynamic, high-pressure
                    conditions and tightening inter-team workflows.
                  </p>
                  <p className="mb-0">
                    The work involved parametric design, joint rigging, and thermal-stress
                    simulation in CAD tools, drawing on a decade of experience with
                    Fusion 360 and AutoCAD.
                  </p>
                </ExperienceCard>
              </div>

              <div className="col-12">
                <ExperienceCard
                  role={<strong>Distinguished Delegate</strong>}
                  org="UNA-USA Model United Nations"
                  meta="Awarded among 250+ international competitors"
                >
                  <p>
                    After winning multiple Debatemate competitions and debating in Parliament,
                    I developed strong conflict-resolution and communication skills. A major
                    demonstration of this was my performance representing a sovereign delegate
                    in a UN-recognised nation simulation in 2018.
                  </p>
                  <p>
                    I was awarded <strong>Distinguished Delegate</strong>, outperforming
                    250 other international competitors in diplomacy and foreign relations.
                  </p>
                  <p className="mb-0">
                    Debating remains one of my core passions, and I continue to be involved
                    in competitive debating, with plans to participate in the Warwick Open.
                  </p>
                </ExperienceCard>
              </div>
            </div>
          </SectionBlock>
              </div>
      </main>
    </div>
  );
}
