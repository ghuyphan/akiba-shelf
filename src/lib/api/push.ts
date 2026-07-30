import { extractEdgeFunctionError, requireSupabase } from "./shared";
import {
  pushRegisterResultSchema,
  pushStatusResultSchema,
  pushUnregisterResultSchema,
} from "../schemas";

async function invokePushAction(body: Record<string, unknown>) {
  const { data, error } = await requireSupabase().functions.invoke(
    "push-subscriptions",
    { body },
  );
  if (error) {
    const message = await extractEdgeFunctionError(error);
    throw new Error(message ?? "Push notifications could not be updated.");
  }
  return data;
}

export async function getPushRegistrationStatus(
  shopId: string,
  endpoint: string,
) {
  const result = await invokePushAction({ action: "status", shopId, endpoint });
  return pushStatusResultSchema.parse(result).enabled;
}

export async function registerPushSubscription(
  shopId: string,
  subscription: PushSubscription,
) {
  const json = subscription.toJSON();
  const result = await invokePushAction({
    action: "register",
    shopId,
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    userAgent: navigator.userAgent,
  });
  pushRegisterResultSchema.parse(result);
}

export async function unregisterPushSubscription(
  shopId: string,
  endpoint: string,
) {
  const result = await invokePushAction({
    action: "unregister",
    shopId,
    endpoint,
  });
  return pushUnregisterResultSchema.parse(result).unsubscribe;
}
