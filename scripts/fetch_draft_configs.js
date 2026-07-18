const SUPABASE_URL = "https://kicvenppgjvzqpyagdih.supabase.co";
const ANON_KEY = "sb_publishable_m_ZKKwBPnnKQIk9GGqJ36w_AmFoqGLf";

async function main() {
  const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json'
  };

  const shopSlug = "arigatosan";
  
  console.log("Fetching shop info...");
  const shopsRes = await fetch(`${SUPABASE_URL}/rest/v1/shops?slug=eq.${shopSlug}&select=id,name`, { headers });
  const shops = await shopsRes.json();
  if (!shops || shops.length === 0) {
    console.error("Shop not found.");
    process.exit(1);
  }
  const shopId = shops[0].id;
  console.log(`Shop ID: ${shopId}`);

  console.log("Querying gacha_game_configs for drafts...");
  const draftRes = await fetch(`${SUPABASE_URL}/rest/v1/gacha_game_configs?shop_id=eq.${shopId}&select=*`, { headers });
  const draftText = await draftRes.text();
  console.log("gacha_game_configs response:", draftText);
}

main().catch(err => {
  console.error("Error:", err);
});
