# Data Visibility Specification

## Overview

Visibility of the data ensures users can see, understand, and trust their progress. This section focuses on clear dashboards, drill-downs, and comparisons that make habits, reflections, and outcomes legible across timeframes. The goal is to reduce ambiguity and make growth tangible.

## User Flows

### Overview Dashboard

1. **User Opens Progress View**
   - Sees summary of the selected timeframe
   - Highlights streaks, completion rate, and top habits

2. **Scan and Filter**
   - User filters by date range, habit, or type
   - Dashboard updates in place

### Metric Drill-Down

1. **Select a Habit**
   - User clicks a habit card or chart
   - Opens detailed trend view

2. **Review Trends**
   - Line or bar chart shows consistency over time
   - Notes and journal excerpts appear inline

### Compare Periods

1. **Choose Comparison**
   - User selects two time ranges (e.g., last 30 days vs. prior 30 days)

2. **View Delta**
   - Percentage change shown per habit
   - Highlights biggest gains and drop-offs

### Export & Audit

1. **Export Data**
   - User selects CSV/JSON export
   - Chooses date range and included fields

2. **Data Health**
   - App shows last updated timestamp
   - Missing data and gaps are flagged

## UI Requirements

- **Summary Dashboard**
  - Completion rate, streaks, and top habits
  - Quick filters for date ranges
  - Snapshot cards for key metrics

- **Trend Visualization**
  - Charts for habit performance and averages
  - Heatmap or calendar view for daily tracking
  - Hover/click to show day-level detail

- **Journal Visibility**
  - Search and filter journal entries
  - Highlight recurring themes or keywords
  - Link entries to habit performance context

- **Comparison View**
  - Side-by-side ranges with delta indicators
  - Optional normalization for frequency differences

- **Export Controls**
  - Clear format options and field selection
  - Confirm export scope before download

- **Data Integrity Signals**
  - "Last updated" indicator
  - Gap markers for missing days
  - Warnings for incomplete weeks

## Configuration

- shell: false

## Technical Notes

- All views respect user-specific data isolation.
- Charts and summaries are derived from local entries and metrics.
- Export does not include other users' data.
