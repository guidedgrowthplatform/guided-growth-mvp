import DeviceActivity
import FamilyControls
import SwiftUI

// App-side presenter. The numbers are rendered by the sandboxed report
// extension (GGScreenTimeReport) — this view only builds the filter + hosts it.
extension DeviceActivityReport.Context {
    static let ggUsage = Self(GG.reportContext)
}

enum GGReportFilter {
    // range: "today" | "week"
    static func make(range: String) -> DeviceActivityFilter {
        let selection = ScreenTimePlugin.loadSelection() ?? FamilyActivitySelection()
        let cal = Calendar.current
        let now = Date()
        let interval: DateInterval
        if range == "week" {
            let start = cal.date(byAdding: .day, value: -6, to: cal.startOfDay(for: now))!
            interval = DateInterval(start: start, end: now)
        } else {
            interval = DateInterval(start: cal.startOfDay(for: now), end: now)
        }
        return DeviceActivityFilter(
            segment: .daily(during: interval),
            users: .all,
            devices: .init([.iPhone]),
            applications: selection.applicationTokens,
            categories: selection.categoryTokens,
            webDomains: selection.webDomainTokens
        )
    }
}

// Inline (in-page) report card overlaid on the WebView — range swaps in place.
final class GGInlineReportModel: ObservableObject {
    @Published var range: String = "today"
}

struct ScreenTimeInlineReportView: View {
    @ObservedObject var model: GGInlineReportModel

    var body: some View {
        DeviceActivityReport(.ggUsage, filter: GGReportFilter.make(range: model.range))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ScreenTimeUsageReportView: View {
    let onDone: () -> Void

    enum Range: String, CaseIterable, Identifiable {
        case today = "Today"
        case week = "This week"
        var id: String { rawValue }
    }

    @State private var range: Range = .today

    private var filter: DeviceActivityFilter {
        GGReportFilter.make(range: range == .week ? "week" : "today")
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                Picker("Range", selection: $range) {
                    ForEach(Range.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding()

                DeviceActivityReport(.ggUsage, filter: filter)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .navigationTitle("Screen Time")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: onDone)
                }
            }
        }
    }
}
