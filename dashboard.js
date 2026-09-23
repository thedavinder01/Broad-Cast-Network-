/* =============================================================
   NOVEM CONTROLS — CORE / LAYOUT SCRIPT
   Loaded on every admin page, before the page-specific script.
   Provides: window.Novem (data store + helpers), sidebar/topbar
   behavior, logout, role-based UI, notification badge sync.
   ============================================================= */

(function () {
    "use strict";

    /* =========================================================
       STORAGE HELPERS
       ========================================================= */

    function read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    /* =========================================================
       SEED INITIAL DATA (only runs once — keeps whatever the
       admin has already created/edited)
       ========================================================= */

    function seed() {

        if (!localStorage.getItem("novem_users")) {
            write("novem_users", []);
        }

        if (!localStorage.getItem("novem_members")) {
            write("novem_members", []);
        }

        if (!localStorage.getItem("novem_broadcasts")) {
            write("novem_broadcasts", []);
        }

        if (!localStorage.getItem("novem_notifications")) {
            write("novem_notifications", []);
        }

        if (!localStorage.getItem("novem_settings")) {
            write("novem_settings", {
                theme: "light",
                notifications: {
                    security: true,
                    broadcasts: true,
                    system: true,
                    maintenance: false
                }
            });
        }
    }

    seed();

    /* =========================================================
       SESSION / AUTH
       ========================================================= */

    function getToken() {
        return localStorage.getItem("novem_token") || sessionStorage.getItem("novem_token");
    }

    function currentUser() {
        try {
            return JSON.parse(localStorage.getItem("novem_user") || "null");
        } catch (e) {
            return null;
        }
    }

    function requireAuth() {
        if (!getToken() || !currentUser()) {
            window.location.href = "index.html";
            return false;
        }
        return true;
    }

    function logout() {
        localStorage.removeItem("novem_token");
        sessionStorage.removeItem("novem_token");
        localStorage.removeItem("novem_user");
        window.location.href = "index.html";
    }

    function getUsers() { return read("novem_users", []); }
    function saveUsers(users) { write("novem_users", users); }

    function getMembers() { return read("novem_members", []); }
    function saveMembers(members) { write("novem_members", members); }

    function getBroadcasts() { return read("novem_broadcasts", []); }
    function saveBroadcasts(list) { write("novem_broadcasts", list); }

    function getNotifications() { return read("novem_notifications", []); }

    function addNotification(entry) {
        const list = getNotifications();
        list.unshift({
            id: "n" + Date.now() + Math.random().toString(36).slice(2, 6),
            type: entry.type,           // "security" | "system" | "message"
            title: entry.title,
            message: entry.message || "",
            priority: entry.priority || "normal",
            time: new Date().toISOString(),
            unread: true
        });
        write("novem_notifications", list.slice(0, 100));
        syncNotificationBadge();
    }

    function getSettings() { return read("novem_settings", {}); }
    function saveSettings(s) { write("novem_settings", s); }

    /* =========================================================
       ROLE-BASED UI
       ========================================================= */

    function applyRoleVisibility() {
        const user = currentUser();
        const role = user ? user.role : "viewer";

        document.querySelectorAll("[data-requires-role]").forEach(function (el) {
            const allowed = el.getAttribute("data-requires-role").split(",").map(function (r) { return r.trim(); });
            if (allowed.indexOf(role) === -1) {
                el.style.display = "none";
            }
        });

        // Update profile name/role shown in topbar + sidebar if user exists
        if (user) {
            document.querySelectorAll(".profile-info strong, .admin-box strong").forEach(function (el) {
                el.textContent = user.name || user.username;
            });
            document.querySelectorAll(".profile-info span, .admin-box span").forEach(function (el) {
                el.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
            });
            document.querySelectorAll(".profile-avatar, .admin-avatar").forEach(function (el) {
                if (el.classList.contains("admin-avatar")) return; // keep icon
                el.textContent = (user.name || user.username).charAt(0).toUpperCase();
            });
        }
    }

    /* =========================================================
       TOASTS
       ========================================================= */

    function ensureToastHost() {
        let host = document.getElementById("toastHost");
        if (!host) {
            host = document.createElement("div");
            host.id = "toastHost";
            document.body.appendChild(host);
        }
        return host;
    }

    function toast(message, type) {
        type = type || "info";
        const host = ensureToastHost();
        const el = document.createElement("div");
        el.className = "toast " + type;

        const icon = type === "success" ? "bi-check-circle-fill"
            : type === "error" ? "bi-x-circle-fill"
            : "bi-info-circle-fill";

        el.innerHTML = '<i class="bi ' + icon + '"></i><span></span>';
        el.querySelector("span").textContent = message;

        host.appendChild(el);

        setTimeout(function () {
            el.style.transition = "opacity .25s ease";
            el.style.opacity = "0";
            setTimeout(function () { el.remove(); }, 250);
        }, 3200);
    }

    /* =========================================================
       SIDEBAR / MOBILE MENU
       ========================================================= */

    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const mobileBtn = document.getElementById("mobileMenuBtn");

    function openSidebar() {
        if (sidebar) sidebar.classList.add("open");
        if (overlay) overlay.classList.add("show");
    }

    function closeSidebar() {
        if (sidebar) sidebar.classList.remove("open");
        if (overlay) overlay.classList.remove("show");
    }

    if (mobileBtn) {
        mobileBtn.addEventListener("click", function () {
            if (sidebar && sidebar.classList.contains("open")) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    if (overlay) {
        overlay.addEventListener("click", closeSidebar);
    }

    /* =========================================================
       LOGOUT BUTTON
       ========================================================= */

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            logout();
        });
    }

    /* =========================================================
       NOTIFICATION BADGE SYNC (sidebar count + topbar dot)
       ========================================================= */

    function syncNotificationBadge() {
        const total = getNotifications().filter(function (n) { return n.unread; }).length;

        document.querySelectorAll(".notification-count").forEach(function (el) {
            if (total > 0) {
                el.textContent = String(total);
                el.style.display = "";
            } else {
                el.style.display = "none";
            }
        });

        document.querySelectorAll(".notification-dot").forEach(function (el) {
            el.style.display = total === 0 ? "none" : "";
        });
    }

    /* =========================================================
       PAGE GUARD
       Every inner page must have a logged-in user, EXCEPT
       index.html / forgot-password.html (they don't load this file).
       ========================================================= */

    function applyTheme() {
        const settings = read("novem_settings", {});
        document.documentElement.setAttribute("data-theme", settings.theme === "light" ? "light" : "hybrid");
    }

    requireAuth();
    applyRoleVisibility();
    syncNotificationBadge();
    applyTheme();

    /* =========================================================
       EXPOSE SHARED API
       ========================================================= */

    window.Novem = {
        read: read,
        write: write,
        toast: toast,
        currentUser: currentUser,
        requireAuth: requireAuth,
        logout: logout,
        getUsers: getUsers,
        saveUsers: saveUsers,
        getMembers: getMembers,
        saveMembers: saveMembers,
        getBroadcasts: getBroadcasts,
        saveBroadcasts: saveBroadcasts,
        getNotifications: getNotifications,
        addNotification: addNotification,
        getSettings: getSettings,
        saveSettings: saveSettings,
        applyRoleVisibility: applyRoleVisibility,
        syncNotificationBadge: syncNotificationBadge,
        closeSidebar: closeSidebar,
        applyTheme: applyTheme
    };

})();
