const base = process.env.KEYCLOAK_ADMIN_BASE_URL || "http://localhost:8080";
const adminUsername = process.env.KEYCLOAK_ADMIN_USERNAME || "admin";
const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || "admin";
const realmName = process.env.KEYCLOAK_TEST_REALM || "website";
const websiteClientSecret =
  process.env.KEYCLOAK_CLIENT_SECRET || "a3OVQmXeYcsrggkJbIczHi1vFCG5SxNh";
const localRedirectUris = [
  "http://localhost:3000/api/auth/callback/keycloak",
  "http://localhost:3001/api/auth/callback/keycloak",
  "http://127.0.0.1:3000/api/auth/callback/keycloak",
  "http://127.0.0.1:3001/api/auth/callback/keycloak",
];
const localWebOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];
const localPostLogoutRedirectUris = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
].join("##");

async function getAdminToken() {
  const response = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "admin-cli",
      username: adminUsername,
      password: adminPassword,
      grant_type: "password",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain Keycloak admin token (${response.status}).`);
  }

  const payload = await response.json();
  return payload.access_token;
}

async function request(token, method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok && response.status !== 409) {
    throw new Error(`Keycloak request failed: ${method} ${path} (${response.status})`);
  }

  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function ensureRealm(token) {
  await request(token, "POST", "/admin/realms", {
    realm: realmName,
    enabled: true,
    registrationAllowed: true,
    registrationEmailAsUsername: true,
    loginWithEmailAllowed: true,
    duplicateEmailsAllowed: false,
    verifyEmail: false,
  });

  await request(token, "PUT", `/admin/realms/${realmName}`, {
    realm: realmName,
    enabled: true,
    registrationAllowed: true,
    registrationEmailAsUsername: true,
    loginWithEmailAllowed: true,
    duplicateEmailsAllowed: false,
    verifyEmail: false,
  });
}

async function ensureClient(token) {
  let clients = await request(
    token,
    "GET",
    `/admin/realms/${realmName}/clients?clientId=website`,
  );

  if (!Array.isArray(clients) || clients.length === 0) {
    await request(token, "POST", `/admin/realms/${realmName}/clients`, {
      clientId: "website",
      enabled: true,
      protocol: "openid-connect",
      publicClient: false,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      secret: websiteClientSecret,
      attributes: {
        "post.logout.redirect.uris": localPostLogoutRedirectUris,
      },
      redirectUris: localRedirectUris,
      webOrigins: localWebOrigins,
    });

    clients = await request(token, "GET", `/admin/realms/${realmName}/clients?clientId=website`);
  }

  const client = clients[0];
  await request(token, "PUT", `/admin/realms/${realmName}/clients/${client.id}`, {
    ...client,
    clientId: "website",
    enabled: true,
    protocol: "openid-connect",
    publicClient: false,
    standardFlowEnabled: true,
    directAccessGrantsEnabled: false,
    serviceAccountsEnabled: false,
    secret: websiteClientSecret,
    attributes: {
      "post.logout.redirect.uris": localPostLogoutRedirectUris,
    },
    redirectUris: localRedirectUris,
    webOrigins: localWebOrigins,
  });

  return client.id;
}

async function ensureRole(token, clientId, roleName) {
  await request(token, "POST", `/admin/realms/${realmName}/clients/${clientId}/roles`, {
    name: roleName,
  });
  return request(token, "GET", `/admin/realms/${realmName}/clients/${clientId}/roles/${roleName}`);
}

async function ensureUserAttributeMapper(token, clientId, mapperName, userAttribute, claimName) {
  const existing =
    (await request(
      token,
      "GET",
      `/admin/realms/${realmName}/clients/${clientId}/protocol-mappers/models`,
    )) || [];

  const body = {
    name: mapperName,
    protocol: "openid-connect",
    protocolMapper: "oidc-usermodel-attribute-mapper",
    consentRequired: false,
    config: {
      "user.attribute": userAttribute,
      "claim.name": claimName,
      "jsonType.label": "String",
      "id.token.claim": "true",
      "access.token.claim": "true",
      "userinfo.token.claim": "true",
    },
  };

  const found = Array.isArray(existing) ? existing.find((item) => item?.name === mapperName) : null;

  if (found?.id) {
    await request(
      token,
      "PUT",
      `/admin/realms/${realmName}/clients/${clientId}/protocol-mappers/models/${found.id}`,
      { ...found, ...body },
    );
    return;
  }

  await request(
    token,
    "POST",
    `/admin/realms/${realmName}/clients/${clientId}/protocol-mappers/models`,
    body,
  );
}

async function ensureUser(token, clientId, user) {
  let users = await request(
    token,
    "GET",
    `/admin/realms/${realmName}/users?username=${encodeURIComponent(user.username)}`,
  );

  if (!Array.isArray(users) || users.length === 0) {
    await request(token, "POST", `/admin/realms/${realmName}/users`, {
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      enabled: true,
      emailVerified: true,
    });

    users = await request(
      token,
      "GET",
      `/admin/realms/${realmName}/users?username=${encodeURIComponent(user.username)}`,
    );
  }

  const foundUser = users[0];

  await request(token, "PUT", `/admin/realms/${realmName}/users/${foundUser.id}`, {
    id: foundUser.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    enabled: true,
    emailVerified: true,
    attributes: user.attributes ?? {},
  });

  await request(token, "PUT", `/admin/realms/${realmName}/users/${foundUser.id}/reset-password`, {
    type: "password",
    value: user.password,
    temporary: false,
  });

  const existingRoles =
    (await request(
      token,
      "GET",
      `/admin/realms/${realmName}/users/${foundUser.id}/role-mappings/clients/${clientId}`,
    )) || [];

  if (Array.isArray(existingRoles) && existingRoles.length) {
    await request(
      token,
      "DELETE",
      `/admin/realms/${realmName}/users/${foundUser.id}/role-mappings/clients/${clientId}`,
      existingRoles,
    );
  }

  const role = await ensureRole(token, clientId, user.role);
  await request(
    token,
    "POST",
    `/admin/realms/${realmName}/users/${foundUser.id}/role-mappings/clients/${clientId}`,
    [role],
  );

  return foundUser;
}

async function main() {
  const token = await getAdminToken();
  await ensureRealm(token);
  const clientId = await ensureClient(token);
  await ensureUserAttributeMapper(
    token,
    clientId,
    "file-upload-limit-bytes",
    "file_upload_limit_bytes",
    "file_upload_limit_bytes",
  );

  for (const role of [
    "owner",
    "media_admin",
    "editor",
    "viewer",
    "infra_admin",
    "identity_hr_manager",
    "config_admin",
    "audit_admin",
    "logging_admin",
    "openbao_admin",
    "rustfs_admin",
    "netbird_admin",
    "technician",
    "print_admin",
  ]) {
    await ensureRole(token, clientId, role);
  }

  await ensureUser(token, clientId, {
    username: "localtester",
    email: "localtester@example.com",
    firstName: "Local",
    lastName: "Tester",
    password: "LocalTest123!",
    role: "owner",
    attributes: {
      file_upload_limit_bytes: ["262144000"],
    },
  });

  await ensureUser(token, clientId, {
    username: "localtester2",
    email: "localtester2@example.com",
    firstName: "Local",
    lastName: "Tester Two",
    password: "LocalTest456!",
    role: "viewer",
    attributes: {
      file_upload_limit_bytes: ["1024"],
    },
  });

  console.log("Local Keycloak test users are ready.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
