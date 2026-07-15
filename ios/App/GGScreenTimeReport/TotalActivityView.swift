import SwiftUI

// GG palette, hardcoded — the extension must match the app's light theme
// regardless of the system appearance (dark mode made rows black + total invisible).
private let ggBlue = Color(red: 0x13 / 255, green: 0x5B / 255, blue: 0xEB / 255)
private let ggInk = Color(red: 0x0F / 255, green: 0x17 / 255, blue: 0x2A / 255)
private let ggSecondary = Color(red: 0x64 / 255, green: 0x74 / 255, blue: 0x8B / 255)
private let ggTrack = Color(red: 0xEF / 255, green: 0xF3 / 255, blue: 0xF8 / 255)

private func formatDuration(_ seconds: TimeInterval) -> String {
    let total = Int(seconds)
    let h = total / 3600
    let m = (total % 3600) / 60
    if h > 0 { return "\(h)h \(String(format: "%02d", m))m" }
    return "\(m)m"
}

struct GGUsageView: View {
    let report: GGUsageReport
    private let maxRows = 4

    var body: some View {
        VStack(spacing: 16) {
            VStack(spacing: 2) {
                Text(formatDuration(report.totalDuration))
                    .font(.system(size: 40, weight: .heavy))
                    .foregroundColor(ggInk)
                Text("total screen time")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(ggSecondary)
            }
            .padding(.top, 16)

            if report.apps.isEmpty {
                Text("No usage recorded yet for your selected apps.\nUse them for a bit and check back.")
                    .multilineTextAlignment(.center)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(ggSecondary)
                    .padding(.horizontal, 24)
                Spacer(minLength: 0)
            } else {
                let shown = Array(report.apps.prefix(maxRows))
                let maxDuration = shown.first?.duration ?? 1
                VStack(spacing: 12) {
                    ForEach(shown) { app in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(app.name)
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(ggInk)
                                    .lineLimit(1)
                                Spacer()
                                Text(formatDuration(app.duration))
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(ggSecondary)
                            }
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(ggTrack)
                                    Capsule().fill(ggBlue)
                                        .frame(width: geo.size.width * CGFloat(app.duration / max(maxDuration, 1)))
                                }
                            }
                            .frame(height: 6)
                        }
                    }
                    if report.apps.count > maxRows {
                        Text("+ \(report.apps.count - maxRows) more")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(ggSecondary)
                    }
                }
                .padding(.horizontal, 16)
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color.white)
        .environment(\.colorScheme, .light)
    }
}
