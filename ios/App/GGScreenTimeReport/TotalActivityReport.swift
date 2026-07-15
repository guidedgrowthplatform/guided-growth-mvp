import DeviceActivity
import ExtensionKit
import FamilyControls
import ManagedSettings
import SwiftUI

struct GGAppUsage: Identifiable {
    let id = UUID()
    let name: String
    let duration: TimeInterval
    let token: ApplicationToken?
}

struct GGUsageReport {
    let total: TimeInterval
    let caption: String
    /// Raw bar values (chart normalizes to its max).
    let bars: [Double]
    let barLabels: [String]
    let apps: [GGAppUsage]
}

struct GGUsageScene: DeviceActivityReportScene {
    // must match the app-side DeviceActivityReport.Context (GG.reportContext)
    let context: DeviceActivityReport.Context = .init("ggUsage")
    let content: (GGUsageReport) -> GGUsageView

    func makeConfiguration(
        representing data: DeviceActivityResults<DeviceActivityData>
    ) async -> GGUsageReport {
        let cal = Calendar.current
        let todayStart = cal.startOfDay(for: Date())

        struct Segment {
            let interval: DateInterval
            let total: TimeInterval
            let perApp: [(name: String, token: ApplicationToken?, duration: TimeInterval)]
        }
        var segments: [Segment] = []

        for await datum in data {
            for await segment in datum.activitySegments {
                var perApp: [(String, ApplicationToken?, TimeInterval)] = []
                for await category in segment.categories {
                    for await app in category.applications {
                        perApp.append((
                            app.application.localizedDisplayName ?? "Other",
                            app.application.token,
                            app.totalActivityDuration
                        ))
                    }
                }
                segments.append(Segment(
                    interval: segment.dateInterval,
                    total: segment.totalActivityDuration,
                    perApp: perApp
                ))
            }
        }

        // hourly segments (≤2h) → today mode; daily → week mode
        let isToday = (segments.first?.interval.duration ?? 86400) <= 2 * 3600

        var appTotals: [String: (token: ApplicationToken?, duration: TimeInterval)] = [:]
        func addApps(_ seg: Segment) {
            for (name, token, duration) in seg.perApp {
                let prev = appTotals[name]
                appTotals[name] = (prev?.token ?? token, (prev?.duration ?? 0) + duration)
            }
        }

        let total: TimeInterval
        let caption: String
        let bars: [Double]
        let barLabels: [String]

        if isToday {
            let todaySegs = segments.filter { $0.interval.start >= todayStart }
            let yesterdaySegs = segments.filter { $0.interval.start < todayStart }
            total = todaySegs.reduce(0) { $0 + $1.total }
            let yesterday = yesterdaySegs.reduce(0) { $0 + $1.total }
            todaySegs.forEach(addApps)

            if yesterday <= 0 {
                caption = "so far today"
            } else {
                let diff = yesterday - total
                caption = diff >= 0
                    ? "\(formatDuration(abs(diff))) less than yesterday"
                    : "\(formatDuration(abs(diff))) more than yesterday"
            }

            // 6 AM → 11 PM, 18 bars (pre-6AM usage folds into the first bar)
            var byHour = [Double](repeating: 0, count: 18)
            for seg in todaySegs {
                let hour = cal.component(.hour, from: seg.interval.start)
                byHour[max(0, min(17, hour - 6))] += seg.total
            }
            bars = byHour
            barLabels = ["6 AM", "12 PM", "6 PM", "11 PM"]
        } else {
            total = segments.reduce(0) { $0 + $1.total }
            segments.forEach(addApps)
            let days = max(1, segments.count)
            caption = "\(formatDuration(total / Double(days))) daily average"

            let fmt = DateFormatter()
            fmt.dateFormat = "EEE"
            bars = segments.map { $0.total }
            barLabels = segments.map { fmt.string(from: $0.interval.start) }
        }

        let apps = appTotals
            .map { GGAppUsage(name: $0.key, duration: $0.value.duration, token: $0.value.token) }
            .sorted { $0.duration > $1.duration }

        return GGUsageReport(
            total: total,
            caption: caption,
            bars: bars,
            barLabels: barLabels,
            apps: apps
        )
    }
}
