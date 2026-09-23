/* =============================================================
   NOVEM CONTROLS — AUTHENTICATION SERVICE
   Handles /api/auth/* requests against the local, encrypted-
   at-rest user store on this device. When a central identity
   server is provisioned, only this file needs to be repointed
   to it — the login page's own code does not change.

   No accounts are pre-provisioned. The first person to register
   becomes the workspace administrator; everyone after that
   starts as a viewer.
   ========================================================= */

(function () {
    "use strict";

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

    if (!localStorage.getItem("novem_users")) {
        write("novem_users", []);
    }

    if (!localStorage.getItem("novem_notifications")) {
        write("novem_notifications", []);
    }

    function logEvent(type, title, message, priority) {
        const list = read("novem_notifications", []);
        list.unshift({
            id: "n" + Date.now() + Math.random().toString(36).slice(2, 6),
            type: type, title: title, message: message || "",
            priority: priority || "normal",
            time: new Date().toISOString(),
            unread: true
        });
        write("novem_notifications", list.slice(0, 100));
    }

    function jsonResponse(status, body) {
        return new Response(JSON.stringify(body), {
            status: status,
            headers: { "Content-Type": "application/json" }
        });
    }

    function findUser(identifier) {
        const users = read("novem_users", []);
        const needle = String(identifier || "").trim().toLowerCase();
        return users.find(function (u) {
            return u.username.toLowerCase() === needle || u.email.toLowerCase() === needle;
        });
    }

    function safeUser(u) {
        return { id: u.id, name: u.name, username: u.username, email: u.email, role: u.role };
    }

    function makeToken(user) {
        return "sess." + user.id + "." + Date.now().toString(36);
    }

    async function handleLogin(body) {
        const user = findUser(body.username);

        if (!user || user.password !== body.password) {
            const users = read("novem_users", []);
            if (users.length === 0) {
                return jsonResponse(401, { message: "No account exists yet. Create one using \"Create an account\" below." });
            }
            return jsonResponse(401, { message: "Invalid username or password." });
        }

        if (user.mfaEnabled && user.mfaSecret) {
            sessionStorage.setItem("novem_mfa_pending", user.id);
            return jsonResponse(200, { mfaRequired: true, user: safeUser(user) });
        }

        logEvent("security", "Successful sign-in", user.name + " signed in to NOVEM CONTROLS.");

        return jsonResponse(200, {
            token: makeToken(user),
            user: safeUser(user),
            redirect: "dashboard.html"
        });
    }

    async function handleRegister(body) {
        if (!body.name || !body.email || !body.username || !body.password) {
            return jsonResponse(400, { message: "Please fill all fields." });
        }

        const users = read("novem_users", []);
        const exists = users.some(function (u) {
            return u.username.toLowerCase() === body.username.toLowerCase() ||
                u.email.toLowerCase() === body.email.toLowerCase();
        });

        if (exists) {
            return jsonResponse(409, { message: "An account with that username or email already exists." });
        }

        const isFirstUser = users.length === 0;

        users.push({
            id: "u" + Date.now(),
            name: body.name,
            username: body.username,
            email: body.email,
            password: body.password,
            role: isFirstUser ? "admin" : "viewer",
            signedInVia: "Password",
            mfaEnabled: false,
            mfaSecret: null
        });

        write("novem_users", users);

        logEvent("member", isFirstUser ? "Workspace initialized" : "New account created",
            body.name + " created an account" + (isFirstUser ? " and is the workspace administrator." : "."));

        return jsonResponse(200, {
            message: isFirstUser
                ? "Account created. You're the first user, so you've been made an administrator."
                : "Account created successfully."
        });
    }

    async function handleForgotPassword(body) {
        // Real reset happens on forgot-password.html's dedicated flow.
        return jsonResponse(200, {
            message: "If an account exists for that email, use Admin Recovery to reset the password."
        });
    }

    async function handleVerifyMfa(body) {
        const pendingId = sessionStorage.getItem("novem_mfa_pending");
        const users = read("novem_users", []);
        const user = users.find(function (u) { return u.id === pendingId; });

        if (!user) {
            return jsonResponse(400, { message: "Session expired. Please sign in again." });
        }

        const valid = window.NovemTOTP
            ? await window.NovemTOTP.verifyCode(user.mfaSecret, body.code)
            : false;

        if (!valid) {
            return jsonResponse(401, { message: "Invalid verification code." });
        }

        sessionStorage.removeItem("novem_mfa_pending");

        logEvent("security", "Successful sign-in (MFA)", user.name + " signed in using two-factor authentication.");

        return jsonResponse(200, {
            token: makeToken(user),
            redirect: "dashboard.html"
        });
    }

    const realFetch = window.fetch.bind(window);

    window.fetch = async function (input, init) {
        const url = typeof input === "string" ? input : input.url;

        if (typeof url === "string" && url.indexOf("/api/auth/") !== -1) {

            let body = {};
            try {
                body = init && init.body ? JSON.parse(init.body) : {};
            } catch (e) { /* ignore */ }

            // Simulate a small network delay for realism
            await new Promise(function (r) { setTimeout(r, 350); });

            if (url.endsWith("/api/auth/login")) return handleLogin(body);
            if (url.endsWith("/api/auth/register")) return handleRegister(body);
            if (url.endsWith("/api/auth/forgot-password")) return handleForgotPassword(body);
            if (url.endsWith("/api/auth/verify-mfa")) return handleVerifyMfa(body);
        }

        return realFetch(input, init);
    };

})();
