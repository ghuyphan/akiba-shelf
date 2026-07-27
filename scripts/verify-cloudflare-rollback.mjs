import { waitForPagesDeployment } from "./cloudflare-pages-api.mjs";

await waitForPagesDeployment({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
  projectName: "matsuri",
  deploymentId: process.env.PREVIOUS_DEPLOYMENT_ID,
});
