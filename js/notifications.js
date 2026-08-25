/* =========================================================
   ALBUKHR NOTIFICATION ENGINE v3
   NETWORK-AWARE • SUPABASE CORE
   NO LOCALSTORAGE
========================================================= */

(function () {
  "use strict";

  const NOTIFICATION_TABLE = "notifications";
  const READ_TABLE = "notification_reads";

  function requireNetwork() {
    if (typeof window.requireAlbukhrNetwork !== "function") {
      throw new Error(
        "ALBUKHR Network Core is not loaded. Load environment-switcher.js before notifications.js."
      );
    }
    return window.requireAlbukhrNetwork();
  }

  function requireSupabase() {
    if (typeof window.requireAlbukhrSupabaseClient !== "function") {
      throw new Error(
        "ALBUKHR Supabase Core is not loaded. Load js/supabase-core.js before notifications.js."
      );
    }
    return window.requireAlbukhrSupabaseClient();
  }

  async function getCurrentUser() {
    try {
      if (typeof window.ensurePiAuth === "function") {
        const user = await window.ensurePiAuth();
        if (user?.uid) {
          return {
            uid: user.uid,
            username: user.username || "",
            wallet_address:
              user.wallet_address ||
              user.walletAddress ||
              ""
          };
        }
      }
    } catch (error) {
      console.warn(
        "ALBUKHR notifications: ensurePiAuth() was not ready.",
        error
      );
    }

    try {
      if (window.Pi && typeof window.Pi.getUser === "function") {
        const user = await window.Pi.getUser();
        if (user?.uid) {
          return {
            uid: user.uid,
            username: user.username || "",
            wallet_address:
              user.wallet_address ||
              user.walletAddress ||
              ""
          };
        }
      }
    } catch (error) {
      console.warn(
        "ALBUKHR notifications: Pi user unavailable.",
        error
      );
    }

    return null;
  }

  function normalizeNotification(row = {}) {
    return {
      id: row.id ?? null,
      title: row.title || "ALBUKHR Notification",
      message: row.message || row.description || "",
      date: row.date || row.created_at || null,
      created_at: row.created_at || row.date || null,
      network: row.network || null,
      active: row.active === undefined ? true : !!row.active,
      raw: row
    };
  }

  async function getNotifications(options = {}) {
    const supabase = requireSupabase();
    const network = requireNetwork();

    let query = supabase
      .from(NOTIFICATION_TABLE)
      .select("*")
      .eq("network", network);

    if (options.activeOnly !== false) {
      query = query.eq("active", true);
    }

    query = query.order(
      options.orderColumn || "created_at",
      { ascending: options.ascending === true }
    );

    const { data, error } = await query;

    if (error) {
      throw new Error(
        error.message || "Failed to load ALBUKHR notifications."
      );
    }

    return Array.isArray(data) ? data.map(normalizeNotification) : [];
  }

  async function getReadNotificationIds(userId = null) {
    const user = userId ? { uid: userId } : await getCurrentUser();

    if (!user?.uid) return [];

    const supabase = requireSupabase();
    const network = requireNetwork();

    const { data, error } = await supabase
      .from(READ_TABLE)
      .select("notification_id")
      .eq("user_id", user.uid)
      .eq("network", network);

    if (error) {
      throw new Error(
        error.message || "Failed to load notification read state."
      );
    }

    return Array.isArray(data)
      ? data
          .map(row => row.notification_id)
          .filter(id => id !== null && id !== undefined)
      : [];
  }

  async function getUnreadCount() {
    try {
      const notifications = await getNotifications();
      const user = await getCurrentUser();

      if (!user?.uid) return notifications.length;

      const readIds = await getReadNotificationIds(user.uid);
      const readSet = new Set(readIds.map(id => String(id)));

      return notifications.filter(
        notification => !readSet.has(String(notification.id))
      ).length;
    } catch (error) {
      console.error("ALBUKHR notification count:", error);
      return 0;
    }
  }

  async function updateNotificationBadge() {
    const badge = document.getElementById("notifBadge");
    if (!badge) return;

    const count = await getUnreadCount();

    if (count <= 0) {
      badge.style.display = "none";
      badge.textContent = "";
    } else {
      badge.style.display = "flex";
      badge.textContent = count > 99 ? "99+" : String(count);
    }
  }

  function openNotifications() {
    window.location.href = "news.html";
  }

  async function markNotificationRead(notificationId) {
    const user = await getCurrentUser();

    if (!user?.uid) {
      return { success: false, error: "Login required" };
    }

    if (notificationId === null || notificationId === undefined) {
      return { success: false, error: "Notification ID is required" };
    }

    const supabase = requireSupabase();
    const network = requireNetwork();

    const { error } = await supabase
      .from(READ_TABLE)
      .upsert(
        {
          user_id: user.uid,
          notification_id: notificationId,
          network,
          read_at: new Date().toISOString()
        },
        { onConflict: "user_id,notification_id,network" }
      );

    if (error) {
      throw new Error(
        error.message || "Failed to mark notification as read."
      );
    }

    await updateNotificationBadge();
    return { success: true };
  }

  async function markNotificationsRead() {
    const user = await getCurrentUser();

    if (!user?.uid) {
      return { success: false, error: "Login required" };
    }

    const network = requireNetwork();
    const notifications = await getNotifications();

    if (!notifications.length) {
      await updateNotificationBadge();
      return { success: true, count: 0 };
    }

    const now = new Date().toISOString();
    const rows = notifications.map(notification => ({
      user_id: user.uid,
      notification_id: notification.id,
      network,
      read_at: now
    }));

    const supabase = requireSupabase();

    const { error } = await supabase
      .from(READ_TABLE)
      .upsert(
        rows,
        { onConflict: "user_id,notification_id,network" }
      );

    if (error) {
      throw new Error(
        error.message || "Failed to mark notifications as read."
      );
    }

    await updateNotificationBadge();
    return { success: true, count: rows.length };
  }

  async function getNotificationsWithReadState() {
    const rows = await getNotifications();
    const user = await getCurrentUser();

    if (!user?.uid) {
      return rows.map(notification => ({
        ...notification,
        read: false
      }));
    }

    const readIds = await getReadNotificationIds(user.uid);
    const readSet = new Set(readIds.map(id => String(id)));

    return rows.map(notification => ({
      ...notification,
      read: readSet.has(String(notification.id))
    }));
  }

  window.getAlbukhrNotifications = getNotifications;
  window.getAlbukhrNotificationsWithReadState =
    getNotificationsWithReadState;
  window.getAlbukhrReadNotificationIds = getReadNotificationIds;
  window.getUnreadCount = getUnreadCount;
  window.updateNotificationBadge = updateNotificationBadge;
  window.openNotifications = openNotifications;
  window.markNotificationRead = markNotificationRead;
  window.markNotificationsRead = markNotificationsRead;

  async function initializeNotifications() {
    try {
      await updateNotificationBadge();
    } catch (error) {
      console.error(
        "ALBUKHR notification initialization:",
        error
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeNotifications,
      { once: true }
    );
  } else {
    initializeNotifications();
  }

  console.log(
    "ALBUKHR Notification Engine v3 loaded. Supabase + network-aware mode active."
  );
})();
