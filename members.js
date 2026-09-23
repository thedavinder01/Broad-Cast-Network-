/* =============================================================
   NOVEM CONTROLS — MEMBERS PAGE
   ========================================================= */

(function () {
    "use strict";

    const N = window.Novem;
    const PAGE_SIZE = 8;

    let members = N.getMembers();
    let filtered = members.slice();
    let currentPage = 1;
    let editingId = null;

    const tableBody = document.getElementById("membersTableBody");
    const searchInput = document.getElementById("memberSearch");
    const departmentFilter = document.getElementById("departmentFilter");
    const statusFilter = document.getElementById("statusFilter");
    const paginationEl = document.querySelector(".pagination");
    const paginationInfo = document.querySelector(".pagination-area > span");

    /* =========================================================
       AVATAR INITIALS
       ========================================================= */

    function initials(name) {
        return name.trim().split(/\s+/).slice(0, 2).map(function (p) { return p[0]; }).join("").toUpperCase();
    }

    function fmtDate(iso) {
        if (!iso) return "—";
        const d = new Date(iso);
        if (isNaN(d)) return iso;
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }

    /* =========================================================
       RENDER
       ========================================================= */

    function applyFilters() {
        const q = (searchInput.value || "").trim().toLowerCase();
        const dept = departmentFilter.value;
        const status = statusFilter.value;

        filtered = members.filter(function (m) {
            const matchesQ = !q ||
                m.name.toLowerCase().includes(q) ||
                m.memberId.toLowerCase().includes(q) ||
                m.email.toLowerCase().includes(q);
            const matchesDept = dept === "all" || m.department === dept;
            const matchesStatus = status === "all" || m.status === status;
            return matchesQ && matchesDept && matchesStatus;
        });

        currentPage = 1;
        renderStats();
        renderTable();
    }

    function renderStats() {
        document.getElementById("totalMembers").textContent = members.length;
        document.getElementById("activeMembers").textContent = members.filter(function (m) { return m.status === "Active"; }).length;
        document.getElementById("inactiveMembers").textContent = members.filter(function (m) { return m.status === "Inactive"; }).length;

        const now = new Date();
        document.getElementById("newThisMonth").textContent = members.filter(function (m) {
            const d = new Date(m.joined);
            return !isNaN(d) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;
    }

    function renderTable() {
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        currentPage = Math.min(currentPage, totalPages);

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = filtered.slice(start, start + PAGE_SIZE);

        if (filtered.length === 0) {
            tableBody.innerHTML =
                '<tr><td colspan="8" style="text-align:center; padding:50px 20px; color:#8b97a8;">' +
                '<i class="bi bi-people" style="font-size:30px; color:#c3cad6; display:block; margin-bottom:12px;"></i>' +
                '<strong style="display:block; color:#45546a; font-size:14px; margin-bottom:5px;">' +
                (members.length === 0 ? "No members yet" : "No members match your filters") +
                '</strong>' +
                (members.length === 0 ? "Add a member or import an Excel file to get started." : "Try adjusting your search or filters.") +
                '</td></tr>';
        } else {
            tableBody.innerHTML = pageItems.map(function (m) {
                return '<tr data-id="' + m.id + '">' +
                    '<td><input type="checkbox" class="row-check"></td>' +
                    '<td><div class="member-cell"><div class="member-avatar">' + initials(m.name) + '</div>' +
                    '<div><strong>' + escapeHtml(m.name) + '</strong><span>' + escapeHtml(m.email) + '</span></div></div></td>' +
                    '<td>' + escapeHtml(m.memberId) + '</td>' +
                    '<td><span class="department">' + escapeHtml(m.department) + '</span></td>' +
                    '<td>' + escapeHtml(m.email) + '</td>' +
                    '<td><span class="member-status ' + m.status.toLowerCase() + '">' + m.status + '</span></td>' +
                    '<td>' + fmtDate(m.joined) + '</td>' +
                    '<td><div style="display:flex; gap:6px;">' +
                    '<button class="table-action edit-btn" title="Edit"><i class="bi bi-pencil"></i></button>' +
                    '<button class="table-action delete-btn" title="Delete"><i class="bi bi-trash3"></i></button>' +
                    '</div></td></tr>';
            }).join("");
        }

        paginationInfo.textContent = filtered.length === 0
            ? "Showing 0 of " + members.length + " members"
            : "Showing " + (start + 1) + "–" + Math.min(start + PAGE_SIZE, filtered.length) + " of " + filtered.length + " members";

        renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
        let html = '<button id="pagePrev" ' + (currentPage === 1 ? "disabled" : "") + '><i class="bi bi-chevron-left"></i></button>';

        for (let p = 1; p <= totalPages; p++) {
            if (totalPages > 7 && p !== 1 && p !== totalPages && Math.abs(p - currentPage) > 1) {
                if (p === 2 || p === totalPages - 1) html += "<span>...</span>";
                continue;
            }
            html += '<button data-page="' + p + '" class="' + (p === currentPage ? "current" : "") + '">' + p + '</button>';
        }

        html += '<button id="pageNext" ' + (currentPage === totalPages ? "disabled" : "") + '><i class="bi bi-chevron-right"></i></button>';

        paginationEl.innerHTML = html;

        paginationEl.querySelectorAll("button[data-page]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                currentPage = parseInt(this.getAttribute("data-page"), 10);
                renderTable();
            });
        });

        const prevBtn = document.getElementById("pagePrev");
        const nextBtn = document.getElementById("pageNext");
        if (prevBtn) prevBtn.addEventListener("click", function () { currentPage--; renderTable(); });
        if (nextBtn) nextBtn.addEventListener("click", function () { currentPage++; renderTable(); });
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function persist() {
        N.saveMembers(members);
    }

    /* =========================================================
       ROW ACTIONS (edit / delete) — event delegation
       ========================================================= */

    tableBody.addEventListener("click", function (e) {
        const row = e.target.closest("tr[data-id]");
        if (!row) return;
        const id = row.getAttribute("data-id");

        if (e.target.closest(".edit-btn")) {
            openModal(members.find(function (m) { return m.id === id; }));
        }

        if (e.target.closest(".delete-btn")) {
            if (confirm("Remove this member from the directory?")) {
                const removed = members.find(function (m) { return m.id === id; });
                members = members.filter(function (m) { return m.id !== id; });
                persist();
                applyFilters();
                N.toast("Member removed.", "success");
                if (removed) {
                    N.addNotification({
                        type: "member",
                        title: "Member removed",
                        message: removed.name + " was removed from the directory."
                    });
                }
            }
        }
    });

    document.getElementById("selectAll").addEventListener("change", function () {
        const checked = this.checked;
        tableBody.querySelectorAll(".row-check").forEach(function (cb) { cb.checked = checked; });
    });

    /* =========================================================
       MODAL (add / edit)
       ========================================================= */

    const modal = document.getElementById("memberModal");
    const form = document.getElementById("memberForm");
    const modalTitle = modal.querySelector(".modal-header h3");
    const submitBtn = form.querySelector('button[type="submit"]');

    function openModal(member) {
        editingId = member ? member.id : null;

        if (member) {
            modalTitle.textContent = "Edit Member";
            submitBtn.innerHTML = '<i class="bi bi-check2"></i> Save Changes';
            document.getElementById("memberName").value = member.name;
            document.getElementById("memberId").value = member.memberId;
            document.getElementById("memberEmail").value = member.email;
            document.getElementById("memberDepartment").value = member.department;
        } else {
            modalTitle.textContent = "Add New Member";
            submitBtn.innerHTML = '<i class="bi bi-person-plus"></i> Add Member';
            form.reset();
            document.getElementById("memberId").value = "NCM-" + String(1000 + members.length + 1);
        }

        modal.classList.add("show");
    }

    function closeModalFn() {
        modal.classList.remove("show");
        editingId = null;
    }

    document.getElementById("addMemberBtn").addEventListener("click", function () { openModal(null); });
    document.getElementById("closeModal").addEventListener("click", closeModalFn);
    document.getElementById("cancelModal").addEventListener("click", closeModalFn);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModalFn(); });

    form.addEventListener("submit", function (e) {
        e.preventDefault();

        const name = document.getElementById("memberName").value.trim();
        const memberId = document.getElementById("memberId").value.trim();
        const email = document.getElementById("memberEmail").value.trim();
        const department = document.getElementById("memberDepartment").value;

        if (!name || !memberId || !email) {
            N.toast("Please fill all required fields.", "error");
            return;
        }

        if (editingId) {
            const m = members.find(function (m) { return m.id === editingId; });
            Object.assign(m, { name, memberId, email, department });
            N.toast("Member updated.", "success");
            N.addNotification({
                type: "member",
                title: "Member updated",
                message: name + "'s details were updated."
            });
        } else {
            members.push({
                id: "m" + Date.now(),
                name, memberId, email, department,
                status: "Active",
                joined: new Date().toISOString()
            });
            N.toast("Member added.", "success");
            N.addNotification({
                type: "member",
                title: "New member added",
                message: name + " was added to the directory."
            });
        }

        persist();
        closeModalFn();
        applyFilters();
    });

    /* =========================================================
       SEARCH / FILTERS
       ========================================================= */

    searchInput.addEventListener("input", applyFilters);
    departmentFilter.addEventListener("change", applyFilters);
    statusFilter.addEventListener("change", applyFilters);

    /* =========================================================
       EXCEL IMPORT / EXPORT (SheetJS — already loaded via CDN)
       ========================================================= */

    const excelFileInput = document.getElementById("excelFileInput");

    document.getElementById("importExcelBtn").addEventListener("click", function () {
        excelFileInput.click();
    });

    excelFileInput.addEventListener("change", function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
            try {
                const wb = XLSX.read(evt.target.result, { type: "array" });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

                let imported = 0;
                rows.forEach(function (row) {
                    const name = row.Name || row.name || row.FullName || "";
                    if (!name) return;

                    members.push({
                        id: "m" + Date.now() + Math.random().toString(36).slice(2, 6),
                        name: String(name),
                        memberId: String(row.MemberID || row["Member ID"] || row.memberId || ("NCM-" + (1000 + members.length + 1))),
                        email: String(row.Email || row.email || ""),
                        department: String(row.Department || row.department || "Engineering"),
                        status: String(row.Status || row.status || "Active"),
                        joined: row.Joined || row.joined || new Date().toISOString()
                    });
                    imported++;
                });

                persist();
                applyFilters();
                N.toast(imported + " member(s) imported from Excel.", "success");
                if (imported > 0) {
                    N.addNotification({
                        type: "member",
                        title: "Members imported",
                        message: imported + " member(s) imported from an Excel file."
                    });
                }
            } catch (err) {
                console.error(err);
                N.toast("Could not read that file. Please check the format.", "error");
            } finally {
                excelFileInput.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    });

    document.getElementById("exportExcelBtn").addEventListener("click", function () {
        if (members.length === 0) {
            N.toast("There are no members to export yet.", "info");
            return;
        }

        const rows = members.map(function (m) {
            return {
                Name: m.name,
                MemberID: m.memberId,
                Email: m.email,
                Department: m.department,
                Status: m.status,
                Joined: fmtDate(m.joined)
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Members");
        XLSX.writeFile(wb, "novem-members-" + Date.now() + ".xlsx");
        N.toast("Excel file downloaded.", "success");
    });

    /* =========================================================
       INIT
       ========================================================= */

    applyFilters();

})();
