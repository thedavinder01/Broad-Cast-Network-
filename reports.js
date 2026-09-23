/* =============================================================
   NOVEM CONTROLS — REPORTS & ANALYTICS PAGE
   ========================================================= */

(function () {
    "use strict";

    const N = window.Novem;
    const DEPARTMENTS = ["Engineering", "Operations", "Production"];

    const periodFilter = document.getElementById("periodFilter");
    const typeFilter = document.getElementById("typeFilter");

    function getData() {
        return { members: N.getMembers(), broadcasts: N.getBroadcasts() };
    }

    /* =========================================================
       TOP STAT CARDS
       ========================================================= */

    function renderTopStats() {
        const { members, broadcasts } = getData();
        const active = members.filter(function (m) { return m.status === "Active"; }).length;
        const sent = broadcasts.filter(function (b) { return b.status !== "Draft"; });
        const delivered = sent.filter(function (b) { return b.status === "Delivered"; }).length;
        const failed = sent.filter(function (b) { return b.status === "Failed"; }).length;
        const rate = sent.length ? Math.round((delivered / (delivered + failed || 1)) * 1000) / 10 : 0;

        document.getElementById("totalMembers").textContent = members.length;
        document.getElementById("activeMembers").textContent = active;
        document.getElementById("messagesSent").textContent = sent.length;
        document.getElementById("deliveryRate").textContent = (sent.length ? rate : 0) + "%";
    }

    /* =========================================================
       DEPARTMENT DISTRIBUTION
       ========================================================= */

    function renderDepartments() {
        const { members } = getData();
        const list = document.getElementById("departmentList");
        const tableBody = document.getElementById("departmentTableBody");

        if (members.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:30px; color:#8b97a8; font-size:12.5px;">No member data yet — add members to see distribution.</div>';
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:#8b97a8;">No member data yet.</td></tr>';
            return;
        }

        const max = Math.max.apply(null, DEPARTMENTS.map(function (d) {
            return members.filter(function (m) { return m.department === d; }).length;
        }).concat([1]));

        list.innerHTML = DEPARTMENTS.map(function (dept) {
            const count = members.filter(function (m) { return m.department === dept; }).length;
            const pct = Math.round((count / max) * 100);
            return '<div class="department-item">' +
                '<div class="department-info"><span>' + dept + '</span><strong>' + count + '</strong></div>' +
                '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;"></div></div>' +
                '</div>';
        }).join("");

        tableBody.innerHTML = DEPARTMENTS.map(function (dept) {
            const deptMembers = members.filter(function (m) { return m.department === dept; });
            const active = deptMembers.filter(function (m) { return m.status === "Active"; }).length;
            const share = Math.round((deptMembers.length / members.length) * 100);
            return "<tr>" +
                "<td><strong>" + dept + "</strong></td>" +
                "<td>" + deptMembers.length + "</td>" +
                "<td>" + active + "</td>" +
                "<td>" + share + "%</td>" +
                "</tr>";
        }).join("");
    }

    /* =========================================================
       MESSAGE PERFORMANCE
       ========================================================= */

    function renderPerformance() {
        const { broadcasts } = getData();
        const sent = broadcasts.filter(function (b) { return b.status !== "Draft"; });
        const delivered = sent.filter(function (b) { return b.status === "Delivered"; }).length;
        const failed = sent.filter(function (b) { return b.status === "Failed"; }).length;
        const recipients = sent.reduce(function (sum, b) { return sum + (b.recipients || 0); }, 0);
        const pct = sent.length ? Math.round((delivered / sent.length) * 100) : 0;

        document.getElementById("deliveredCount").textContent = delivered;
        document.getElementById("recipientsCount").textContent = recipients;
        document.getElementById("failedCount").textContent = failed;
        document.getElementById("overallDeliveryPct").textContent = pct + "%";
        document.getElementById("overallDeliveryBar").style.width = pct + "%";
    }

    /* =========================================================
       ACTIVITY CHART (broadcasts / new members per day)
       ========================================================= */

    function renderActivityChart() {
        const { members, broadcasts } = getData();
        const days = parseInt(periodFilter.value, 10) === 365 ? 12 : Math.min(parseInt(periodFilter.value, 10), 14);
        const isYearView = parseInt(periodFilter.value, 10) === 365;
        const chart = document.getElementById("activityChart");
        const type = typeFilter.value;

        const buckets = [];
        const now = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            if (isYearView) {
                d.setMonth(now.getMonth() - i);
            } else {
                d.setDate(now.getDate() - i);
            }

            const count = countForBucket(d, isYearView, type, members, broadcasts);
            buckets.push({
                label: isYearView ? d.toLocaleDateString("en-IN", { month: "short" }) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
                count: count
            });
        }

        const max = Math.max.apply(null, buckets.map(function (b) { return b.count; }).concat([1]));
        const maxBarHeight = 160; // px — matches .activity-chart's usable height

        chart.innerHTML = buckets.map(function (b) {
            const heightPx = Math.max(4, Math.round((b.count / max) * maxBarHeight));
            return '<div class="chart-column" title="' + b.count + '">' +
                '<div class="chart-bar" style="height:' + heightPx + 'px;"></div>' +
                '<span>' + b.label + '</span></div>';
        }).join("");
    }

    function countForBucket(date, isMonth, type, members, broadcasts) {
        function sameBucket(iso) {
            const d = new Date(iso);
            if (isNaN(d)) return false;
            return isMonth
                ? d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear()
                : d.toDateString() === date.toDateString();
        }

        const memberCount = members.filter(function (m) { return sameBucket(m.joined); }).length;
        const messageCount = broadcasts.filter(function (b) { return b.status !== "Draft" && sameBucket(b.date); }).length;

        if (type === "members") return memberCount;
        if (type === "messages") return messageCount;
        return memberCount + messageCount; // "all" or "activity"
    }

    /* =========================================================
       FILTER / PRINT / EXPORT
       ========================================================= */

    document.getElementById("applyFilter").addEventListener("click", function () {
        renderActivityChart();
        N.toast("Report filters applied.", "success");
    });

    document.getElementById("printReport").addEventListener("click", function () {
        window.print();
    });

    document.getElementById("exportReport").addEventListener("click", function () {
        const { members } = getData();

        let csv = "Department,Members,Active,Share\n";
        DEPARTMENTS.forEach(function (dept) {
            const deptMembers = members.filter(function (m) { return m.department === dept; });
            const active = deptMembers.filter(function (m) { return m.status === "Active"; }).length;
            const share = members.length ? Math.round((deptMembers.length / members.length) * 100) : 0;
            csv += dept + "," + deptMembers.length + "," + active + "," + share + "%\n";
        });

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "novem-report-" + Date.now() + ".csv";
        a.click();
        URL.revokeObjectURL(url);

        N.toast("Report exported as CSV.", "success");
    });

    /* =========================================================
       INIT
       ========================================================= */

    renderTopStats();
    renderDepartments();
    renderPerformance();
    renderActivityChart();

})();
