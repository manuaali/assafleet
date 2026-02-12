/// <reference lib="webworker" />
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

declare global {
  interface ServiceWorkerRegistration {
    pushManager: PushManager;
  }
}

// VAPID public key (safe to store in frontend code)
const VAPID_PUBLIC_KEY = "BMLCoBu5KY9FsxJKI8GXIHvT8N9XHrOwLqaONKbtg_1DL_DCmBZk4xKgPDS4i9QIa0577Pl2L6IiMDGGwiwZ39k";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Check if it exists in our DB
        const { data } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint)
          .maybeSingle();
        
        setIsSubscribed(!!data);
      } else {
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error("Error checking push subscription:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const subscribe = useCallback(async () => {
    if (!user || !isSupported) return false;

    try {
      setIsLoading(true);

      // Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      
      if (perm !== "granted") {
        return false;
      }

      // Get VAPID public key
      const vapidKey = VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error("VAPID public key not configured");
        return false;
      }

      // Register service worker if not already
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      const subscriptionJson = subscription.toJSON();

      // Save to database
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscriptionJson.keys?.p256dh || "",
          auth: subscriptionJson.keys?.auth || "",
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) throw error;

      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error("Error subscribing to push notifications:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!user) return false;

    try {
      setIsLoading(true);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Remove from database
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);

        // Unsubscribe from push
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error("Error unsubscribing from push notifications:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
  };
}
