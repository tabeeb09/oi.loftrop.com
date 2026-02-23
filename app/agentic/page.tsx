"use client";

import AuthNav from "@/components/AuthNav";
import VerticalNavBar from "@/components/VerticalNavBartest";
import SectionBlock from "@/components/SectionBlock";

export default function AgenticWebAutomationPage() {
  return (
    <div className="app-shell">
      <VerticalNavBar />

      <main className="app-main">
        {/* Top header/nav area consistent with other pages */}
        <AuthNav />

        <div className="container py-4">
          {/* Page Hero/Header */}
          <section className="row g-4 align-items-center mb-5">
            <div className="col-12">
              <h1 className="display-5 fw-bold mb-3">
                Local Agentic Web Automation with Multimodal LLMs
              </h1>
              <p className="lead mb-0">
                A locally runnable, GUI-driven agentic automation pipeline combining
                fine-tuned multimodal models, classical NLP methods, and a custom
                Playwright-based query tool to improve efficiency, reduce hallucination,
                and scale complex web workflows.
              </p>
            </div>
          </section>

          <SectionBlock title="Overview">
            <p>
              With the advent of LLMs and their increasingly capable general-purpose
              automation abilities, there is a growing body of work aimed at extending
              their problem-solving ability into broader real-world domains. One of the
              most valuable of these is web navigation through human interfaces and GUIs.
            </p>
            <p className="mb-0">
              I present an agentic pipeline that demonstrates strong performance while
              running locally on consumer hardware, using fine-tuned{" "}
              <strong>Qwen 1.5B</strong> multimodal models with a hybrid vision tokeniser,
              building on work from <strong>VLM FO1</strong>.
            </p>
          </SectionBlock>

          <SectionBlock title="Core Method">
            <p>
              The system hybridises fine-tuned multimodal models with lower-cost
              techniques such as NLP and smaller non-multimodal models, using the most
              capable models only when necessary.
            </p>
            <p>
              A central focus of the project is reducing total token usage while
              maintaining strong task success in multi-step web navigation workflows.
            </p>
            <ul className="mb-0">
              <li>Model routing to minimise expensive calls</li>
              <li>Token-count optimisation across long task chains</li>
              <li>Hybrid LLM + classical methods pipeline design</li>
              <li>Higher reliability through targeted page queries</li>
            </ul>
          </SectionBlock>

          <SectionBlock title="Custom Web Query Tool">
            <p>
              The work includes an advanced web query tool with a custom query language,
              built from the ground up on top of <strong>Playwright</strong>. It allows
              agents to request only the information they need from a page, instead of
              consuming the full DOM or page source.
            </p>
            <p>
              Thanks to VLM FO1’s positional accuracy when locating task-relevant GUI
              features, the system achieves lower hallucination and improved task success
              in UI-driven interaction.
            </p>
            <p className="mb-0">
              The tool also includes a selective crawler supporting composite crawling
              instructions, with sanitised outputs tailored for language models (for
              example, omitting unnecessary HTML/XML content after a targeted extraction).
            </p>
          </SectionBlock>

          <SectionBlock title="Multi-Agent Orchestration">
            <p>
              The query tool exposes a multi-agent orchestration command that allows
              agents to pass information, issue commands, and spawn additional agent
              instances as needed.
            </p>
            <p className="mb-0">
              This enables decomposition of large workflows into coordinated subtasks
              while preserving structured outputs and controllable execution.
            </p>
          </SectionBlock>

          <SectionBlock title="Example Workflow">
            <p>
              A representative use case is autonomous large-scale job discovery and
              filtering across hundreds of companies.
            </p>
            <ol>
              <li>Generate a whitelist of valuable target companies</li>
              <li>Use DuckDuckGo to locate each company’s careers site</li>
              <li>Navigate intermediary landing pages and dynamic flows</li>
              <li>Apply target filters (e.g. location, job category)</li>
              <li>Traverse paginated listings and extract entries</li>
              <li>Output structured JSON</li>
              <li>
                Apply NLP-based categorisation and ranking (company, role type, deadline,
                proximity, candidate suitability score)
              </li>
            </ol>
            <p>
              Candidate suitability scoring is based on NLP-style comparison between job
              descriptions and the candidate’s skills/CV.
            </p>
            <p className="mb-0">
              The system can also attempt automated application submission, but CAPTCHA
              handling is not implemented, so this stage currently fails in many cases.
            </p>
          </SectionBlock>

          <SectionBlock title="Performance and Research Value">
            <p>
              This approach is conceptually similar to operator-style systems in which a
              model interacts with GUI environments using visual grounding and tool use.
              While proprietary implementations are not public, this work provides a
              practical educational and research framework that plausibly explains how
              such systems may operate.
            </p>
            <p>
              If roughly <strong>60% task success</strong> can be achieved with a{" "}
              <strong>1.5B</strong> fine-tuned model running locally, it is not surprising
              that much larger proprietary models could approach near-complete task
              coverage for constrained web automation workflows.
            </p>
            <p className="mb-0">
              The project demonstrates capability in multimodal LLM integration, agentic
              systems design, and building supporting infrastructure that materially
              improves model efficiency and reliability.
            </p>
          </SectionBlock>

          <SectionBlock title="Local-First Constraint and Support">
            <p>
              A key strength of the work is its performance relative to compute budget:
              it runs locally, including on laptop-class hardware.
            </p>
            <p>
              I am currently financially and computationally constrained from running
              broader experiments with larger models. If you are interested in supporting
              this work (including compute access or research funding), I would greatly
              appreciate it.
            </p>
            <p className="mb-0">
              If this project aligns with your interests and you think I may be a strong
              fit for an AI/agentic systems role, please get in touch.
            </p>
          </SectionBlock>
        </div>
      </main>
    </div>
  );
}