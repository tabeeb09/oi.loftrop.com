# S3 Project Storage

The website supports S3-compatible storage backends such as RustFS, MinIO, or AWS S3.

## Project isolation

Existing deployments keep working with the legacy bucket names:

```env
S3_BUCKET=public-media
S3_PRIVATE_BUCKET=private-user-files
```

New deployments can isolate each site either by bucket or by prefix:

```env
STORAGE_PROJECT=portfolio
S3_PUBLIC_BUCKET=portfolio-public-media
S3_PRIVATE_BUCKET=portfolio-private-files
S3_PROJECT_KEY_PREFIX=sites/portfolio
NEXT_PUBLIC_MEDIA_BUCKET=portfolio-public-media
NEXT_PUBLIC_MEDIA_KEY_PREFIX=sites/portfolio
```

`S3_PUBLIC_KEY_PREFIX` and `S3_PRIVATE_KEY_PREFIX` can override `S3_PROJECT_KEY_PREFIX`
when public and private objects need different layouts.

## Migration

Use a dry-run first:

```powershell
$env:S3_TARGET_ENDPOINT="https://new-s3.example.com"
$env:S3_TARGET_ACCESS_KEY_ID="target-access-key"
$env:S3_TARGET_SECRET_ACCESS_KEY="target-secret-key"
$env:S3_TARGET_PUBLIC_BUCKET="portfolio-public-media"
$env:S3_TARGET_PRIVATE_BUCKET="portfolio-private-files"
$env:S3_TARGET_PROJECT_KEY_PREFIX="sites/portfolio"
npm run migrate:s3-project -- --dry-run
```

Then run the copy:

```powershell
npm run migrate:s3-project
```

The source is the normal `S3_*` config. The target uses `S3_TARGET_*`.
Private file manifests are rewritten during migration so their stored bucket and object keys point
at the target private bucket/prefix.
