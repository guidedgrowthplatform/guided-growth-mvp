# Data Visibility

Lets users see, understand, and trust their progress. Clear dashboards, drill-downs, and comparisons that make habits, reflections, and outcomes legible across timeframes. Goal: reduce ambiguity, make growth tangible.

## User Flows

### Overview Dashboard

1. **User opens progress view**
   - Sees summary of the selected timeframe
   - Highlights streaks, completion rate, and top habits

2. **Scan and filter**
   - User filters by date range, habit, or type
   - Dashboard updates in place

### Metric Drill-Down

1. **Select a habit**
   - User clicks a habit card or chart
   - Opens detailed trend view

2. **Review trends**
   - Line or bar chart shows consistency over time
   - Notes and journal excerpts appear inline

### Compare Periods

1. **Choose comparison**
   - User selects two time ranges (e.g., last 30 days vs. prior 30 days)

2. **View delta**
   - Percentage change shown per habit
   - Highlights biggest gains and drop-offs

### Export & Audit

1. **Export data**
   - User selects CSV/JSON export
   - Chooses date range and included fields

2. **Data health**
   - App shows last-updated timestamp
   - Missing data and gaps are flagged

## UI Requirements

- **Summary dashboard** — completion rate, streaks, top habits; quick filters for date ranges; snapshot cards for key metrics
- **Trend visualization** — charts for habit performance and averages; heatmap or calendar view for daily tracking; hover/click to show day-level detail
- **Journal visibility** — search and filter journal entries; highlight recurring themes/keywords; link entries to habit performance context
- **Comparison view** — side-by-side ranges with delta indicators; optional normalization for frequency differences
- **Export controls** — clear format options and field selection; confirm export scope before download
- **Data integrity signals** — "last updated" indicator; gap markers for missing days; warnings for incomplete weeks

## Notes

- Charts and summaries are derived from local entries and metrics
- All views respect user-specific data isolation
- Exports never include other users' data
