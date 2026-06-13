import resourceSchemaData from "@/src/lib/resource-schema-data.json";

const defaultMediaBaseUrl = "https://media.loftrop.com";
const defaultBucket = "public-media";

export type ResourceKind = "image" | "icon" | "pdf" | "presentation" | "static";

export type SiteResource = {
  id: string;
  kind: ResourceKind;
  title: string;
  key: string;
  localPath?: string;
  description?: string;
};

export const siteResources = resourceSchemaData as SiteResource[];

export type ResourceId =
  | "icon.home"
  | "icon.portfolio"
  | "icon.page"
  | "icon.prototypePortfolio"
  | "icon.file"
  | "icon.globe"
  | "icon.next"
  | "image.profile"
  | "image.teamBathUav"
  | "pdf.hhg"
  | "pdf.climate"
  | "pdf.cv"
  | "pdf.neuromorphic"
  | "presentation.hhg"
  | "static.vercel"
  | "static.window";

export function resourceById(id: ResourceId) {
  const resource = siteResources.find((item) => item.id === id);

  if (!resource) {
    throw new Error(`Unknown site resource: ${id}`);
  }

  return resource;
}

export function mediaBaseUrl() {
  return (process.env.NEXT_PUBLIC_MEDIA_BASE_URL || defaultMediaBaseUrl).replace(/\/+$/, "");
}

export function mediaBucket() {
  return process.env.NEXT_PUBLIC_MEDIA_BUCKET || defaultBucket;
}

export function resourceUrl(id: ResourceId) {
  const resource = resourceById(id);
  return `${mediaBaseUrl()}/${mediaBucket()}/${resource.key.replace(/^\/+/, "")}`;
}

export function resourceUrlFromKey(key: string) {
  return `${mediaBaseUrl()}/${mediaBucket()}/${key.replace(/^\/+/, "")}`;
}
