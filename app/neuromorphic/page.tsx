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
          <div className="pdf-wrap">
            <PdfViewer url={mediaUrl("pdfs/RahmanTabeebReport.pdf")} />
          </div>
        </div>
      </main>
    </div>
  );
}
