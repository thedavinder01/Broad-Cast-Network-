/* =============================================================
   NOVEM CONTROLS — TOTP (RFC 6238) HELPER
   Real HMAC-SHA1 based one-time codes using the browser's
   WebCrypto API. Compatible with Google Authenticator, Authy,
   1Password, etc. Loaded on index.html (MFA login step) and
   settings.html (MFA setup).
   ========================================================= */

(function () {
    "use strict";

    const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    function randomSecret(length) {
        length = length || 16;
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        let out = "";
        for (let i = 0; i < bytes.length; i++) {
            out += BASE32_ALPHABET[bytes[i] % 32];
        }
        return out;
    }

    function base32ToBytes(base32) {
        const clean = base32.replace(/=+$/, "").toUpperCase().replace(/[^A-Z2-7]/g, "");
        let bits = "";
        for (let i = 0; i < clean.length; i++) {
            const val = BASE32_ALPHABET.indexOf(clean[i]);
            if (val === -1) continue;
            bits += val.toString(2).padStart(5, "0");
        }
        const bytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.substring(i, i + 8), 2));
        }
        return new Uint8Array(bytes);
    }

    function intToBytes(num) {
        const buf = new ArrayBuffer(8);
        const view = new DataView(buf);
        // JS numbers are safe up to 2^53; counter fits in lower 32 bits for decades
        view.setUint32(4, num);
        return new Uint8Array(buf);
    }

    async function hotp(secretBase32, counter) {
        const keyBytes = base32ToBytes(secretBase32);
        const key = await crypto.subtle.importKey(
            "raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
        );
        const counterBytes = intToBytes(counter);
        const sigBuf = await crypto.subtle.sign("HMAC", key, counterBytes);
        const sig = new Uint8Array(sigBuf);

        const offset = sig[sig.length - 1] & 0x0f;
        const code = ((sig[offset] & 0x7f) << 24) |
            ((sig[offset + 1] & 0xff) << 16) |
            ((sig[offset + 2] & 0xff) << 8) |
            (sig[offset + 3] & 0xff);

        return (code % 1000000).toString().padStart(6, "0");
    }

    async function currentCode(secretBase32) {
        const counter = Math.floor(Date.now() / 1000 / 30);
        return hotp(secretBase32, counter);
    }

    async function verifyCode(secretBase32, code, window_) {
        window_ = window_ === undefined ? 1 : window_;
        const counter = Math.floor(Date.now() / 1000 / 30);
        const clean = String(code).replace(/\D/g, "");
        if (clean.length !== 6) return false;

        for (let i = -window_; i <= window_; i++) {
            const candidate = await hotp(secretBase32, counter + i);
            if (candidate === clean) return true;
        }
        return false;
    }

    function otpauthUri(secretBase32, accountLabel, issuer) {
        issuer = issuer || "NOVEM CONTROLS";
        const label = encodeURIComponent(issuer + ":" + accountLabel);
        return "otpauth://totp/" + label +
            "?secret=" + secretBase32 +
            "&issuer=" + encodeURIComponent(issuer) +
            "&algorithm=SHA1&digits=6&period=30";
    }

    function qrImageUrl(otpauth) {
        return "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(otpauth);
    }

    window.NovemTOTP = {
        randomSecret: randomSecret,
        currentCode: currentCode,
        verifyCode: verifyCode,
        otpauthUri: otpauthUri,
        qrImageUrl: qrImageUrl
    };

})();
