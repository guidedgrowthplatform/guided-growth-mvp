import SwiftUI

private let ggBlue = Color(red: 0x13 / 255, green: 0x5B / 255, blue: 0xEB / 255)

private func formatDuration(_ seconds: TimeInterval) -> String {
    let total = Int(seconds)
    let h = total / 3600
    let m = (total % 3600) / 60
    if h > 0 { return "\(h)h \(String(format: "%02d", m))m" }
    return "\(m)m"
}

struct GGUsageView: View {
    let report: GGUsageReport

    var body: some View {
        VStack(spacing: 20) {
            VStack(spacing: 4) {
                Text(formatDuration(report.totalDuration))
                    .font(.system(size: 42, weight: .heavy))
                    .foregroundColor(.primary)
                Text("total screen time")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.secondary)
            }
            .padding(.top, 12)

            if report.apps.isEmpty {
                Spacer()
                Text("No usage recorded yet for your selected apps.\nUse them for a bit and check back.")
                    .multilineTextAlignment(.center)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 32)
                Spacer()
            } else {
                let maxDuration = report.apps.first?.duration ?? 1
                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(report.apps) { app in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(app.name)
                                        .font(.system(size: 15, weight: .bold))
                                    Spacer()
                                    Text(formatDuration(app.duration))
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(.secondary)
                                }
                                GeometryReader { geo in
                                    ZStack(alignment: .leading) {
                                        Capsule().fill(ggBlue.opacity(0.1))
                                        Capsule().fill(ggBlue)
                                            .frame(width: geo.size.width * CGFloat(app.duration / max(maxDuration, 1)))
                                    }
                                }
                                .frame(height: 6)
                            }
                            .padding(14)
                            .background(Color(.secondarySystemBackground))
                            .cornerRadius(16)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
    }
}
