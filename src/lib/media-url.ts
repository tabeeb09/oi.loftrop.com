const defaultMediaBaseUrl = "https://media.loftrop.com";

export function mediaUrl(key: string) {
  const baseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL || defaultMediaBaseUrl;
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedKey = key.replace(/^\/+/, "");

  return `${normalizedBase}/public-media/${normalizedKey}`;
}
