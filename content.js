// NeoX - Final Build
// Targeted hidden-text and prompt-injection detection

console.log("NeoX: Heuristic scanner started.");

const PANEL_ID = "canarytrap-warning-panel";
const MINI_BADGE_ID = "canarytrap-mini-badge";
let scanTimer = null;
let isPanelDismissed = false;
let isPanelMaximized = false;
let previousFindingCount = 0;

let isVisitDismissed = false;
if (sessionStorage.getItem("canarytrap_dismissed") === "true") {
    const navEntry = performance.getEntriesByType("navigation")[0];
    const isReload = navEntry && navEntry.type === "reload";
    let isSameOriginNav = false;
    if (document.referrer) {
        try {
            if (new URL(document.referrer).origin === window.location.origin) {
                isSameOriginNav = true;
            }
        } catch(e) {}
    }
    if (!isReload && !isSameOriginNav) {
        sessionStorage.removeItem("canarytrap_dismissed");
    } else {
        isVisitDismissed = true;
    }
}

let isOriginTrusted = false;
if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["trusted_origins"], (result) => {
        const list = result.trusted_origins || [];
        if (list.includes(window.location.origin)) {
            isOriginTrusted = true;
            hideAllUI();
        }
    });
}

function hideAllUI() {
    const badge = document.getElementById(MINI_BADGE_ID);
    if (badge) badge.style.display = "none";
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.style.display = "none";
}

function updateMiniBadge(findings, isError = false) {
    if (isOriginTrusted || isVisitDismissed) {
        hideAllUI();
        return;
    }
    const count = findings.length;
    let badge = document.getElementById(MINI_BADGE_ID);

    const highestRisk = count > 0 ? Math.max(...findings.map(f => f.overallRisk)) : 0;
    
    let bgColor = "#2563EB"; // Blue (neutral)
    let glow = "none";
    
    if (count > 0) {
        if (highestRisk >= 80) {
            bgColor = "#EF4444"; // Red
            glow = "0 0 0 2px rgba(239, 68, 68, 1)"; // Stable red border/glow
        } else {
            bgColor = "#F59E0B"; // Amber
            glow = "0 0 0 2px rgba(245, 158, 11, 0.8)";
        }
    }

    if (!badge) {
        badge = document.createElement("button");
        badge.id = MINI_BADGE_ID;
        
        let savedX = localStorage.getItem("canarytrap_widget_x");
        let savedY = localStorage.getItem("canarytrap_widget_y");
        let startRight = "24px"; let startBottom = "24px";
        let startLeft = "auto"; let startTop = "auto";
        if (savedX !== null && savedY !== null) {
            let x = parseInt(savedX, 10);
            let y = parseInt(savedY, 10);
            x = Math.max(0, Math.min(x, window.innerWidth - 56));
            y = Math.max(0, Math.min(y, window.innerHeight - 56));
            startLeft = x + "px";
            startTop = y + "px";
            startRight = "auto";
            startBottom = "auto";
        }

        Object.assign(badge.style, {
            position: "fixed",
            bottom: startBottom,
            right: startRight,
            left: startLeft,
            top: startTop,
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.2)",
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: "2147483646",
            transition: "background 0.3s ease, box-shadow 0.3s ease",
            touchAction: "none"
        });
        
        badge.innerHTML = `
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <div id="canarytrap-badge-count" style="
                position: absolute;
                top: -4px;
                right: -4px;
                background: #111827;
                color: white;
                font-family: Arial, sans-serif;
                font-size: 11px;
                font-weight: bold;
                min-width: 20px;
                height: 20px;
                padding: 0 4px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid white;
            ">0</div>
        `;

        let isDragging = false;
        let dragStartX = 0; let dragStartY = 0;
        let initialLeft = 0; let initialTop = 0;

        badge.addEventListener("pointerdown", (e) => {
            isDragging = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            const rect = badge.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            badge.style.right = 'auto';
            badge.style.bottom = 'auto';
            badge.style.left = initialLeft + "px";
            badge.style.top = initialTop + "px";
            badge.style.transition = "none";
            badge.setPointerCapture(e.pointerId);
        });

        badge.addEventListener("pointermove", (e) => {
            if (badge.hasPointerCapture(e.pointerId)) {
                const dx = e.clientX - dragStartX;
                const dy = e.clientY - dragStartY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;
                if (isDragging) {
                    let newLeft = initialLeft + dx;
                    let newTop = initialTop + dy;
                    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - 56));
                    newTop = Math.max(0, Math.min(newTop, window.innerHeight - 56));
                    badge.style.left = newLeft + "px";
                    badge.style.top = newTop + "px";
                }
            }
        });

        badge.addEventListener("pointerup", (e) => {
            badge.style.transition = "background 0.3s ease, box-shadow 0.3s ease";
            badge.releasePointerCapture(e.pointerId);
            if (isDragging) {
                const rect = badge.getBoundingClientRect();
                localStorage.setItem("canarytrap_widget_x", Math.round(rect.left));
                localStorage.setItem("canarytrap_widget_y", Math.round(rect.top));
            }
        });

        badge.addEventListener("click", (e) => {
            if (isDragging) return;
            isPanelDismissed = false;
            badge.style.display = "none";
            
            // If scanner crashed, we shouldn't show a panel with fake findings.
            // But we don't have scanner state here easily without changing signature.
            // Using scanForHiddenText() ensures latest state is shown.
            try {
                showWarningPanel(scanForHiddenText());
            } catch(err) {
                console.error("NeoX failed to open panel", err);
            }
        });
        document.body.appendChild(badge);
    }
    
    // Apply styles or error state
    if (isError) {
        badge.style.background = "#64748B"; // Gray for error
        badge.style.boxShadow = "none";
        badge.title = "NeoX: Scanner Error";
    } else {
        badge.style.background = bgColor;
        badge.style.boxShadow = glow;
        badge.title = count === 0 ? "NeoX: No findings" : "NeoX Security Widget";
    }

    const countEl = document.getElementById("canarytrap-badge-count");
    if (countEl) {
        if (isError) {
            countEl.textContent = "!";
            countEl.style.display = "flex";
        } else {
            countEl.textContent = count;
            countEl.style.display = "flex";
        }
    }
    
    const panel = document.getElementById(PANEL_ID);
    const isPanelOpen = panel && panel.style.display === "flex";

    if (isPanelDismissed || isError || (count === 0 && !isPanelOpen)) {
        badge.style.display = "flex";
    } else {
        badge.style.display = "none";
    }
}

// Detect suspicious instruction-like language.
const INSTRUCTION_PATTERNS = [
    /\bignore\b.{0,50}\b(previous|prior|above|all)\b.{0,30}\binstructions?\b/i,
    /\b(disregard|override|bypass)\b.{0,50}\b(instructions?|rules?|safety|restrictions?)\b/i,
    /\b(reveal|disclose|expose|leak)\b.{0,40}\b(secrets?|passwords?|credentials?|system prompt|confidential information)\b/i,
    /\b(system prompt|hidden instructions?)\b.{0,40}\b(reveal|print|show|disclose|ignore)\b/i,
    /\byou are now\b.{0,50}\b(unrestricted|unfiltered|a different assistant)\b/i,
    /\bdo not follow\b.{0,40}\b(previous|original|system)\b.{0,20}\binstructions?\b/i
];

const INVISIBLE_UNICODE =
    /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/;

function hasDirectText(el) {
    return Array.from(el.childNodes).some(node =>
        node.nodeType === Node.TEXT_NODE &&
        node.nodeValue.trim().length > 0
    );
}

function getHiddenEvidence(el) {
    let current = el;
    let best = null;

    while (current && current !== document.documentElement) {
        const style = window.getComputedStyle(current);
        const rect = current.getBoundingClientRect();

        let evidence = null;

        if (style.display === "none") {
            evidence = { reason: "Hidden via CSS (display: none)", score: 80 };
        } else if (style.visibility === "hidden" || style.visibility === "collapse") {
            evidence = { reason: `Hidden via CSS (visibility: ${style.visibility})`, score: 75 };
        } else if (parseFloat(style.opacity) < 0.05) {
            evidence = { reason: `Near-transparent (opacity: ${style.opacity})`, score: 70 };
        } else if (parseFloat(style.fontSize) < 2) {
            evidence = { reason: `Microscopic font size (${style.fontSize})`, score: 65 };
        } else if (style.position === "absolute" || style.position === "fixed") {
            const outside = rect.right < -100 || rect.bottom < -100 || rect.left > window.innerWidth + 100 || rect.top > window.innerHeight + 100;
            if (outside) {
                evidence = { reason: "Positioned outside visible viewport", score: 60 };
            }
        }

        if (evidence && (!best || evidence.score > best.score)) {
            best = evidence;
        }
        current = current.parentElement;
    }
    return best;
}

function analyzeHiddenText(el) {
    const hidden = getHiddenEvidence(el);
    if (!hidden) return null;

    const text = el.textContent.trim();
    if (!text) return null;

    const instructionMatches = INSTRUCTION_PATTERNS.some(pattern => pattern.test(text));
    const hasInvisibleUnicode = INVISIBLE_UNICODE.test(text);

    const isMicroscopic = typeof hidden.reason === "string" && hidden.reason.startsWith("Microscopic");
    if (!instructionMatches && !hasInvisibleUnicode && !isMicroscopic) {
        return null;
    }

    const instructionRisk = instructionMatches ? 90 : 0;
    const unicodeRisk = hasInvisibleUnicode ? 65 : 0;

    const overallRisk = Math.max(hidden.score, instructionRisk, unicodeRisk);

    const reasons = [hidden.reason];
    if (instructionMatches) reasons.push("Text matches a suspicious instruction pattern");
    if (hasInvisibleUnicode) reasons.push("Potentially suspicious invisible Unicode characters detected");

    return {
        tag: el.tagName.toLowerCase(),
        timestamp: new Date().toISOString(),
        text: text.length > 200 ? text.substring(0, 200) + "..." : text,
        hiddenRisk: hidden.score,
        instructionRisk,
        unicodeRisk,
        overallRisk,
        reasons
    };
}

function scanForHiddenText() {
    const findings = [];
    document.querySelectorAll("body *").forEach(el => {
        if (isInsidePanel(el)) return;
        if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName)) return;
        if (!hasDirectText(el)) return;

        const finding = analyzeHiddenText(el);
        if (!finding) return;

        const duplicate = findings.some(existing =>
            existing.text === finding.text &&
            existing.reasons.join("|") === finding.reasons.join("|")
        );

        if (!duplicate) findings.push(finding);
    });
    return findings;
}

function addText(parent, tag, text, styles = {}) {
    const el = document.createElement(tag);
    el.textContent = text;
    Object.assign(el.style, styles);
    parent.appendChild(el);
    return el;
}

function makeBar(parent, label, score, color) {
    const row = document.createElement("div");
    row.style.marginBottom = "12px";

    const heading = document.createElement("div");
    Object.assign(heading.style, { display: "flex", justifyContent: "space-between", gap: "8px", fontSize: "12px", marginBottom: "5px" });
    addText(heading, "span", label);
    addText(heading, "strong", score ? `${score}/100` : "No signal");

    const track = document.createElement("div");
    Object.assign(track.style, { height: "6px", background: "#293449", borderRadius: "6px", overflow: "hidden" });

    const fill = document.createElement("div");
    Object.assign(fill.style, { height: "100%", width: `${score}%`, background: color, borderRadius: "6px" });

    track.appendChild(fill);
    row.append(heading, track);
    parent.appendChild(row);
}

function showWarningPanel(findings) {
    if (isOriginTrusted || isVisitDismissed) {
        hideAllUI();
        return;
    }

    let panel = document.getElementById(PANEL_ID);
    const findingsSignature = findings.map(f => f.text + f.overallRisk).join('|');

    if (panel && panel.dataset.findingsSignature === findingsSignature) {
        // Findings haven't changed. Just update visibility safely.
        panel.style.width = isPanelMaximized ? "calc(100vw - 40px)" : "360px";
        panel.style.height = isPanelMaximized ? "calc(100vh - 40px)" : "auto";
        if (isPanelMaximized) {
            panel.style.left = "20px";
            panel.style.top = "20px";
            panel.style.right = "auto";
            panel.style.bottom = "auto";
        } else {
            let savedPX = localStorage.getItem("canarytrap_panel_x");
            let savedPY = localStorage.getItem("canarytrap_panel_y");
            if (savedPX !== null && savedPY !== null) {
                panel.style.left = savedPX + "px";
                panel.style.top = savedPY + "px";
                panel.style.right = "auto";
                panel.style.bottom = "auto";
            } else {
                panel.style.left = "auto";
                panel.style.top = "auto";
                panel.style.right = "20px";
                panel.style.bottom = "20px";
            }
        }
        panel.style.display = isPanelDismissed ? "none" : "flex";
        return;
    }

    if (!panel) {
        panel = document.createElement("div");
        panel.id = PANEL_ID;

        let savedPX = localStorage.getItem("canarytrap_panel_x");
        let savedPY = localStorage.getItem("canarytrap_panel_y");
        let pRight = "20px"; let pBottom = "20px";
        let pLeft = "auto"; let pTop = "auto";
        if (savedPX !== null && savedPY !== null) {
            let px = parseInt(savedPX, 10);
            let py = parseInt(savedPY, 10);
            px = Math.max(0, Math.min(px, window.innerWidth - 100));
            py = Math.max(0, Math.min(py, window.innerHeight - 40));
            pLeft = px + "px";
            pTop = py + "px";
            pRight = "auto";
            pBottom = "auto";
        }

        Object.assign(panel.style, {
            position: "fixed",
            bottom: pBottom,
            right: pRight,
            left: pLeft,
            top: pTop,
            boxSizing: "border-box",
            borderRadius: "12px",
            border: "1px solid #293449",
            background: "#0b1120",
            color: "#f8fafc",
            boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            fontFamily: "Arial, sans-serif",
            fontSize: "13px",
            zIndex: "2147483647",
            transition: "width 0.2s, height 0.2s",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
        });
        document.body.appendChild(panel);
    }

    panel.style.width = isPanelMaximized ? "calc(100vw - 40px)" : "360px";
    panel.style.maxWidth = "calc(100vw - 32px)";
    panel.style.height = isPanelMaximized ? "calc(100vh - 40px)" : "auto";
    panel.style.maxHeight = "calc(100vh - 40px)";

    if (isPanelMaximized) {
        panel.style.left = "20px";
        panel.style.top = "20px";
        panel.style.right = "auto";
        panel.style.bottom = "auto";
    } else {
        let savedPX = localStorage.getItem("canarytrap_panel_x");
        let savedPY = localStorage.getItem("canarytrap_panel_y");
        if (savedPX !== null && savedPY !== null) {
            panel.style.left = savedPX + "px";
            panel.style.top = savedPY + "px";
            panel.style.right = "auto";
            panel.style.bottom = "auto";
        } else {
            panel.style.left = "auto";
            panel.style.top = "auto";
            panel.style.right = "20px";
            panel.style.bottom = "20px";
        }
    }

    panel.replaceChildren();
    
    if (!isPanelDismissed) {
        panel.style.display = "flex";
    } else {
        panel.style.display = "none";
    }

    // --- TITLE BAR ---
    const titleBar = document.createElement("div");
    Object.assign(titleBar.style, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        background: "#162137",
        borderBottom: "1px solid #293449",
        flexShrink: "0",
        cursor: isPanelMaximized ? "default" : "move"
    });

    let isPanelDragging = false;
    let panelDragStartX = 0; let panelDragStartY = 0;
    let panelInitialLeft = 0; let panelInitialTop = 0;

    titleBar.addEventListener("pointerdown", (e) => {
        if (isPanelMaximized) return;
        if (e.target.closest("button")) return;
        
        isPanelDragging = false;
        panelDragStartX = e.clientX;
        panelDragStartY = e.clientY;
        const rect = panel.getBoundingClientRect();
        panelInitialLeft = rect.left;
        panelInitialTop = rect.top;
        
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.left = panelInitialLeft + "px";
        panel.style.top = panelInitialTop + "px";
        panel.style.transition = "none";
        
        titleBar.setPointerCapture(e.pointerId);
    });

    titleBar.addEventListener("pointermove", (e) => {
        if (titleBar.hasPointerCapture(e.pointerId)) {
            const dx = e.clientX - panelDragStartX;
            const dy = e.clientY - panelDragStartY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isPanelDragging = true;
            if (isPanelDragging) {
                let newLeft = panelInitialLeft + dx;
                let newTop = panelInitialTop + dy;
                newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - 100));
                newTop = Math.max(0, Math.min(newTop, window.innerHeight - 40));
                panel.style.left = newLeft + "px";
                panel.style.top = newTop + "px";
            }
        }
    });

    titleBar.addEventListener("pointerup", (e) => {
        if (isPanelMaximized) return;
        panel.style.transition = "width 0.2s, height 0.2s";
        titleBar.releasePointerCapture(e.pointerId);
        if (isPanelDragging) {
            const rect = panel.getBoundingClientRect();
            localStorage.setItem("canarytrap_panel_x", Math.round(rect.left));
            localStorage.setItem("canarytrap_panel_y", Math.round(rect.top));
        }
    });

    const brandArea = document.createElement("div");
    Object.assign(brandArea.style, { display: "flex", alignItems: "center", gap: "8px" });
    
    const brandIcon = document.createElement("span");
    brandIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
    const brandLabel = document.createElement("span");
    brandLabel.textContent = "NeoX";
    Object.assign(brandLabel.style, { fontWeight: "bold", fontSize: "12px", color: "#E2E8F0", letterSpacing: "0.5px" });
    brandArea.append(brandIcon, brandLabel);
    titleBar.appendChild(brandArea);

    const controls = document.createElement("div");
    Object.assign(controls.style, { display: "flex", gap: "12px", alignItems: "center" });

    const btnStyle = { background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", display: "flex", alignItems: "center" };

    const btnTrust = document.createElement("button");
    Object.assign(btnTrust.style, btnStyle);
    btnTrust.title = "Trust this website";
    btnTrust.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>`;
    btnTrust.addEventListener("click", () => {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(["trusted_origins"], (result) => {
                let list = result.trusted_origins || [];
                if (!list.includes(window.location.origin)) {
                    list.push(window.location.origin);
                    chrome.storage.local.set({ trusted_origins: list }, () => {
                        isOriginTrusted = true;
                        hideAllUI();
                    });
                }
            });
        }
    });

    const btnDismissVisit = document.createElement("button");
    Object.assign(btnDismissVisit.style, btnStyle);
    btnDismissVisit.title = "Dismiss for this visit";
    btnDismissVisit.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    btnDismissVisit.addEventListener("click", () => {
        sessionStorage.setItem("canarytrap_dismissed", "true");
        isVisitDismissed = true;
        hideAllUI();
    });

    const btnMinimize = document.createElement("button");
    Object.assign(btnMinimize.style, btnStyle);
    btnMinimize.title = "Minimize";
    btnMinimize.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    btnMinimize.addEventListener("click", () => {
        isPanelDismissed = true;
        panel.style.display = "none";
        updateMiniBadge(findings);
        previousFindingCount = findings.length;
    });

    const btnMaximize = document.createElement("button");
    Object.assign(btnMaximize.style, btnStyle);
    btnMaximize.title = isPanelMaximized ? "Restore" : "Maximize";
    btnMaximize.innerHTML = isPanelMaximized 
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="14" height="14" rx="2" ry="2"></rect><path d="M8 21h11a2 2 0 0 0 2-2v-11"></path></svg>`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;
    btnMaximize.addEventListener("click", () => {
        isPanelMaximized = !isPanelMaximized;
        showWarningPanel(findings);
    });

    const btnClose = document.createElement("button");
    Object.assign(btnClose.style, btnStyle);
    btnClose.title = "Close";
    btnClose.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    btnClose.addEventListener("click", () => {
        isPanelDismissed = true;
        panel.style.display = "none";
        updateMiniBadge(findings);
        previousFindingCount = findings.length;
    });

    controls.append(btnTrust, btnDismissVisit, btnMinimize, btnMaximize, btnClose);
    titleBar.appendChild(controls);
    panel.appendChild(titleBar);

    // --- CONTENT AREA ---
    const contentArea = document.createElement("div");
    const hasFindings = findings.length > 0;
    const isHighRisk = hasFindings ? Math.max(...findings.map(f => f.overallRisk)) >= 80 : false;
    
    Object.assign(contentArea.style, {
        padding: "18px",
        overflowY: "auto",
        flexGrow: "1",
        borderLeft: hasFindings ? (isHighRisk ? "4px solid #f43f5e" : "4px solid #f59e0b") : "4px solid #3b82f6"
    });

    const header = document.createElement("div");
    Object.assign(header.style, { display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" });

    const iconStr = hasFindings ? "!" : "✓";
    const iconBg = hasFindings ? (isHighRisk ? "#3b1720" : "#3b2e17") : "#172f3b";
    const iconColor = hasFindings ? (isHighRisk ? "#fb7185" : "#fbbf24") : "#60a5fa";
    
    const icon = addText(header, "div", iconStr, { width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "9px", background: iconBg, color: iconColor, fontWeight: "bold", fontSize: "22px", flexShrink: "0" });

    const brand = document.createElement("div");
    addText(brand, "div", hasFindings ? "THREAT DETECTED" : "NO THREATS DETECTED", { fontSize: "16px", fontWeight: "bold", color: hasFindings ? "white" : "#e2e8f0" });
    addText(brand, "div", "HEURISTIC SCANNER RESULTS", { marginTop: "4px", fontSize: "9px", letterSpacing: "1px", color: "#94a3b8" });
    header.append(icon, brand);

    const badgeText = hasFindings ? "ALERT" : "SAFE";
    const badgeBg = hasFindings ? (isHighRisk ? "#4c1726" : "#4c3a17") : "#173b4c";
    const badgeColor = hasFindings ? (isHighRisk ? "#fda4af" : "#fde68a") : "#93c5fd";
    const badge = addText(header, "div", badgeText, { marginLeft: "auto", padding: "5px 7px", borderRadius: "5px", background: badgeBg, color: badgeColor, fontSize: "10px", fontWeight: "bold" });
    contentArea.appendChild(header);

    const averageLabel = document.createElement("div");
    Object.assign(averageLabel.style, { borderTop: "1px solid #293449", paddingTop: "14px", marginBottom: "8px", color: "#94a3b8", fontSize: "10px", letterSpacing: "1px" });
    averageLabel.textContent = "OVERALL RISK SCORE";
    contentArea.appendChild(averageLabel);

    const overallScore = findings.length > 0 ? Math.max(...findings.map(f => f.overallRisk)) : 0;
    const scoreRow = document.createElement("div");
    Object.assign(scoreRow.style, { display: "flex", alignItems: "baseline", gap: "5px", marginBottom: "8px" });
    let scoreColor = "#60a5fa"; // blue for 0
    if (overallScore >= 80) scoreColor = "#fb7185";
    else if (overallScore > 0) scoreColor = "#fbbf24";
    
    addText(scoreRow, "span", String(overallScore), { fontSize: "38px", fontWeight: "bold", color: scoreColor });
    addText(scoreRow, "span", "/100", { color: "#94a3b8", fontSize: "14px" });
    contentArea.appendChild(scoreRow);

    const overallTrack = document.createElement("div");
    Object.assign(overallTrack.style, { height: "7px", borderRadius: "8px", background: "#293449", overflow: "hidden", marginBottom: "10px" });
    const overallFill = document.createElement("div");
    
    let trackFillColor = "#3b82f6";
    if (overallScore >= 80) trackFillColor = "#f43f5e";
    else if (overallScore > 0) trackFillColor = "#f59e0b";
    
    Object.assign(overallFill.style, { height: "100%", width: `${Math.max(overallScore, 1)}%`, borderRadius: "8px", background: trackFillColor });
    overallTrack.appendChild(overallFill);
    contentArea.appendChild(overallTrack);

    addText(contentArea, "div", `${findings.length} suspicious hidden text finding(s)`, { color: "#cbd5e1", fontSize: "12px", marginBottom: "16px" });

    addText(contentArea, "div", "RISK BREAKDOWN", { paddingTop: "14px", borderTop: "1px solid #293449", marginBottom: "12px", color: "#94a3b8", fontSize: "10px", letterSpacing: "1px" });
    
    const highestHidden = findings.length > 0 ? Math.max(...findings.map(f => f.hiddenRisk)) : 0;
    const highestInstruction = findings.length > 0 ? Math.max(...findings.map(f => f.instructionRisk)) : 0;
    const highestUnicode = findings.length > 0 ? Math.max(...findings.map(f => f.unicodeRisk)) : 0;

    makeBar(contentArea, "Hidden-text risk", highestHidden, "#f59e0b");
    makeBar(contentArea, "Suspicious-instruction risk", highestInstruction, "#f43f5e");
    makeBar(contentArea, "Invisible Unicode signal", highestUnicode, "#a78bfa");

    if (hasFindings) {
        addText(contentArea, "div", "WHY WAS THIS FLAGGED?", { paddingTop: "8px", borderTop: "1px solid #293449", marginBottom: "12px", color: "#94a3b8", fontSize: "10px", letterSpacing: "1px" });
    }

    findings.forEach((finding, index) => {
        const card = document.createElement("div");
        Object.assign(card.style, { padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #293449", background: "#111b2c" });

        const title = document.createElement("div");
        Object.assign(title.style, { display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "10px", fontWeight: "bold" });
        const titleLabel = document.createElement("span");
        titleLabel.textContent = `Finding ${index + 1} \u00B7 <${finding.tag}>`;
        title.appendChild(titleLabel);
        addText(title, "span", `${finding.overallRisk}/100`, { color: finding.overallRisk >= 80 ? "#fb7185" : "#fbbf24", whiteSpace: "nowrap" });
        card.appendChild(title);

        finding.reasons.forEach(reason => {
            addText(card, "div", `• ${reason}`, { color: "#cbd5e1", fontSize: "12px", lineHeight: "1.5", marginBottom: "6px" });
        });

        const toggle = document.createElement("button");
        toggle.textContent = "View suspicious payload";
        Object.assign(toggle.style, { marginTop: "8px", padding: "7px 9px", background: "#263449", color: "#f8fafc", border: "1px solid #475569", borderRadius: "5px", cursor: "pointer", fontSize: "11px" });

        const preview = document.createElement("pre");
        preview.textContent = finding.text;
        Object.assign(preview.style, { display: "none", whiteSpace: "pre-wrap", overflowWrap: "anywhere", padding: "10px", borderRadius: "6px", background: "#301923", color: "#fda4af", fontSize: "12px", marginTop: "10px" });

        toggle.addEventListener("click", () => {
            const opening = preview.style.display === "none";
            preview.style.display = opening ? "block" : "none";
            toggle.textContent = opening ? "Hide suspicious payload" : "View suspicious payload";
        });
        card.append(toggle, preview);

        const reportButton = document.createElement("button");
        reportButton.textContent = "Generate finding report";
        Object.assign(reportButton.style, { display: "block", marginTop: "10px", padding: "8px 10px", background: "#163b4a", color: "#f8fafc", border: "1px solid #28708a", borderRadius: "5px", cursor: "pointer", fontSize: "11px" });

        const reportArea = document.createElement("div");
        reportArea.style.display = "none";
        reportArea.style.marginTop = "10px";

        const reportText = [
            "NEOX - FINDING REPORT",
            "================================",
            `Timestamp (UTC): ${finding.timestamp}`,
            `Risk score: ${finding.overallRisk}/100`,
            `HTML element: <${finding.tag}>`,
            "",
            "RISK SIGNALS",
            `Hidden-text score: ${finding.hiddenRisk}/100`,
            `Suspicious-instruction score: ${finding.instructionRisk}/100`,
            `Invisible-Unicode score: ${finding.unicodeRisk}/100`,
            "",
            "DETECTION REASONS",
            ...finding.reasons.map(reason => `- ${reason}`),
            "",
            "EVIDENCE PREVIEW",
            finding.text,
            "",
            "Note: Heuristic detection is not proof of malicious activity."
        ].join("\n");

        const reportBox = document.createElement("textarea");
        reportBox.value = reportText;
        reportBox.readOnly = true;
        reportBox.setAttribute("aria-label", "Finding report");
        Object.assign(reportBox.style, { display: "block", width: "100%", minHeight: "220px", boxSizing: "border-box", padding: "9px", background: "#080d18", color: "#e2e8f0", border: "1px solid #475569", borderRadius: "5px", fontSize: "11px", lineHeight: "1.5", resize: "vertical" });

        const copyButton = document.createElement("button");
        copyButton.textContent = "Copy report";
        Object.assign(copyButton.style, { marginTop: "8px", padding: "8px 10px", background: "#166534", color: "#ffffff", border: "1px solid #22c55e", borderRadius: "5px", cursor: "pointer", fontSize: "11px" });

        const copyStatus = document.createElement("div");
        copyStatus.setAttribute("role", "status");
        copyStatus.style.marginTop = "6px";
        copyStatus.style.color = "#cbd5e1";
        copyStatus.style.fontSize = "11px";

        copyButton.addEventListener("click", async () => {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(reportBox.value);
                    copyStatus.textContent = "Report copied successfully.";
                } else {
                    throw new Error("Clipboard API unavailable");
                }
            } catch {
                reportBox.focus();
                reportBox.select();
                const copied = document.execCommand("copy");
                copyStatus.textContent = copied ? "Report copied successfully." : "Automatic copy unavailable. Select the report text and copy it manually.";
            }
        });

        reportButton.addEventListener("click", () => {
            const opening = reportArea.style.display === "none";
            reportArea.style.display = opening ? "block" : "none";
            reportButton.textContent = opening ? "Hide finding report" : "Generate finding report";
        });

        reportArea.append(reportBox, copyButton, copyStatus);
        card.append(reportButton, reportArea);
        contentArea.appendChild(card);
    });

    if (hasFindings) {
        const footer = document.createElement("div");
        Object.assign(footer.style, { color: "#94a3b8", fontSize: "10px", lineHeight: "1.5", margin: "12px 0" });
        footer.textContent = "Scores are heuristic indicators, not proof of malicious activity.";
        contentArea.appendChild(footer);
    }

    const trustSection = document.createElement("div");
    Object.assign(trustSection.style, { marginTop: "24px", paddingTop: "14px", borderTop: "1px solid #293449" });
    addText(trustSection, "div", "TRUSTED WEBSITES", { marginBottom: "8px", color: "#94a3b8", fontSize: "10px", letterSpacing: "1px" });
    const trustList = document.createElement("div");
    trustSection.appendChild(trustList);

    function renderTrustList() {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(["trusted_origins"], (result) => {
                const list = result.trusted_origins || [];
                trustList.replaceChildren();
                if (list.length === 0) {
                    addText(trustList, "div", "No websites are currently trusted.", { color: "#cbd5e1", fontSize: "11px" });
                } else {
                    list.forEach(origin => {
                        const row = document.createElement("div");
                        Object.assign(row.style, { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111b2c", padding: "6px 10px", marginBottom: "4px", borderRadius: "4px", border: "1px solid #293449", fontSize: "11px" });
                        addText(row, "span", origin, { color: "#e2e8f0" });
                        const btnRemove = document.createElement("button");
                        btnRemove.textContent = "Remove";
                        Object.assign(btnRemove.style, { background: "#4c1726", color: "#fb7185", border: "none", borderRadius: "3px", padding: "3px 6px", cursor: "pointer", fontSize: "10px" });
                        btnRemove.addEventListener("click", () => {
                            const newList = list.filter(o => o !== origin);
                            chrome.storage.local.set({ trusted_origins: newList }, renderTrustList);
                        });
                        row.appendChild(btnRemove);
                        trustList.appendChild(row);
                    });
                }
            });
        }
    }
    renderTrustList();
    contentArea.appendChild(trustSection);

    panel.dataset.findingsSignature = findingsSignature;
    panel.appendChild(contentArea);
}

function runScanner() {
    let findings = [];
    let scannerError = false;

    try {
        findings = scanForHiddenText();
    } catch (e) {
        console.error("NeoX Scanner Error:", e);
        scannerError = true;
    }

    const panel = document.getElementById(PANEL_ID);

    if (scannerError) {
        if (panel) panel.style.display = "none";
        // Call updateMiniBadge with a special error flag
        updateMiniBadge([], true);
        return;
    }

    if (findings.length > 0 || (panel && panel.style.display === "flex")) {
        showWarningPanel(findings);
    } else {
        if (panel) panel.style.display = "none";
    }

    updateMiniBadge(findings, false);
    previousFindingCount = findings.length;
}

function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(runScanner, 250);
}

function isInsidePanel(node) {
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return Boolean(
        el && (el.id === PANEL_ID || el.closest("#" + PANEL_ID) || el.id === MINI_BADGE_ID || el.closest("#" + MINI_BADGE_ID))
    );
}

setTimeout(runScanner, 1000);

const observer = new MutationObserver(mutations => {
    const shouldScan = mutations.some(mutation => {
        if (isInsidePanel(mutation.target)) return false;
        if (mutation.type === "attributes" || mutation.type === "characterData") return true;
        return [...mutation.addedNodes, ...mutation.removedNodes].some(node => !isInsidePanel(node));
    });
    if (shouldScan) scheduleScan();
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden"]
});
