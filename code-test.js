/* =============================================================
   NOVEM CONTROLS — LIVE CODING TEST
   Runs real code using the public Piston execution API
   (https://github.com/engineer-man/piston) — no API key needed.
   ========================================================= */

(function () {
    "use strict";

    const N = window.Novem;
    const PISTON_BASE = "https://emkc.org/api/v2/piston";

    const languageSelect = document.getElementById("languageSelect");
    const editor = document.getElementById("codeEditor");
    const editorLangLabel = document.getElementById("editorLangLabel");
    const outputBody = document.getElementById("outputBody");
    const statusTag = document.getElementById("codeStatusTag");
    const runBtn = document.getElementById("runCodeBtn");
    const loadSampleBtn = document.getElementById("loadSampleBtn");
    const clearCodeBtn = document.getElementById("clearCodeBtn");
    const runMetaRow = document.getElementById("runMetaRow");
    const exitCodeVal = document.getElementById("exitCodeVal");
    const runtimeVal = document.getElementById("runtimeVal");
    const execTimeVal = document.getElementById("execTimeVal");
    const historyTable = document.getElementById("historyTable");
    const historyBody = document.getElementById("historyBody");
    const historyEmpty = document.getElementById("historyEmpty");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");
    const livePill = document.querySelector(".live-pill");

    let runtimes = [];
    let history = [];

    const SAMPLES = {
        javascript: 'console.log("Hello from NOVEM CONTROLS!");',
        typescript: 'const greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet("NOVEM CONTROLS"));',
        python: 'print("Hello from NOVEM CONTROLS!")',
        java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from NOVEM CONTROLS!");\n    }\n}',
        c: '#include <stdio.h>\n\nint main() {\n    printf("Hello from NOVEM CONTROLS!\\n");\n    return 0;\n}',
        cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello from NOVEM CONTROLS!" << std::endl;\n    return 0;\n}',
        csharp: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello from NOVEM CONTROLS!");\n    }\n}',
        go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from NOVEM CONTROLS!")\n}',
        ruby: 'puts "Hello from NOVEM CONTROLS!"',
        php: '<?php\necho "Hello from NOVEM CONTROLS!\\n";',
        rust: 'fn main() {\n    println!("Hello from NOVEM CONTROLS!");\n}'
    };

    /* =========================================================
       LOAD RUNTIMES
       ========================================================= */

    async function loadRuntimes() {
        try {
            const res = await fetch(PISTON_BASE + "/runtimes");
            if (!res.ok) throw new Error("Could not reach compiler service.");
            runtimes = await res.json();

            const byLanguage = {};
            runtimes.forEach(function (rt) {
                // Keep the first (latest-listed) version per language
                if (!byLanguage[rt.language]) byLanguage[rt.language] = rt;
            });

            const languages = Object.keys(byLanguage).sort();

            languageSelect.innerHTML = languages.map(function (lang) {
                return '<option value="' + lang + '">' + lang + " (" + byLanguage[lang].version + ")</option>";
            }).join("");

            // Prefer javascript as the default if available
            if (byLanguage["javascript"]) languageSelect.value = "javascript";

            updateEditorLabel();
            if (!editor.value) loadSample();

        } catch (err) {
            console.error(err);
            livePill.classList.add("offline");
            livePill.innerHTML = "<span></span> COMPILER UNAVAILABLE";
            languageSelect.innerHTML = '<option value="">No languages available — check your connection</option>';
            N.toast("Could not connect to the live compiler service.", "error");
        }
    }

    function currentRuntime() {
        return runtimes.find(function (rt) { return rt.language === languageSelect.value; });
    }

    function updateEditorLabel() {
        const rt = currentRuntime();
        editorLangLabel.textContent = rt ? rt.language + " " + rt.version : "Select a language to begin";
    }

    languageSelect.addEventListener("change", updateEditorLabel);

    /* =========================================================
       SAMPLE / CLEAR
       ========================================================= */

    function loadSample() {
        const lang = languageSelect.value;
        editor.value = SAMPLES[lang] || ("// Sample not available for " + lang + " — write your own code here.");
    }

    loadSampleBtn.addEventListener("click", loadSample);

    clearCodeBtn.addEventListener("click", function () {
        editor.value = "";
        outputBody.innerHTML = '<span class="placeholder">Run your code to see live output here…</span>';
        runMetaRow.style.display = "none";
        statusTag.textContent = "Idle";
        statusTag.className = "code-status-tag idle";
    });

    /* =========================================================
       RUN CODE
       ========================================================= */

    function escapeHtml(str) {
        return String(str).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; });
    }

    function fmtTime() {
        return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }

    runBtn.addEventListener("click", async function () {
        const rt = currentRuntime();
        const code = editor.value;

        if (!rt) {
            N.toast("Select a language first.", "error");
            return;
        }
        if (!code.trim()) {
            N.toast("Write some code before running.", "error");
            return;
        }

        runBtn.disabled = true;
        statusTag.textContent = "Running";
        statusTag.className = "code-status-tag running";
        outputBody.innerHTML = '<span class="placeholder">Running your code…</span>';
        runMetaRow.style.display = "none";

        const started = performance.now();

        try {
            const res = await fetch(PISTON_BASE + "/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    language: rt.language,
                    version: rt.version,
                    files: [{ content: code }]
                })
            });

            const data = await res.json();
            const elapsed = Math.round(performance.now() - started);

            if (!res.ok) throw new Error(data.message || "Execution failed.");

            const run = data.run || {};
            const compile = data.compile || {};
            const stdout = (run.stdout || "");
            const stderr = (compile.stderr || run.stderr || "");
            const exitCode = run.code === null || run.code === undefined ? "—" : run.code;
            const success = (run.code === 0) && !stderr;

            let outHtml = "";
            if (stdout) outHtml += '<span class="out-line">' + escapeHtml(stdout) + "</span>";
            if (stderr) outHtml += (outHtml ? "\n" : "") + '<span class="err-line">' + escapeHtml(stderr) + "</span>";
            if (!outHtml) outHtml = '<span class="placeholder">(no output)</span>';

            outputBody.innerHTML = outHtml;

            statusTag.textContent = success ? "Pass" : "Fail";
            statusTag.className = "code-status-tag " + (success ? "pass" : "fail");

            exitCodeVal.textContent = exitCode;
            runtimeVal.textContent = rt.language + " " + rt.version;
            execTimeVal.textContent = elapsed + " ms";
            runMetaRow.style.display = "flex";

            addHistory(rt.language, code, success);

        } catch (err) {
            console.error(err);
            outputBody.innerHTML = '<span class="err-line">' + escapeHtml(err.message || "Something went wrong contacting the compiler service.") + "</span>";
            statusTag.textContent = "Fail";
            statusTag.className = "code-status-tag fail";
            addHistory(rt.language, code, false);
        } finally {
            runBtn.disabled = false;
        }
    });

    /* =========================================================
       RUN HISTORY (this session)
       ========================================================= */

    function addHistory(language, code, success) {
        history.unshift({
            time: fmtTime(),
            language: language,
            snippet: code.trim().split("\n")[0].slice(0, 60),
            success: success
        });
        history = history.slice(0, 25);
        renderHistory();
    }

    function renderHistory() {
        if (history.length === 0) {
            historyTable.style.display = "none";
            historyEmpty.style.display = "block";
            return;
        }

        historyTable.style.display = "table";
        historyEmpty.style.display = "none";

        historyBody.innerHTML = history.map(function (h) {
            const failedStyle = h.success ? "" : ' style="background:#fff0f0; color:#d64545;"';
            return "<tr><td>" + h.time + "</td><td>" + h.language + "</td><td><code>" + escapeHtml(h.snippet) + "</code></td>" +
                '<td><span class="status ' + (h.success ? "delivered" : "") + '"' + failedStyle + '>' + (h.success ? "Success" : "Failed") + "</span></td></tr>";
        }).join("");
    }

    clearHistoryBtn.addEventListener("click", function () {
        history = [];
        renderHistory();
    });

    /* =========================================================
       INIT
       ========================================================= */

    loadRuntimes();
    renderHistory();

})();
