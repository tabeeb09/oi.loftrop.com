import AuthNav from "@/components/AuthNav";
import VerticalNavBar from "@/components/VerticalNavBartest";
import { requireAllowed } from "@/components/requireAllowed";
import CvPdfClient from "@/components/CvPdfClient";

export default async function Home() {
  await requireAllowed();

  return (
    <div className="app-shell">
      <VerticalNavBar />

      <main className="app-main">

        <div className="app-content">
          <div className="pdf-wrap">
            <CvPdfClient url="/pdfs/cv.pdf" />
          </div>
        </div>
      </main>
    </div>
  );
}
