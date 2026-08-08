# Port Packet #03 — Widget UX Enhancements

## Summary
Improves visual design and interactivity of dashboard tiles, correlation cluster
cards, and analytics visualizations across 5 frontend component files.

## Changes

### Dashboard (`src/pages/Dashboard.jsx`)
- **Clickable stat cards**: Total/Critical/High/Today tiles now navigate to `/threats`
  on click, with hover border + shadow feedback.
- **Severity percentages**: Severity distribution bars show count + percentage.
- **Clickable latest threats**: Each threat row links to `/threats/:id`.
- **View all link**: Added "View all →" link in Latest Threats header.

### Cluster Cards (`src/components/correlation/ClusterCard.jsx`)
- **Severity distribution bar**: Multi-segment bar in cluster card header showing
  Critical/High/Medium/Low proportions.

### Risk Leaderboard (`src/components/analytics/RiskLeaderboard.jsx`)
- **De-cluttered rows**: CVSS and EPSS moved to subtitle line.
- **Wider risk bars**: Risk score bar widened and thickened.
- **Flexible subtitle**: CVE, CVSS, EPSS, source wrap on narrow screens.

### Risk Scatter Plot (`src/components/analytics/RiskScatterPlot.jsx`)
- **High-priority quadrant shading**: Subtle red `ReferenceArea` on top-right quadrant.

### CVE-Product Matrix (`src/components/analytics/CveProductMatrix.jsx`)
- **Larger heatmap cells**: `w-6 h-6 rounded-md`.
- **Threat count in cells**: Bold white text inside colored cells.
- **Richer tooltips**: "CVE → Product (N threats)" format.

## Dependencies
- No new npm packages required.
- `recharts` `ReferenceArea` — already included.
- `react-router-dom` `Link` — already used.
- `lucide-react` `ArrowRight` — already included.

## Application
1. Copy files from `packets/widget-enhancements/frontend/src/` to corresponding paths.
2. No backend, database, or migration changes.
3. Rebuild: `docker compose up --build frontend`
