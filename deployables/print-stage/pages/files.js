import Head from "next/head";
import { getServerSession } from "next-auth/next";

import FileManager from "../components/FileManager";
import { authOptions } from "../lib/authOptions";
import { env } from "../lib/env";
import SiteShell from "../components/SiteShell";

function formatBytes(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "unknown";
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(0)} MB`;
}

export default function FilesPage({ uploadLimitBytes }) {
  return (
    <SiteShell title="3D Printer">
      <Head>
        <title>My files | 3D Printer</title>
      </Head>

      <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
        <h1>User files</h1>
        <p style={{ maxWidth: "50rem" }}>
          Private uploads stay scoped to the authenticated Keycloak user. Download URLs are
          short-lived and are generated only after server-side authorization. Files can also be
          submitted into the print queue from here.
        </p>
        <p style={{ maxWidth: "50rem", color: "#555" }}>
          Storage provider: <strong>s3</strong>
        </p>
        <p style={{ maxWidth: "50rem", color: "#555" }}>
          Upload limit for this account: <strong>{formatBytes(uploadLimitBytes)}</strong>
        </p>
        <FileManager />
      </div>
    </SiteShell>
  );
}

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: "/api/auth/signin?callbackUrl=%2Ffiles",
        permanent: false,
      },
    };
  }

  return {
    props: {
      uploadLimitBytes:
        typeof session.user?.uploadLimitBytes === "number" && session.user.uploadLimitBytes > 0
          ? session.user.uploadLimitBytes
          : env.FILE_UPLOAD_MAX_BYTES,
    },
  };
}
