"use client";

import VerticalNavBar from "@/components/VerticalNavBartest";
import { mediaUrl } from "@/src/lib/media-url";
import dynamic from "next/dynamic";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), { ssr: false });

export default function NeuromorphicPage() {
  return (
    <div className="app-shell">
      <VerticalNavBar />
      <main className="app-main">
        <div className="app-content">
          <h1>Memristors & Spiking Neural Nets</h1>
          <p>
            This report covers memristive systems and spiking neural network research.
          </p>
          <div className="pdf-wrap">
            <PdfViewer url={mediaUrl("pdfs/RahmanTabeebReport.pdf")} />
          </div>
        </div>
      </main>
    </div>
  );
}
