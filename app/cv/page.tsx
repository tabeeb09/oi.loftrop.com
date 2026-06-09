import AuthNav from "@/components/AuthNav";
import VerticalNavBar from "@/components/VerticalNavBartest";
import { requireAllowed } from "@/components/requireAllowed";
import CvPdfClient from "@/components/CvPdfClient";
import { mediaUrl } from "@/src/lib/media-url";


export default async function Home() {
  await requireAllowed();

  return (
    <div className="app-shell">
      <VerticalNavBar />

      <main className="app-main">

        <div className="app-content">
          <div className="pdf-wrap">
            <CvPdfClient url={mediaUrl("pdfs/cv.pdf")} />
          </div>
        </div>
      </main>
    </div>
  );
}
