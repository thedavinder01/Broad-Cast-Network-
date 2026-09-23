/* =============================================================
   NOVEM CONTROLS — DASHBOARD OVERVIEW
   Populates the stat cards, broadcast-activity feed and
   notification preview from real data — no sample numbers.
   ========================================================= */

(function () {
    "use strict";

    const N = window.Novem;
    const user = N.currentUser();

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function timeAgo(iso) {
        const diffMs = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return mins + " min ago";
        const hours = Math.floor(mins / 60);
        if (hours < 24) return hours + " hour" + (hours === 1 ? "" : "s") + " ago";
        const days = Math.floor(hours / 24);
        return days + " day" + (days === 1 ? "" : "s") + " ago";
    }

    /* =========================================================
       STAT CARDS
       ========================================================= */

    function renderStats() {
        const members = N.getMembers();
        const broadcasts = N.getBroadcasts();
        const sent = broadcasts.filter(function (b) { return b.status !== "Draft"; });
        const delivered = sent.filter(function (b) { return b.status === "Delivered"; }).length;
        const failed = sent.filter(function (b) { return b.status === "Failed"; }).length;

        document.getElementById("statTotalMembers").textContent = members.length;
        document.getElementById("statActiveMembers").textContent = members.filter(function (m) { return m.status === "Active"; }).length;
        document.getElementById("statMessagesSent").textContent = sent.length;

        const rateEl = document.getElementById("statDeliveryRate");
        const tagEl = document.getElementById("statDeliveryRateTag");

        if (sent.length === 0) {
            rateEl.textContent = "—";
            tagEl.innerHTML = '<i class="fa-solid fa-circle-info"></i> No broadcasts yet';
        } else {
            const rate = Math.round((delivered / (delivered + failed || 1)) * 1000) / 10;
            rateEl.textContent = rate + "%";
            tagEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + (rate >= 95 ? "Excellent" : rate >= 80 ? "Good" : "Needs attention");
        }
    }

    /* =========================================================
       RECENT BROADCAST ACTIVITY (latest 4)
       ========================================================= */

    function renderActivity() {
        const el = document.getElementById("recentActivityList");
        const broadcasts = N.getBroadcasts()
            .slice()
            .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
            .slice(0, 4);

        if (broadcasts.length === 0) {
            el.innerHTML = '<div style="text-align:center; padding:30px 10px; color:#8b97a8; font-size:12.5px;">' +
                'No broadcasts sent yet. <a href="messages.html" style="color:#2563eb; font-weight:600;">Send your first one</a>.</div>';
            return;
        }

        const ICONS = { Delivered: "fa-check", Scheduled: "fa-calendar-days", Failed: "fa-triangle-exclamation", Draft: "fa-file-lines" };
        const BG = { Delivered: "green-bg", Scheduled: "orange-bg", Failed: "pink-bg", Draft: "purple-bg" };

        el.innerHTML = broadcasts.map(function (b) {
            return '<div class="activity-item">' +
                '<div class="activity-icon ' + (BG[b.status] || "purple-bg") + '"><i class="fa-solid ' + (ICONS[b.status] || "fa-bell") + '"></i></div>' +
                '<div class="activity-info"><strong>' + escapeHtml(b.title) + '</strong>' +
                '<span>' + escapeHtml(b.audience) + " · " + b.recipients + " recipients</span></div>" +
                '<span class="status ' + b.status.toLowerCase() + '">' + b.status + "</span>" +
                "</div>";
        }).join("");
    }

    /* =========================================================
       RECENT NOTIFICATIONS (latest 4)
       ========================================================= */

    function renderNotifications() {
        const el = document.getElementById("recentNotificationList");
        const items = N.getNotifications().slice(0, 4);

        if (items.length === 0) {
            el.innerHTML = '<div style="text-align:center; padding:30px 10px; color:#8b97a8; font-size:12.5px;">Nothing to show yet.</div>';
            return;
        }

        const ICONS = { security: "fa-shield-halved", system: "fa-server", member: "fa-user-plus", message: "fa-envelope" };
        const BG = { security: "purple-bg", system: "green-bg", member: "orange-bg", message: "pink-bg" };

        el.innerHTML = items.map(function (n) {
            return '<div class="notification-item ' + (n.unread ? "unread" : "") + '">' +
                '<div class="notification-icon ' + (BG[n.type] || "purple-bg") + '"><i class="fa-solid ' + (ICONS[n.type] || "fa-bell") + '"></i></div>' +
                "<div><strong>" + escapeHtml(n.title) + "</strong><span>" + timeAgo(n.time) + "</span></div>" +
                "</div>";
        }).join("");
    }

    /* =========================================================
       MFA STATUS
       ========================================================= */

    function renderMfaStatus() {
        const el = document.getElementById("dashboardMfaStatus");
        if (!el || !user) return;

        const users = N.getUsers();
        const u = users.find(function (x) { return x.id === user.id; });
        const enabled = !!(u && u.mfaEnabled);

        el.textContent = enabled ? "Enabled" : "Disabled";
        el.style.color = enabled ? "" : "#d64545";
    }

    /* =========================================================
       INIT
       ========================================================= */

    renderStats();
    renderActivity();
    renderNotifications();
    renderMfaStatus();

})();
