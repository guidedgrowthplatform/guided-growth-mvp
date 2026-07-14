import DeviceActivity
import SwiftUI

// Sandboxed report extension: totals the user's own usage for the selected apps
// and renders it. No network, no writes — the numbers never leave this process.
@main
struct GGScreenTimeReport: DeviceActivityReportExtension {
    var body: some DeviceActivityReportScene {
        GGUsageScene { report in
            GGUsageView(report: report)
        }
    }
}

struct GGAppUsage: Identifiable {
    let id = UUID()
    let name: String
    let duration: TimeInterval
}

struct GGUsageReport {
    let totalDuration: TimeInterval
    let apps: [GGAppUsage]
}

struct GGUsageScene: DeviceActivityReportScene {
    let context: DeviceActivityReport.Context = .init(GG.reportContext)
    let content: (GGUsageReport) -> GGUsageView

    func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> GGUsageReport {
        var total: TimeInterval = 0
        var byApp: [String: TimeInterval] = [:]

        for await datum in data {
            for await segment in datum.activitySegments {
                total += segment.totalActivityDuration
                for await category in segment.categories {
                    for await app in category.applications {
                        let name = app.application.localizedDisplayName ?? "Other"
                        byApp[name, default: 0] += app.totalActivityDuration
                    }
                }
            }
        }

        let apps = byApp
            .map { GGAppUsage(name: $0.key, duration: $0.value) }
            .sorted { $0.duration > $1.duration }
        return GGUsageReport(totalDuration: total, apps: apps)
    }
}
