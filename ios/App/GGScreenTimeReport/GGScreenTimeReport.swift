import DeviceActivity
import ExtensionKit
import SwiftUI

// Sandboxed report extension: totals the user's own usage for the selected apps
// and renders it on-device. No network, no writes — numbers never leave this process.
@main
struct GGScreenTimeReport: DeviceActivityReportExtension {
    var body: some DeviceActivityReportScene {
        GGUsageScene { report in
            GGUsageView(report: report)
        }
    }
}
