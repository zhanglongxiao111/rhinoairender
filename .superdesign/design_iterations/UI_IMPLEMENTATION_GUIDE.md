# AI Render UI (Architect Edition) - Implementation Guide

> **Version**: 2.0 (Swiss International Style)  
> **Date**: 2025-12-17  
> **Design File**: `ui_architect_2.html` (Interactive Prototype)

---

## 1. Design Philosophy

This UI follows strict **Swiss International Style** principles to appeal to high-end architectural firms.

*   **Absolute Squareness**: `border-radius: 0` everywhere. No rounded corners allowed.
*   **Typography Hierarchy**: Heavy contrast between **Helvetica Neue Bold** (Headers/Actions) and **JetBrains Mono** (Data/Specs).
*   **Color System**:
    *   **Background**: Deep Black (`#121212`) for immersion.
    *   **Accent**: **International Orange** (`#F04E30`) - Used sparingly for active states and critical actions.
*   **Grid Layout**: Visible grid lines (`1px solid #333`) separate all functional areas.

---

## 2. Layout Structure (Responsive)

The layout is a **Fixed-Fluid-Fixed** 3-column structure.

| Zone | Width | Behavior | Content |
| :--- | :--- | :--- | :--- |
| **Left Sidebar** | `400px` | Fixed | Controls, Parameters, Prompt Input. |
| **Center Canvas** | `flex-1` | Fluid | Main preview image, Status overlay. `min-width: 400px`. |
| **Right Sidebar** | `300px` | Collapsible | Session History. Collapses to `72px` icon bar on small screens (<1200px). |

---

## 3. Key Components & Interactions

### 3.1 Prompt Input (`textarea`)
*   **Style**: Minimalist code-editor feel. Monospace font.
*   **Interaction**: Focus state highlights border in Accent Color (`#F04E30`).

### 3.2 Selectors & Toggles
*   **Option Cards**: Large click targets with title + subtitle.
    *   *Active*: Filled with Foreground color (`white`), text in Background color (`black`).
    *   *Inactive*: Transparent with Border.
*   **Aspect Ratio Grid**: 5-column grid. `21:9` spans full width (5 columns).

### 3.3 "Witty" Loading State (CRITICAL)
Users must feel the system is "thinking," not "loading."

*   **Trigger**: Clicking "Start Render".
*   **Visuals**:
    *   **Button**: Text changes, "Construction Stripe" animation appears in background.
    *   **Canvas**: Border pulses Orange. Image opacity drops to 40%.
    *   **Overlay**: A centered box appears with a high-speed **Chronometer** (`00:04.82`).
*   **Copywriting**: Cycle through "witty" messages every 2.5s.
    *   *Examples*: "正在跟柯布西耶探讨光影...", "正在计算空气中尘埃的丁达尔效应...", "别催了，正在一块砖一块砖地砌...".
    *   *Logic*: Randomly interject "fake" API progress (e.g., ">> 正在进行光线追踪降噪... 56%") to maintain trust.

### 3.4 History View Switcher
*   **List View**: Default. Vertical stack, detailed metadata.
*   **Masonry View (Waterfall)**: Dense packing.
    *   **Implementation**: Use CSS Columns (`column-count: 2`).
    *   **Images**: Must maintain original aspect ratio (1:1, 16:9, 9:16 mixed).

---

## 4. CSS Variables (Theme)

Copy these directly to your `index.css` or Tailwind config.

```css
:root {
    /* Dark Mode (Default) */
    --background: #121212;
    --surface:    #1e1e1e;
    --foreground: #e0e0e0;
    --border:     #333333;
    --accent:     #F04E30; /* International Orange */
    --accent-fg:  #ffffff;
    --muted:      #757575;
}

.light {
    /* Light Mode */
    --background: #ffffff;
    --surface:    #f4f4f5;
    --foreground: #18181b;
    --border:     #e4e4e7;
    --accent:     #D63E23;
    --accent-fg:  #ffffff;
    --muted:      #a1a1aa;
}
```

---

## 5. Assets & Icons

*   **Icons**: [Lucide React](https://lucide.dev/).
    *   Required: `settings-2`, `scan-eye`, `sun-moon`, `list`, `layout-dashboard`, `columns`, `folder`, `arrow-right`.
*   **Fonts**:
    *   Sans: `Helvetica Neue`, `Arial`, `sans-serif`
    *   Mono: `JetBrains Mono`, `monospace`

---

## 6. Implementation Checklist

- [ ] **Step 1**: Copy CSS variables and utility classes (e.g., `.swiss-grid-r`) to `index.css`.
- [ ] **Step 2**: Reconstruct the Layout (Left/Center/Right) using Flexbox.
- [ ] **Step 3**: Implement the `useWittyStatus` hook for the loading messages.
- [ ] **Step 4**: Build the `HistoryPanel` with toggleable List/Masonry views.
- [ ] **Step 5**: Ensure all click interactions (Parameters, Aspect Ratios) update the React state.

> **Note**: Refer to `ui_architect_2.html` source code for exact HTML structure and animation keyframes.
