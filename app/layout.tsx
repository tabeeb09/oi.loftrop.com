import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers/SessionProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VerticalNavBar from "@/components/VerticalNavBartest";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

export const metadata: Metadata = {
  title: {
    default: "Tabeeb Rahman",
    template: "%s | Tabeeb Rahman",
  },
  description: "Portfolio and research projects",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <div className="app-shell">
            <VerticalNavBar />
            <Header />
            <main className="app-main">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
