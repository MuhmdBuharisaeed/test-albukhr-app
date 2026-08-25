/* =========================================================
   ALBUKHR NOTIFICATION ENGINE v2
   NETWORK-AWARE • SUPABASE CORE
   NO LOCALSTORAGE

   ARCHITECTURE:
   environment-switcher.js
          ↓
   supabase-core.js
          ↓
   notifications.js
          ↓
   page controllers

   SOURCE:
   public ALBUKHR notification feed is read from
   Supabase. Read-state is stored in Supabase so it is
   not tied to one browser/device.

   EXPECTED TABLE:
   notification_reads

   This engine also supports a notification table when
   available:
     notifications

   Expected notification fields:
     id
     title
     message (optional)
     date / created_at
     network
     active (optional)
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
      if (
        window.Pi &&
        typeof window.Pi.getUser === "function"
      ) {
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

  function normalizeNotification(row) {
    return {
      id: row.id,
      title: row.title || "ALBUKHR Notification",
      message:
        row.message ||
        row.description ||
        "",
      date:
        row.date ||
        row.created_at ||
        null,
      created_at:
        row.created_at ||
        row.date ||
        null,
      network:
        row.network || null,
      active:
        row.active === undefined
          ? true
          : !!row.active,
      raw: row
    };
  }

  /* =======================================================
     LOAD NOTIFICATIONS

     We intentionally do not keep the old hardcoded
     notification array. The database is the source of truth.
  ======================================================= */

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
      {
        ascending:
          options.ascending === true
      }
    );

    const { data, error } = await query;

    if (error) {
      throw new Error(
        error.message ||
        "Failed to load ALBUKHR notifications."
      );
    }

    return Array.isArray(data)
      ? data.map(normalizeNotification)
      : [];
  }

  /* =======================================================
     CURRENT USER READ STATE

     notification_reads is expected to contain:
       user_id
       notification_id
       network
       read_at
  ======================================================= */

  async function getReadNotificationIds(userId = null) {
    const user =
      userId
        ? { uid: userId }
        : await getCurrentUser();

    if (!user?.uid) {
      return [];
    }

    const supabase = requireSupabase();
    const network = requireNetwork();

    const { data, error } =
      await supabase
        .from(READ_TABLE)
        .select("notification_id")
        .eq("user_id", user.uid)
        .eq("network", network);

    if (error) {
      throw new Error(
        error.message ||
        "Failed to load notification read state."
      );
    }

    return Array.isArray(data)
      ? data
          .map(row => row.notification_id)
          .filter(
            id =>
              id !== null &&
              id !== undefined
          )
      : [];
  }

  /* =======================================================
     COUNT UNREAD
  ======================================================= */

  async function getUnreadCount() {
    try {
      const notifications =
        await getNotifications();

      const user =
        await getCurrentUser();

      /*
        If the user is not authenticated yet, do not
        invent persistent read state. Returning all active
        notifications as unread is deterministic and avoids
        LocalStorage.
      */
      if (!user?.uid) {
        return notifications.length;
      }

      const readIds =
        await getReadNotificationIds(
          user.uid
        );

      return notifications.filter(
        notification =>
          !readIds.some(
            readId =>
              String(readId) ===
              String(notification.id)
          )
      ).length;

    } catch (error) {
      console.error(
        "ALBUKHR notification count:",
        error
      );

      return 0;
    }
  }

  /* =======================================================
     UPDATE BADGE
  ======================================================= */

  async function updateNotificationBadge() {
    const badge =
      document.getElementById(
        "notifBadge"
      );

    if (!badge) {
      return;
    }

    const count =
      await getUnreadCount();

    if (count <= 0) {
      badge.style.display = "none";
      badge.textContent = "";
    } else {
      badge.style.display = "flex";
      badge.textContent =
        count > 99
          ? "99+"
          : String(count);
    }
  }

  /* =======================================================
     OPEN NOTIFICATIONS
  ======================================================= */

  function openNotifications() {
    window.location.href = "news.html";
  }

  /* =======================================================
     MARK ONE AS READ
  ======================================================= */

  async function markNotificationRead(
    notificationId
  ) {
    const user =
      await getCurrentUser();

    if (!user?.uid) {
      return {
        success: false,
        error: "Login required"
      };
    }

    if (
      notificationId === null ||
      notificationId === undefined
    ) {
      return {
        success: false,
        error: "Notification ID is required"
      };
    }

    const supabase =
      requireSupabase();

    const network =
      requireNetwork();

    const { error } =
      await supabase
        .from(READ_TABLE)
        .upsert(
          {
            user_id: user.uid,
            notification_id:
              notificationId,
            network,
            read_at:
              new Date().toISOString()
          },
          {
            onConflict:
              "user_id,notification_id,network"
          }
        );

    if (error) {
      throw new Error(
        error.message ||
        "Failed to mark notification as read."
      );
    }

    await updateNotificationBadge();

    return {
      success: true
    };
  }

  /* =======================================================
     MARK ALL AS READ
  ======================================================= */

  async function markNotificationsRead() {
    const user =
      await getCurrentUser();

    if (!user?.uid) {
      return {
        success: false,
        error: "Login required"
      };
    }

    const network =
      requireNetwork();

    const notifications =
      await getNotifications();

    if (!notifications.length) {
      await updateNotificationBadge();

      return {
        success: true,
        count: 0
      };
    }

    const rows =
      notifications.map(
        notification => ({
          user_id: user.uid,
          notification_id:
            notification.id,
          network,
          read_at:
            new Date().toISOString()
        })
      );

    const supabase =
      requireSupabase();

    const { error } =
      await supabase
        .from(READ_TABLE)
        .upsert(
          rows,
          {
            onConflict:
              "user_id,notification_id,network"
          }
        );

    if (error) {
      throw new Error(
        error.message ||
        "Failed to mark notifications as read."
      );
    }

    await updateNotificationBadge();

    return {
      success: true,
      count: rows.length
    };
  }

  /* =======================================================
     LOAD + READ STATE TOGETHER
  ======================================================= */

  async function getNotificationsWithReadState() {
    const rows =
      await getNotifications();

    const user =
      await getCurrentUser();

    if (!user?.uid) {
      return rows.map(
        notification => ({
          ...notification,
          read: false
        })
      );
    }

    const readIds =
      await getReadNotificationIds(
        user.uid
      );

    return rows.map(
      notification => ({
        ...notification,
        read:
          readIds.some(
            id =>
              String(id) ===
              String(notification.id)
          )
      })
    );
  }

  /* =======================================================
     PUBLIC API
  ======================================================= */

  window.getAlbukhrNotifications =
    getNotifications;

  window.getAlbukhrNotificationsWithReadState =
    getNotificationsWithReadState;

  window.getAlbukhrReadNotificationIds =
    getReadNotificationIds;

  window.getUnreadCount =
    getUnreadCount;

  window.updateNotificationBadge =
    updateNotificationBadge;

  window.openNotifications =
    openNotifications;

  window.markNotificationRead =
    markNotificationRead;

  window.markNotificationsRead =
    markNotificationsRead;

  /* =======================================================
     INITIALIZE

     DOMContentLoaded is retained for compatibility with
     the old index.html behaviour.
  ======================================================= */

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

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initializeNotifications,
      { once: true }
    );
  } else {
    initializeNotifications();
  }

  try {
    console.log(
      "ALBUKHR Notification Engine v2 loaded. " +
      "Supabase + network-aware mode active."
    );
  } catch (_) {}

})();
