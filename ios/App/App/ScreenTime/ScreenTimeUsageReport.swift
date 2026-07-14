import DeviceActivity
import FamilyControls
import SwiftUI

// App-side presenter. The numbers are rendered by the sandboxed report
// extension (GGScreenTimeReport) — this view only builds the filter + hosts it.
extension DeviceActivityReport.Context {
    static let ggUsage = Self(GG.reportContext)
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
        let selection = ScreenTimePlugin.loadSelection() ?? FamilyActivitySelection()
        let cal = Calendar.current
        let now = Date()
        let interval: DateInterval
        switch range {
        case .today:
            interval = DateInterval(start: cal.startOfDay(for: now), end: now)
        case .week:
            let start = cal.date(byAdding: .day, value: -6, to: cal.startOfDay(for: now))!
            interval = DateInterval(start: start, end: now)
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
