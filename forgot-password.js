/* =============================================================
   NOVEM CONTROLS — ADMIN RECOVERY (forgot-password.html)
   Generates a one-time verification code and displays it on
   screen as a fallback recovery channel. The new password is
   written back into the same "novem_users" store the login
   page authenticates against.
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
    function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

    if (!localStorage.getItem("novem_users")) {
        write("novem_users", []);
    }

    const accountStep = document.getElementById("accountStep");
    const verifyStep = document.getElementById("verifyStep");
    const passwordStep = document.getElementById("passwordStep");
    const successStep = document.getElementById("successStep");

    const stepIndicator1 = document.getElementById("stepIndicator1");
    const stepIndicator2 = document.getElementById("stepIndicator2");
    const stepIndicator3 = document.getElementById("stepIndicator3");

    let pendingUser = null;
    let pendingCode = null;

    function goToStep(stepEl, indicatorIdx) {
        [accountStep, verifyStep, passwordStep].forEach(function (s) { s.classList.remove("active"); });
        stepEl.classList.add("active");

        [stepIndicator1, stepIndicator2, stepIndicator3].forEach(function (ind, i) {
            ind.classList.remove("active", "done");
            if (i + 1 < indicatorIdx) ind.classList.add("done");
            if (i + 1 === indicatorIdx) ind.classList.add("active");
        });
    }

    function setError(id, message) {
        const el = document.getElementById(id);
        if (el) el.textContent = message || "";
    }

    function findUser(identifier) {
        const users = read("novem_users", []);
        const needle = String(identifier || "").trim().toLowerCase();
        return users.find(function (u) {
            return u.username.toLowerCase() === needle || u.email.toLowerCase() === needle;
        });
    }

    function generateCode() {
        return String(Math.floor(100000 + Math.random() * 900000));
    }

    function showRecoveryCode(code) {
        const infoBox = document.querySelector("#verifyStep .info-box span");
        if (infoBox) {
            infoBox.innerHTML = 'Enter the 6-digit verification code sent to your registered recovery channel.' +
                '<br><strong style="color:#fff;">On-screen fallback code: <span style="letter-spacing:2px;">' + code + '</span></strong>';
        }
    }

    /* =========================================================
       STEP 1 — ACCOUNT
       ========================================================= */

    document.getElementById("sendCodeBtn").addEventListener("click", function () {
        const value = document.getElementById("recoveryAccount").value.trim();
        setError("accountError", "");

        if (!value) {
            setError("accountError", "Please enter your admin username or email.");
            return;
        }

        const user = findUser(value);
        if (!user) {
            setError("accountError", "No matching admin account was found.");
            return;
        }

        pendingUser = user;
        pendingCode = generateCode();

        document.querySelectorAll(".otp").forEach(function (o) { o.value = ""; });
        showRecoveryCode(pendingCode);
        setError("otpError", "");

        goToStep(verifyStep, 2);
        document.querySelector(".otp").focus();
    });

    /* =========================================================
       STEP 2 — VERIFY (OTP boxes)
       ========================================================= */

    const otpInputs = Array.from(document.querySelectorAll(".otp"));

    otpInputs.forEach(function (input, idx) {
        input.addEventListener("input", function () {
            this.value = this.value.replace(/\D/g, "").slice(0, 1);
            if (this.value && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
        });

        input.addEventListener("keydown", function (e) {
            if (e.key === "Backspace" && !this.value && idx > 0) {
                otpInputs[idx - 1].focus();
            }
        });
    });

    document.getElementById("verifyCodeBtn").addEventListener("click", function () {
        const code = otpInputs.map(function (i) { return i.value; }).join("");

        if (code.length !== 6) {
            setError("otpError", "Enter all 6 digits.");
            return;
        }

        if (code !== pendingCode) {
            setError("otpError", "Incorrect code. Please try again.");
            return;
        }

        setError("otpError", "");
        goToStep(passwordStep, 3);
    });

    document.getElementById("resendCodeBtn").addEventListener("click", function () {
        pendingCode = generateCode();
        showRecoveryCode(pendingCode);
        otpInputs.forEach(function (o) { o.value = ""; });
        otpInputs[0].focus();
    });

    /* =========================================================
       STEP 3 — NEW PASSWORD
       ========================================================= */

    const newPasswordInput = document.getElementById("newPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");

    function setRule(id, valid) {
        const el = document.getElementById(id);
        const icon = el.querySelector("i");
        el.classList.toggle("valid", valid);
        icon.className = valid ? "bi bi-check-circle-fill" : "bi bi-circle";
    }

    function validatePasswordRules() {
        const pw = newPasswordInput.value;
        const confirm = confirmPasswordInput.value;

        const lengthOk = pw.length >= 8;
        const numberOk = /\d/.test(pw);
        const matchOk = pw.length > 0 && pw === confirm;

        setRule("lengthRule", lengthOk);
        setRule("numberRule", numberOk);
        setRule("matchRule", matchOk);

        return lengthOk && numberOk && matchOk;
    }

    newPasswordInput.addEventListener("input", validatePasswordRules);
    confirmPasswordInput.addEventListener("input", validatePasswordRules);

    function wireToggle(btnId, inputEl) {
        document.getElementById(btnId).addEventListener("click", function () {
            const isPw = inputEl.type === "password";
            inputEl.type = isPw ? "text" : "password";
            this.innerHTML = isPw ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
        });
    }

    wireToggle("toggleNewPassword", newPasswordInput);
    wireToggle("toggleConfirmPassword", confirmPasswordInput);

    document.getElementById("resetPasswordBtn").addEventListener("click", function () {
        if (!validatePasswordRules()) {
            setError("passwordError", "Please meet all password requirements.");
            return;
        }

        setError("passwordError", "");

        const users = read("novem_users", []);
        const idx = users.findIndex(function (u) { return u.id === pendingUser.id; });
        if (idx !== -1) {
            users[idx].password = newPasswordInput.value;
            write("novem_users", users);
        }

        passwordStep.classList.remove("active");
        successStep.classList.add("active");
    });

    document.getElementById("backLoginBtn").addEventListener("click", function () {
        window.location.href = "index.html";
    });

})();
