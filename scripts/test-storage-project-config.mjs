import assert from "node:assert/strict";

import {
  fromStorageObjectKey,
  getStorageProjectConfig,
  toStorageObjectKey,
} from "./lib/storage-project.mjs";

const source = {
  STORAGE_PROJECT: "portfolio",
  S3_ENDPOINT: "http://rustfs:9000",
  S3_PUBLIC_ENDPOINT: "https://media.example.com",
  S3_PUBLIC_BUCKET: "portfolio-public",
  S3_PRIVATE_BUCKET: "portfolio-private",
  S3_PROJECT_KEY_PREFIX: "sites/portfolio",
  S3_ACCESS_KEY_ID: "access",
  S3_SECRET_ACCESS_KEY: "secret",
};

const config = getStorageProjectConfig({ source });

assert.equal(config.project, "portfolio");
assert.equal(config.publicBucket, "portfolio-public");
assert.equal(config.privateBucket, "portfolio-private");
assert.equal(config.publicKeyPrefix, "sites/portfolio");
assert.equal(config.privateKeyPrefix, "sites/portfolio");

const publicKey = toStorageObjectKey(config.publicKeyPrefix, "papers/demo.pdf");
assert.equal(publicKey, "sites/portfolio/papers/demo.pdf");
assert.equal(fromStorageObjectKey(config.publicKeyPrefix, publicKey), "papers/demo.pdf");

const target = getStorageProjectConfig({
  prefix: "S3_TARGET",
  fallback: config,
  source: {
    ...source,
    S3_TARGET_ENDPOINT: "https://new-s3.example.com",
    S3_TARGET_BUCKET: "new-public",
    S3_TARGET_PRIVATE_BUCKET: "new-private",
    S3_TARGET_PROJECT_KEY_PREFIX: "sites/new-portfolio",
    S3_TARGET_ACCESS_KEY_ID: "target-access",
    S3_TARGET_SECRET_ACCESS_KEY: "target-secret",
  },
});

assert.equal(target.endpoint, "https://new-s3.example.com");
assert.equal(target.publicBucket, "new-public");
assert.equal(target.privateBucket, "new-private");
assert.equal(target.publicKeyPrefix, "sites/new-portfolio");
assert.equal(
  toStorageObjectKey(target.privateKeyPrefix, "private/system/files/manifests/file.json"),
  "sites/new-portfolio/private/system/files/manifests/file.json",
);

console.log("storage project config tests passed");
