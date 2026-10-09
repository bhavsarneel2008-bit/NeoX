# NeoX 🛡️

**NeoX** is a specialized cybersecurity Google Chrome Extension (Manifest V3) designed to detect covert prompt-injection attacks and adversarial instructions hidden within web pages.

Developed as a proof-of-concept for the hackathon, NeoX identifies stealthy payloads designed to compromise AI systems that process web content.

> **Current Status:** Final Build. Features a fully integrated heuristic scanner, a draggable floating security widget, dynamic MutationObserver rescanning, temporary visit dismissal, persistent website trust, and local forensic report generation.

---

## 🎯 Features

*   **Heuristic Detection Engine**: Scans DOM nodes for hidden text payloads that match known adversarial prompt-injection patterns.
*   **Stealth Analysis**: Identifies content hidden via `display: none`, `visibility: hidden`, microscopic fonts (1px), near-zero opacity, and absolute positioning off-screen.
*   **Invisible Unicode Detection**: Flags suspicious zero-width and directional formatting characters often used to evade AI filters.
*   **Dynamic DOM Rescanning**: Uses a `MutationObserver` to automatically scan new content injected into the page after initial load.
*   **Draggable Floating Widget**: A non-intrusive security widget with stable risk indicators. Drag it anywhere on the viewport; position persists across refreshes.
*   **Dashboard with Window Controls**: Minimize, Maximize/Restore, and Close. The dashboard title bar is also draggable.
*   **Dismiss for This Visit**: Temporarily hide the interface for the current origin while the tab remains open. Detection continues in the background.
*   **Trusted Website Management**: Persistently green-flag trusted origins. The widget is suppressed on future visits until trust is removed. Trust is stored securely in extension-isolated storage, never sent externally.
*   **Forensic Report Generation**: Generates and copies localized incident reports containing timestamp, risk scores, extracted evidence, and detection reasoning.

---

## 🏗️ Architecture

This project is built using vanilla HTML, CSS, and JavaScript with **zero external dependencies**, ensuring maximum execution speed and security.

```text
NeoX/
├── manifest.json   # Chrome Extension configuration (Manifest V3)
├── content.js      # Core heuristic scanner and UI injection logic
├── demo.html       # "Northstar Digital Banking" simulated test environment
└── README.md       # Project documentation
```

### Permissions

| Permission | Purpose |
| :--- | :--- |
| `storage` | Persist the trusted-website list in extension-isolated storage (`chrome.storage.local`). Data never leaves the browser. |

---

## 🚀 Installation & Testing Instructions

You do not need Node.js, Python, or any third-party software.

### Step 1: Load the Extension
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable the **Developer mode** toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `NeoX` folder on your computer.

### Step 2: Run the Simulated Test Environment
1. Open `demo.html` in Chrome. You will see the **Northstar Digital Banking** simulated test environment.
2. The NeoX scanner runs automatically. The dashboard appears when findings are detected.
3. Use the title bar to **drag** the dashboard, or **minimize** it to the floating widget. The widget can also be dragged to any position.
4. Review the heuristic scores, extracted evidence, and generate forensic reports.
5. In the "Detection Test Lab" section of the page, click the **"Inject Dynamic Payload"** button to test the `MutationObserver`'s ability to catch delayed attacks.
6. Use the **green shield** button to trust the current origin, or the **eye-off** button to dismiss for the current visit.

---

## 📊 Test Results

The included `demo.html` environment tests five distinct attack vectors. NeoX successfully catches all of them:

| Test Case | Detection Vector | Result | Score |
| :--- | :--- | :--- | :--- |
| **Test 1** | Hidden Suspicious Instruction (`display: none`) | 🚨 Flagged | 90/100 |
| **Test 2** | Harmless Hidden Text (`display: none`) | ⚠️ Warning | 80/100 |
| **Test 3** | Tiny Text (`font-size: 1px`) | ⚠️ Warning | 65/100 |
| **Test 4** | Invisible Unicode (Zero-width markers) | ⚠️ Warning | 80/100 |
| **Test 5** | Dynamic DOM Injection (Delayed attack) | 🚨 Flagged | 90/100 |

---

## ⚠️ Limitations

*   **Heuristic Nature**: The scanner relies on heuristic rules (regex patterns and CSS style analysis). This is a strong indicator of suspicious activity but is **not definitive proof** of a malicious attack.
*   **False Positives**: Legitimate sites using `display: none` for benign hidden text (e.g., screen-reader text) may trigger lower-risk warnings.
*   **Shadow DOM**: The current iteration scans the primary document body but does not recursively pierce open/closed Shadow DOM boundaries.
*   **Trusted Websites**: Trusting a website suppresses only the NeoX interface. It does not make the website safe or disable any browser security protections.


