(() => {
    const form = document.getElementById("form");
    const input = document.getElementById("url");
    const submit = document.getElementById("submit");
    const status = document.getElementById("status");
    const result = document.getElementById("result");

    const setStatus = (msg, kind = "") => {
        status.textContent = msg || "";
        status.className = "status" + (kind ? " " + kind : "");
    };

    const escapeHtml = (s) =>
        String(s ?? "").replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[c]));

    const buildFilename = (title, quality) => {
        const base = (title || "facebook-video")
            .replace(/[\\/:*?"<>|]+/g, "")
            .replace(/\s+/g, "_")
            .slice(0, 60) || "facebook-video";
        return `${base}_${quality}.mp4`;
    };

    const renderResult = (data) => {
        const links = [];
        if (data.hd_url) {
            links.push({ quality: "HD", url: data.hd_url });
        }
        if (data.sd_url) {
            links.push({ quality: "SD", url: data.sd_url });
        }

        const thumb = data.thumbnail
            ? `<img src="${escapeHtml(data.thumbnail)}" alt="thumbnail" referrerpolicy="no-referrer" />`
            : "";

        const linksHtml = links.map((l) => {
            const filename = buildFilename(data.title, l.quality);
            const proxied = `/download?url=${encodeURIComponent(l.url)}&filename=${encodeURIComponent(filename)}`;
            return `
            <a class="download-link"
               href="${escapeHtml(proxied)}"
               download="${escapeHtml(filename)}">
                <span><span class="quality">${l.quality}</span> &nbsp;Download .mp4</span>
                <span class="arrow">&darr;</span>
            </a>
        `;}).join("");

        result.innerHTML = `
            <div class="preview">
                ${thumb}
                <div class="meta">
                    <h2>${escapeHtml(data.title || "Facebook video")}</h2>
                    ${data.source_url ? `<div class="source">${escapeHtml(data.source_url)}</div>` : ""}
                </div>
            </div>
            <div class="downloads">${linksHtml}</div>
            <p class="hint">
                Downloads stream through this server so your browser saves the file
                instead of opening it in a new tab.
            </p>
        `;
        result.classList.remove("hidden");
    };

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const url = input.value.trim();
        if (!url) return;

        submit.disabled = true;
        setStatus("Fetching video…");
        result.classList.add("hidden");
        result.innerHTML = "";

        try {
            const res = await fetch("/api/extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });
            const json = await res.json();

            if (!res.ok || !json.ok) {
                setStatus(json.error || `Request failed (${res.status})`, "error");
                return;
            }

            setStatus("Ready. Click a link below to download.", "success");
            renderResult(json.data);
        } catch (err) {
            setStatus("Network error: " + err.message, "error");
        } finally {
            submit.disabled = false;
        }
    });
})();
