const API_ROOT = "https://api.cloudflare.com/client/v4";

export function pagesDeploymentsUrl(accountId, projectName) {
  return `${API_ROOT}/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}/deployments?env=production&per_page=1`;
}

export function pagesRollbackUrl(accountId, projectName, deploymentId) {
  return `${API_ROOT}/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}/deployments/${encodeURIComponent(deploymentId)}/rollback`;
}

export function parseCloudflareApiResponse(payload, operation) {
  if (!payload || payload.success !== true) {
    const details = [...(payload?.errors ?? []), ...(payload?.messages ?? [])]
      .map((item) => item?.message ?? JSON.stringify(item))
      .filter(Boolean)
      .join("; ");
    throw new Error(
      `${operation} failed${details ? `: ${details}` : " with an invalid API response"}`,
    );
  }
  return payload.result;
}

export async function waitForPagesDeployment({
  accountId,
  apiToken,
  projectName,
  deploymentId,
  fetchImpl = fetch,
  attempts = 20,
  delayMs = 3_000,
  sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  let lastId = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetchImpl(
      pagesDeploymentsUrl(accountId, projectName),
      {
        headers: { Authorization: `Bearer ${apiToken}` },
      },
    );
    if (!response.ok)
      throw new Error(`deployment lookup returned HTTP ${response.status}`);
    const result = parseCloudflareApiResponse(
      await response.json(),
      "deployment lookup",
    );
    const current = Array.isArray(result) ? result[0] : result;
    lastId = current?.id ?? "";
    if (lastId === deploymentId) return current;
    if (attempt < attempts) await sleep(delayMs);
  }
  throw new Error(
    `deployment ${deploymentId} was not active after ${attempts} checks (active: ${lastId || "none"})`,
  );
}
