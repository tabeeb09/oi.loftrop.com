"use client";

import AuthNav from "@/components/AuthNav";
import VerticalNavBar from "@/components/VerticalNavBartest";
import dynamic from "next/dynamic";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), { ssr: false });

export default function Home() {
  return (
    <div className="app-shell">
      <VerticalNavBar />

      <main className="app-main">
        

        <div className="app-content">
          <div className="pdf-wrap">
            <PdfViewer url="/pdfs/Climate Data Analysis.pdf" />
          </div>
        </div>
      </main>
    </div>
  );
}
