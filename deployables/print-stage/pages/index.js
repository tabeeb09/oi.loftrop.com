import Head from "next/head";

import SiteShell from "../components/SiteShell";
import styles from "../styles/Home.module.css";

export default function Home() {
  return (
    <SiteShell title="3D Printer">
      <Head>
        <title>3D Printer</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Local project</p>
        <h1 className={styles.title}>3D Printer</h1>
        <p className={styles.description}>
          This duplicate only carries the minimal auth shell: homepage, hamburger menu, sign-in,
          and the authenticated file manager.
        </p>
      </section>
    </SiteShell>
  );
}
