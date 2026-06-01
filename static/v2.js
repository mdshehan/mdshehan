(() => {
    const form = document.getElementById("form");
    const textarea = document.getElementById("urls");
    const counter = document.getElementById("count");
    const submit = document.getElementById("submit");
    const clearBtn = document.getElementById("clear");
    const results = document.getElementById("results");
    const progressWrap = document.getElementById("progress-wrap");
    const progressFill = document.getElementById("progress-fill");
    const progressText = document.getElementById("progress-text");
    const batchActions = document.getElementById("batch-actions");
    const dlAllHd = document.getElementById("download-all-hd");
    const dlAllSd = document.getElementById("download-all-sd");
    const batchSummary = document.getElementById("batch-summary");

    const MAX = 20;
    let lastResults = [];

    const parseLines = () =>
        textarea.value
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);

    const updateCount = () => {
        const n = parseLines().length;
        counter.textContent = n > MAX ? `${n} (only first ${MAX} will be used)` : n;
    };

    const escapeHtml = (s) =>
        String(s ?? "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[c]));

    const buildFilename = (title, quality, idx) => {
        const base = (title || `facebook-video-${idx + 1}`)
            .replace(/[\\/:*?"<>|]+/g, "")
            .replace(/\s+/g, "_")
            .slice(0, 60) || `facebook-video-${idx + 1}`;
        return `${base}_${quality}.mp4`;
    };

    const renderPending = (urls) => {
        results.innerHTML = urls.map((u, i) => `
            <div class="item pending" data-i="${i}">
                <div class="spinner" aria-label="loading"></div>
                <div class="body">
                    <p class="title">Fetching…</p>
                    <div class="url">${escapeHtml(u)}</div>
                </div>
            </div>
        `).join("");
    };

    const renderItem = (idx, res) => {
        const node = results.querySelector(`[data-i="${idx}"]`);
        if (!node) return;

        if (!res.ok) {
            node.className = "item error";
            node.innerHTML = `
                <div class="body">
                    <p class="title">Could not fetch</p>
                    <div class="url">${escapeHtml(res.input)}</div>
                    <div class="err">${escapeHtml(res.error)}</div>
                </div>
            `;
            return;
        }

        const d = res.data;
        const proxy = (u, name) => `/download?url=${encodeURIComponent(u)}&filename=${encodeURIComponent(name)}`;
        const links = [];
        if (d.hd_url) {
            const fn = buildFilename(d.title, "HD", idx);
            links.push(`<a href="${escapeHtml(proxy(d.hd_url, fn))}" download="${escapeHtml(fn)}"><span class="q">HD</span>.mp4</a>`);
        }
        if (d.sd_url) {
            const fn = buildFilename(d.title, "SD", idx);
            links.push(`<a href="${escapeHtml(proxy(d.sd_url, fn))}" download="${escapeHtml(fn)}"><span class="q">SD</span>.mp4</a>`);
        }

        node.className = "item success";
        node.innerHTML = `
            ${d.thumbnail
                ? `<img class="thumb" src="${escapeHtml(d.thumbnail)}" alt="thumbnail" referrerpolicy="no-referrer" />`
                : `<div class="thumb"></div>`}
            <div class="body">
                <p class="title">${escapeHtml(d.title || "Facebook video")}</p>
                <div class="url">${escapeHtml(d.source_url || res.input)}</div>
                <div class="links">${links.join("") || "<span class=\"err\">No streams found</span>"}</div>
            </div>
        `;
    };

    const triggerDownloads = (quality) => {
        const items = lastResults
            .map((r, i) => ({ r, i }))
            .filter(({ r }) => r.ok && r.data && (quality === "hd" ? r.data.hd_url : r.data.sd_url));

        if (!items.length) return;

        items.forEach(({ r, i }, n) => {
            setTimeout(() => {
                const url = quality === "hd" ? r.data.hd_url : r.data.sd_url;
                const fn = buildFilename(r.data.title, quality.toUpperCase(), i);
                const a = document.createElement("a");
                a.href = `/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fn)}`;
                a.download = fn;
                document.body.appendChild(a);
                a.click();
                a.remove();
            }, n * 700);
        });
    };

    textarea.addEventListener("input", updateCount);

    clearBtn.addEventListener("click", () => {
        textarea.value = "";
        results.innerHTML = "";
        progressWrap.classList.add("hidden");
        batchActions.classList.add("hidden");
        lastResults = [];
        updateCount();
        textarea.focus();
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const urls = parseLines().slice(0, MAX);
        if (!urls.length) return;

        submit.disabled = true;
        batchActions.classList.add("hidden");
        progressWrap.classList.remove("hidden");
        progressFill.style.width = "10%";
        progressText.textContent = `Fetching ${urls.length} link(s)…`;

        renderPending(urls);

        try {
            const res = await fetch("/api/extract-batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls }),
            });
            const json = await res.json();

            if (!res.ok || !json.ok) {
                progressText.textContent = json.error || `Request failed (${res.status})`;
                progressFill.style.width = "100%";
                return;
            }

            lastResults = json.results;
            json.results.forEach((r, i) => renderItem(i, r));

            const ok = json.results.filter((r) => r.ok).length;
            const fail = json.results.length - ok;
            progressFill.style.width = "100%";
            progressText.textContent = `Done. ${ok} succeeded, ${fail} failed.`;

            if (ok > 0) {
                batchActions.classList.remove("hidden");
                batchSummary.textContent = `${ok} video(s) ready`;
            }
        } catch (err) {
            progressText.textContent = "Network error: " + err.message;
            progressFill.style.width = "100%";
        } finally {
            submit.disabled = false;
        }
    });

    dlAllHd.addEventListener("click", () => triggerDownloads("hd"));
    dlAllSd.addEventListener("click", () => triggerDownloads("sd"));

    updateCount();
})();
