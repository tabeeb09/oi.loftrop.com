import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const envSchema = z.object({
  NEXTAUTH_URL: optionalUrl,
  NEXTAUTH_SECRET: optionalNonEmptyString,
  KEYCLOAK_ISSUER: optionalUrl,
  KEYCLOAK_CLIENT_ID: optionalNonEmptyString,
  KEYCLOAK_CLIENT_SECRET: optionalNonEmptyString,
  KEYCLOAK_FILE_ADMIN_ROLES: z.string().default("owner,technician,print_admin,media_admin"),
  KEYCLOAK_QUEUE_ADMIN_ROLES: z.string().default("owner,technician,print_admin"),
  KEYCLOAK_ROLE_CLAIM_PATH: z.string().default("resource_access.website.roles"),
  KEYCLOAK_FILE_UPLOAD_LIMIT_CLAIMS: z
    .string()
    .default("file_upload_limit_bytes,fileUploadLimitBytes"),
  SUPERADMIN_EMAILS: z.string().default("tabeebrahman.logistics@gmail.com"),
  S3_ENDPOINT: optionalUrl,
  S3_PRIVATE_BUCKET: optionalNonEmptyString,
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: optionalNonEmptyString,
  S3_SECRET_ACCESS_KEY: optionalNonEmptyString,
  FILE_UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(262144000),
  FILE_ALLOWED_MIME_TYPES: z.string().default(""),
  FILE_ALLOWED_EXTENSIONS: z
    .string()
    .default("3mf,stl,obj,step,stp,iges,igs,ply,amf,gcode"),
});

export const env = envSchema.parse(process.env);

export function parseCsv(value) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
