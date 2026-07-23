import { extractEdgeFunctionError, requireSupabase } from "./shared";

type PushActionResult = {
  outcome?: string;
  enabled?: boolean;
  unsubscribe?: boolean;
};

async function invokePushAction(body: Record<string, unknown>) {
  const { data, error } = await requireSupabase().functions.invoke(
    "push-subscriptions",
    { body },
  );
  if (error) {
    const message = await extractEdgeFunctionError(error);
    throw new Error(message ?? "Push notifications could not be updated.");
  }
  return (data ?? {}) as PushActionResult;
}

export async function getPushRegistrationStatus(
  shopId: string,
  endpoint: string,
) {
  const result = await invokePushAction({ action: "status", shopId, endpoint });
  return result.enabled === true;
}

export async function registerPushSubscription(
  shopId: string,
  subscription: PushSubscription,
) {
  const json = subscription.toJSON();
  await invokePushAction({
    action: "register",
    shopId,
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    userAgent: navigator.userAgent,
  });
}

export async function unregisterPushSubscription(
  shopId: string,
  endpoint: string,
) {
  const result = await invokePushAction({ action: "unregister", shopId, endpoint });
  return result.unsubscribe === true;
}
