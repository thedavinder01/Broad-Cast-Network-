/* =============================================================
   NOVEM CONTROLS — SETTINGS PAGE
   ========================================================= */

(function () {
    "use strict";

    const N = window.Novem;
    const user = N.currentUser();

    /* =========================================================
       TABS
       ========================================================= */

    const tabs = Array.from(document.querySelectorAll(".settings-tab"));
    const panels = Array.from(document.querySelectorAll(".settings-panel"));

    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            const target = tab.getAttribute("data-target");
            tabs.forEach(function (t) { t.classList.remove("active"); });
            panels.forEach(function (p) { p.classList.remove("active"); });
            tab.classList.add("active");
            document.getElementById(target).classList.add("active");
        });
    });

    // Admin-only "Team & Roles" tab
    if (user && user.role === "admin") {
        document.getElementById("teamTabBtn").style.display = "";
    }

    /* =========================================================
       PROFILE
       ========================================================= */

    (function initProfile() {
        if (!user) return;
        document.getElementById("adminName").value = user.name;
        document.getElementById("adminUsername").value = user.username;
        document.getElementById("adminEmail").value = user.email;

        document.querySelectorAll(".profile-avatar-large").forEach(function (el) {
            el.textContent = (user.name || user.username).charAt(0).toUpperCase();
        });
    })();

    document.getElementById("profileForm").addEventListener("submit", function (e) {
        e.preventDefault();

        const users = N.getUsers();
        const idx = users.findIndex(function (u) { return u.id === user.id; });
        if (idx === -1) return;

        users[idx].name = document.getElementById("adminName").value.trim() || users[idx].name;
        users[idx].username = document.getElementById("adminUsername").value.trim() || users[idx].username;
        users[idx].email = document.getElementById("adminEmail").value.trim() || users[idx].email;

        N.saveUsers(users);

        const updatedUser = Object.assign({}, user, {
            name: users[idx].name, username: users[idx].username, email: users[idx].email
        });
        localStorage.setItem("novem_user", JSON.stringify(updatedUser));

        N.applyRoleVisibility();
        N.toast("Profile updated.", "success");
    });

    /* =========================================================
       CHANGE PASSWORD
       ========================================================= */

    document.getElementById("changePassword").addEventListener("click", function () {
        const current = document.getElementById("currentPassword").value;
        const next = document.getElementById("newPassword").value;
        const confirm = document.getElementById("confirmPassword").value;

        const users = N.getUsers();
        const idx = users.findIndex(function (u) { return u.id === user.id; });
        if (idx === -1) return;

        if (users[idx].password !== current) {
            N.toast("Current password is incorrect.", "error");
            return;
        }
        if (next.length < 8 || !/\d/.test(next)) {
            N.toast("New password must be 8+ characters and include a number.", "error");
            return;
        }
        if (next !== confirm) {
            N.toast("New password and confirmation do not match.", "error");
            return;
        }

        users[idx].password = next;
        N.saveUsers(users);

        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("confirmPassword").value = "";

        N.toast("Password updated successfully.", "success");
        N.addNotification({
            type: "security",
            title: "Password changed",
            message: "Your account password was changed successfully.",
            priority: "high"
        });
    });

    /* =========================================================
       MFA (real TOTP via js/totp.js)
       ========================================================= */

    let pendingSecret = null;

    const mfaStatusTag = document.getElementById("mfaStatusTag");
    const mfaStatusBanner = document.getElementById("mfaStatusBanner");
    const mfaSetupSection = document.getElementById("mfaSetupSection");
    const mfaDisableSection = document.getElementById("mfaDisableSection");
    const mfaQrArea = document.getElementById("mfaQrArea");

    function renderMfaState() {
        const users = N.getUsers();
        const u = users.find(function (x) { return x.id === user.id; });
        const enabled = !!(u && u.mfaEnabled);

        mfaStatusTag.textContent = enabled ? "Enabled" : "Disabled";
        mfaStatusTag.style.background = enabled ? "" : "";
        mfaStatusTag.style.color = enabled ? "#0e7a3b" : "#7b8798";
        mfaStatusTag.style.background = enabled ? "#e9f8ee" : "#f1f3f6";

        mfaStatusBanner.style.display = enabled ? "flex" : "none";
        mfaSetupSection.style.display = enabled ? "none" : "block";
        mfaDisableSection.style.display = enabled ? "block" : "none";

        mfaQrArea.style.display = "none";
        document.getElementById("mfaVerifyCode").value = "";
        document.getElementById("mfaVerifyError").textContent = "";
    }

    document.getElementById("setupMfa").addEventListener("click", async function () {
        pendingSecret = window.NovemTOTP.randomSecret(20);
        const uri = window.NovemTOTP.otpauthUri(pendingSecret, user.username);

        document.getElementById("mfaQrImg").src = window.NovemTOTP.qrImageUrl(uri);
        document.getElementById("mfaSecretText").textContent = pendingSecret.match(/.{1,4}/g).join(" ");
        mfaQrArea.style.display = "block";
    });

    document.getElementById("mfaVerifyBtn").addEventListener("click", async function () {
        const code = document.getElementById("mfaVerifyCode").value;
        const errorEl = document.getElementById("mfaVerifyError");

        if (!pendingSecret) {
            errorEl.textContent = "Click \"Setup Authenticator\" first to generate a QR code.";
            return;
        }

        const valid = await window.NovemTOTP.verifyCode(pendingSecret, code);
        if (!valid) {
            errorEl.textContent = "Incorrect code. Check your authenticator app and try again.";
            return;
        }

        const users = N.getUsers();
        const idx = users.findIndex(function (u) { return u.id === user.id; });
        users[idx].mfaEnabled = true;
        users[idx].mfaSecret = pendingSecret;
        N.saveUsers(users);

        errorEl.textContent = "";
        pendingSecret = null;
        renderMfaState();
        N.toast("MFA enabled — your account is now protected by an authenticator.", "success");
        N.addNotification({
            type: "security",
            title: "Two-factor authentication enabled",
            message: "MFA was turned on for your account via an authenticator app.",
            priority: "high"
        });
    });

    document.getElementById("mfaDisableBtn").addEventListener("click", function () {
        if (!confirm("Turn off two-factor authentication for this account?")) return;

        const users = N.getUsers();
        const idx = users.findIndex(function (u) { return u.id === user.id; });
        users[idx].mfaEnabled = false;
        users[idx].mfaSecret = null;
        N.saveUsers(users);

        renderMfaState();
        N.toast("MFA has been turned off.", "info");
        N.addNotification({
            type: "security",
            title: "Two-factor authentication disabled",
            message: "MFA was turned off for your account.",
            priority: "high"
        });
    });

    /* =========================================================
       TEAM & ROLES (admin only)
       ========================================================= */

    function renderTeam() {
        const tbody = document.getElementById("teamTableBody");
        if (!tbody) return;

        const users = N.getUsers();
        tbody.innerHTML = users.map(function (u) {
            return "<tr>" +
                "<td><strong>" + u.name + "</strong></td>" +
                "<td>" + u.username + "</td>" +
                "<td>" + (u.signedInVia || "Password") + "</td>" +
                '<td><span class="status active" style="text-transform:capitalize;">' + u.role + "</span></td>" +
                "</tr>";
        }).join("");
    }

    /* =========================================================
       NOTIFICATION PREFERENCES
       ========================================================= */

    const prefSwitches = Array.from(document.querySelectorAll("#notifications .preference-item .switch input"));
    const PREF_KEYS = ["security", "broadcasts", "system", "maintenance"];

    (function initPrefs() {
        const settings = N.getSettings();
        const prefs = settings.notifications || {};
        prefSwitches.forEach(function (input, i) {
            if (PREF_KEYS[i] in prefs) input.checked = !!prefs[PREF_KEYS[i]];
        });
    })();

    document.getElementById("saveNotifications").addEventListener("click", function () {
        const settings = N.getSettings();
        settings.notifications = settings.notifications || {};
        prefSwitches.forEach(function (input, i) {
            settings.notifications[PREF_KEYS[i]] = input.checked;
        });
        N.saveSettings(settings);
        N.toast("Notification preferences saved.", "success");
    });

    /* =========================================================
       APPEARANCE
       ========================================================= */

    const themeOptions = Array.from(document.querySelectorAll(".theme-option"));

    (function initTheme() {
        const settings = N.getSettings();
        const theme = settings.theme === "light" ? "light" : "hybrid";
        themeOptions.forEach(function (opt, i) {
            const isMatch = (i === 0 && theme === "light") || (i === 1 && theme === "hybrid");
            opt.classList.toggle("selected", isMatch);
            opt.querySelector("i").className = isMatch ? "bi bi-check-circle-fill" : "bi bi-circle";
        });
    })();

    themeOptions.forEach(function (opt, i) {
        opt.addEventListener("click", function () {
            themeOptions.forEach(function (o, j) {
                o.classList.toggle("selected", j === i);
                o.querySelector("i").className = j === i ? "bi bi-check-circle-fill" : "bi bi-circle";
            });

            const settings = N.getSettings();
            settings.theme = i === 0 ? "light" : "hybrid";
            N.saveSettings(settings);
            N.applyTheme();
            N.toast("Appearance updated.", "success");
        });
    });

    /* =========================================================
       DANGER ZONE
       ========================================================= */

    document.getElementById("clearDemoData").addEventListener("click", function () {
        if (!confirm("This permanently clears all members, broadcasts and preferences stored on this device. Continue?")) return;

        localStorage.removeItem("novem_members");
        localStorage.removeItem("novem_broadcasts");
        localStorage.removeItem("novem_settings");
        localStorage.removeItem("novem_notifications");

        N.toast("Workspace data cleared. Reloading...", "info");
        setTimeout(function () { window.location.reload(); }, 900);
    });

    /* =========================================================
       INIT
       ========================================================= */

    renderMfaState();
    renderTeam();

})();
