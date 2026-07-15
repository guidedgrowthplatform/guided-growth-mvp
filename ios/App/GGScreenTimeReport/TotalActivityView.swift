import FamilyControls
import SwiftUI

// GG palette, hardcoded — must match the app's light theme regardless of the
// system appearance (dark mode made rows black + total invisible).
let ggBlue = Color(red: 0x13 / 255, green: 0x5B / 255, blue: 0xEB / 255)
let ggInk = Color(red: 0x0F / 255, green: 0x17 / 255, blue: 0x2A / 255)
let ggSecondary = Color(red: 0x64 / 255, green: 0x74 / 255, blue: 0x8B / 255)
let ggTertiary = Color(red: 0x94 / 255, green: 0xA3 / 255, blue: 0xB8 / 255)
let ggTrack = Color(red: 0xEF / 255, green: 0xF3 / 255, blue: 0xF8 / 255)
let ggDivider = Color(red: 0xF1 / 255, green: 0xF5 / 255, blue: 0xF9 / 255)

func formatDuration(_ seconds: TimeInterval) -> String {
    let total = Int(seconds)
    let h = total / 3600
    let m = (total % 3600) / 60
    if h > 0 { return "\(h)h \(String(format: "%02d", m))m" }
    return "\(m)m"
}

struct GGUsageView: View {
    let report: GGUsageReport

    var body: some View {
        VStack(spacing: 16) {
            // total + caption (mockup header)
            VStack(spacing: 2) {
                Text(formatDuration(report.total))
                    .font(.system(size: 40, weight: .heavy))
                    .foregroundColor(ggInk)
                Text(report.caption)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(ggBlue)
            }
            .padding(.top, 14)

            GGBarChart(bars: report.bars, labels: report.barLabels)
                .padding(.horizontal, 16)

            if report.apps.isEmpty {
                Text("No usage recorded yet for your selected apps.\nUse them for a bit and check back.")
                    .multilineTextAlignment(.center)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(ggSecondary)
                    .padding(.horizontal, 24)
                Spacer(minLength: 0)
            } else {
                let maxDuration = report.apps.first?.duration ?? 1
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        ForEach(Array(report.apps.enumerated()), id: \.element.id) { index, app in
                            if index > 0 { Rectangle().fill(ggDivider).frame(height: 1) }
                            GGAppRow(app: app, fraction: app.duration / max(maxDuration, 1))
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color.white)
        .environment(\.colorScheme, .light)
    }
}

private struct GGBarChart: View {
    let bars: [Double]
    let labels: [String]

    var body: some View {
        let maxVal = max(bars.max() ?? 1, 0.001)
        VStack(spacing: 8) {
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(bars.indices, id: \.self) { i in
                    let frac = bars[i] / maxVal
                    UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 2,
                                           bottomTrailingRadius: 2, topTrailingRadius: 4)
                        .fill(frac >= 0.88 ? ggBlue : ggBlue.opacity(0.25))
                        .frame(height: max(3, 64 * frac))
                        .frame(maxWidth: .infinity, alignment: .bottom)
                }
            }
            .frame(height: 64, alignment: .bottom)
            HStack {
                ForEach(labels.indices, id: \.self) { i in
                    if i > 0 { Spacer() }
                    Text(labels[i])
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(ggTertiary)
                }
            }
        }
    }
}

private struct GGAppRow: View {
    let app: GGAppUsage
    let fraction: Double

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(ggBlue.opacity(0.06))
                    .frame(width: 40, height: 40)
                if let token = app.token {
                    // real app icon, rendered by the OS from the opaque token
                    Label(token)
                        .labelStyle(.iconOnly)
                        .scaleEffect(1.3)
                        .frame(width: 32, height: 32)
                } else {
                    Image(systemName: "app.fill")
                        .foregroundColor(ggBlue)
                }
            }
            VStack(alignment: .leading, spacing: 5) {
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
                ZStack(alignment: .leading) {
                    Capsule().fill(ggTrack).frame(height: 6)
                    GeometryReader { geo in
                        Capsule().fill(ggBlue)
                            .frame(width: geo.size.width * fraction, height: 6)
                    }
                    .frame(height: 6)
                }
            }
        }
        .padding(.vertical, 11)
        .padding(.horizontal, 16)
    }
}
