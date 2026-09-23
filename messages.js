/* =============================================================
   NOVEM CONTROLS — BROADCASTS PAGE
   ========================================================= */

(function () {
    "use strict";

    const N = window.Novem;
    let broadcasts = N.getBroadcasts();

    const form = document.getElementById("broadcastForm");
    const titleInput = document.getElementById("messageTitle");
    const bodyInput = document.getElementById("messageBody");
    const charCounter = document.getElementById("charCounter");

    const channelEmail = document.getElementById("channelEmail");
    const channelSms = document.getElementById("channelSms");
    const channelWhatsapp = document.getElementById("channelWhatsapp");

    const emailRecipientsGroup = document.getElementById("emailRecipientsGroup");
    const phoneRecipientsGroup = document.getElementById("phoneRecipientsGroup");
    const recipientEmails = document.getElementById("recipientEmails");
    const recipientPhones = document.getElementById("recipientPhones");
    const emailCountEl = document.getElementById("emailCount");
    const phoneCountEl = document.getElementById("phoneCount");

    const attachmentBtn = document.getElementById("attachmentBtn");
    const attachmentInput = document.getElementById("attachmentInput");
    const attachmentName = document.getElementById("attachmentName");

    const scheduleToggle = document.getElementById("scheduleToggle");
    const scheduleFields = document.getElementById("scheduleFields");
    const scheduleDate = document.getElementById("scheduleDate");
    const scheduleTime = document.getElementById("scheduleTime");

    const previewTitle = document.getElementById("previewTitle");
    const previewBody = document.getElementById("previewBody");
    const previewRecipients = document.getElementById("previewRecipients");

    const summaryRecipients = document.getElementById("summaryRecipients");
    const summaryResult = document.getElementById("summaryResult");
    const summaryType = document.getElementById("summaryType");

    const sendBtn = document.getElementById("sendBroadcastSubmitBtn");
    const sendButtonText = document.getElementById("sendButtonText");
    const saveDraftBtn = document.getElementById("saveDraft");

    const broadcastTableBody = document.getElementById("broadcastTableBody");

    /* =========================================================
       HELPERS
       ========================================================= */

    function splitList(text) {
        return text.split(/[\n,]/).map(function (s) { return s.trim(); }).filter(Boolean);
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function fmtDate(iso) {
        const d = new Date(iso);
        if (isNaN(d)) return iso;
        return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    /* =========================================================
       CHANNEL / RECIPIENT UI
       ========================================================= */

    function updatePhoneGroupVisibility() {
        const needsPhone = channelSms.checked || channelWhatsapp.checked;
        phoneRecipientsGroup.style.display = needsPhone ? "" : "none";
    }

    function currentRecipientCount() {
        let count = 0;
        if (channelEmail.checked) count += splitList(recipientEmails.value).length;
        if (channelSms.checked || channelWhatsapp.checked) count += splitList(recipientPhones.value).length;
        return count;
    }

    function updateRecipientCounts() {
        emailCountEl.textContent = splitList(recipientEmails.value).length;
        phoneCountEl.textContent = splitList(recipientPhones.value).length;
        updatePreview();
    }

    [channelEmail, channelSms, channelWhatsapp].forEach(function (cb) {
        cb.addEventListener("change", function () {
            updatePhoneGroupVisibility();
            updatePreview();
        });
    });

    recipientEmails.addEventListener("input", updateRecipientCounts);
    recipientPhones.addEventListener("input", updateRecipientCounts);

    /* =========================================================
       CHAR COUNTER + LIVE PREVIEW
       ========================================================= */

    function updatePreview() {
        const title = titleInput.value.trim();
        const body = bodyInput.value.trim();
        const count = currentRecipientCount();

        previewTitle.textContent = title || "Your message title";
        previewBody.textContent = body || "Your message preview will appear here.";
        previewRecipients.innerHTML = '<i class="bi bi-people"></i> ' + count + " recipient" + (count === 1 ? "" : "s");
        summaryRecipients.textContent = count;
        summaryType.textContent = scheduleToggle.checked ? "Scheduled" : "Immediate";
    }

    titleInput.addEventListener("input", updatePreview);

    bodyInput.addEventListener("input", function () {
        charCounter.textContent = this.value.length + " / 1000";
        updatePreview();
    });

    /* =========================================================
       ATTACHMENT
       ========================================================= */

    attachmentBtn.addEventListener("click", function () { attachmentInput.click(); });

    attachmentInput.addEventListener("change", function () {
        const file = this.files[0];
        attachmentName.textContent = file ? file.name : "No file selected";
    });

    /* =========================================================
       SCHEDULE TOGGLE
       ========================================================= */

    function updateScheduleUI() {
        scheduleFields.classList.toggle("hidden", !scheduleToggle.checked);
        updatePreview();
    }

    scheduleToggle.addEventListener("change", updateScheduleUI);

    /* =========================================================
       STATS
       ========================================================= */

    function renderStats() {
        const sent = broadcasts.filter(function (b) { return b.status !== "Draft"; });
        const totalRecipients = sent.reduce(function (sum, b) { return sum + (b.recipients || 0); }, 0);
        const delivered = sent.filter(function (b) { return b.status === "Delivered"; }).length;
        const failed = sent.filter(function (b) { return b.status === "Failed"; }).length;

        document.getElementById("recipientStat").textContent = totalRecipients;
        document.getElementById("messagesSentStat").textContent = sent.length;
        document.getElementById("deliveredOkStat").textContent = delivered;
        document.getElementById("failedStat").textContent = failed;
    }

    /* =========================================================
       HISTORY TABLE
       ========================================================= */

    function renderHistory() {
        if (broadcasts.length === 0) {
            broadcastTableBody.innerHTML =
                '<tr id="noBroadcastsRow"><td colspan="5" style="text-align:center; padding:50px 20px; color:#8b97a8;">' +
                '<i class="bi bi-megaphone" style="font-size:30px; color:#c3cad6; display:block; margin-bottom:12px;"></i>' +
                '<strong style="display:block; color:#45546a; font-size:14px; margin-bottom:5px;">No broadcasts sent yet</strong>' +
                'Send your first message above to see it appear here.</td></tr>';
            return;
        }

        const sorted = broadcasts.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

        broadcastTableBody.innerHTML = sorted.map(function (b) {
            const key = b.status.toLowerCase();
            const failedStyle = key === "failed" ? ' style="background:#fff0f0; color:#d64545;"' : "";
            return "<tr>" +
                "<td><strong>" + escapeHtml(b.title) + "</strong></td>" +
                "<td>" + escapeHtml(b.audience) + "</td>" +
                "<td>" + b.recipients + "</td>" +
                "<td>" + fmtDate(b.date) + "</td>" +
                '<td><span class="status-badge ' + key + '"' + failedStyle + '>' + b.status + "</span></td>" +
                "</tr>";
        }).join("");
    }

    function audienceLabel() {
        const chans = [];
        if (channelEmail.checked) chans.push("Email");
        if (channelSms.checked) chans.push("SMS");
        if (channelWhatsapp.checked) chans.push("WhatsApp");
        return chans.length ? chans.join(" + ") : "No channel";
    }

    /* =========================================================
       SEND / DRAFT
       ========================================================= */

    function resetComposer() {
        form.reset();
        charCounter.textContent = "0 / 1000";
        attachmentName.textContent = "No file selected";
        updatePhoneGroupVisibility();
        updateScheduleUI();
        updateRecipientCounts();
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();

        const title = titleInput.value.trim();
        const body = bodyInput.value.trim();
        const recipients = currentRecipientCount();

        if (!title || !body) {
            N.toast("Please add a title and message body.", "error");
            return;
        }

        if (!channelEmail.checked && !channelSms.checked && !channelWhatsapp.checked) {
            N.toast("Select at least one channel to send via.", "error");
            return;
        }

        if (recipients === 0) {
            N.toast("Add at least one recipient for the selected channel.", "error");
            return;
        }

        sendBtn.disabled = true;
        sendButtonText.textContent = "Sending...";

        const isScheduled = scheduleToggle.checked && scheduleDate.value && scheduleTime.value;
        const sendDate = isScheduled
            ? new Date(scheduleDate.value + "T" + scheduleTime.value).toISOString()
            : new Date().toISOString();

        setTimeout(function () {
            // Simulated delivery outcome — ~97% success rate
            const failed = Math.random() < 0.03 && !isScheduled;

            broadcasts.push({
                id: "b" + Date.now(),
                title: title,
                audience: audienceLabel(),
                recipients: recipients,
                date: sendDate,
                status: isScheduled ? "Scheduled" : (failed ? "Failed" : "Delivered")
            });

            N.saveBroadcasts(broadcasts);
            renderStats();
            renderHistory();

            summaryResult.textContent = isScheduled ? "Scheduled" : (failed ? "Failed" : "Delivered");

            sendBtn.disabled = false;
            sendButtonText.textContent = "Send Broadcast";

            N.toast(
                isScheduled ? "Broadcast scheduled successfully." : (failed ? "Broadcast failed to deliver — try again." : "Broadcast delivered successfully."),
                isScheduled ? "info" : (failed ? "error" : "success")
            );

            N.addNotification({
                type: "message",
                title: isScheduled ? "Broadcast scheduled" : (failed ? "Broadcast failed to deliver" : "Broadcast delivered"),
                message: '"' + title + '" — ' + recipients + " recipient" + (recipients === 1 ? "" : "s") + " via " + audienceLabel() + ".",
                priority: failed ? "high" : "normal"
            });

            resetComposer();
        }, 900);
    });

    saveDraftBtn.addEventListener("click", function () {
        const title = titleInput.value.trim();
        const body = bodyInput.value.trim();

        if (!title && !body) {
            N.toast("Nothing to save yet.", "info");
            return;
        }

        broadcasts.push({
            id: "b" + Date.now(),
            title: title || "(Untitled draft)",
            audience: audienceLabel(),
            recipients: currentRecipientCount(),
            date: new Date().toISOString(),
            status: "Draft"
        });

        N.saveBroadcasts(broadcasts);
        renderStats();
        renderHistory();
        N.toast("Draft saved.", "success");
        N.addNotification({
            type: "message",
            title: "Draft saved",
            message: '"' + (title || "(Untitled draft)") + '" was saved as a draft.'
        });
    });

    document.getElementById("refreshMessages").addEventListener("click", function () {
        broadcasts = N.getBroadcasts();
        renderStats();
        renderHistory();
        N.toast("Broadcast list refreshed.", "info");
    });

    /* =========================================================
       INIT
       ========================================================= */

    updatePhoneGroupVisibility();
    updateScheduleUI();
    updateRecipientCounts();
    renderStats();
    renderHistory();

})();
