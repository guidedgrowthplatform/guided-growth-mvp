import DeviceActivity
import FamilyControls
import ManagedSettings
import SwiftUI

// App-side copy of the shared Screen Time state. Serialization MUST match the
// monitor extension's GGMon (GGScreenTimeMonitor/TotalActivityReport.swift).
enum GGMon {
    static let appGroup = "group.app.guidedgrowth.screentime"
    static let storeName = "gg.slot.0"
    static let dailyActivity = "gg.daily"
    static let breakActivity = "gg.break"

    enum Keys {
        static let selection = "gg.selection.v1"
        static let budgets = "gg.budgets.v1"
        static let tripped = "gg.tripped.v1"
        static let paused = "gg.paused.v1"
        static let shieldActive = "gg.shield.active.v1"
        static let shieldExpiry = "gg.shield.expiry.v1"
    }

    static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

    struct GGBudget: Codable, Identifiable {
        let id: String
        let token: ApplicationToken
        var minutes: Int
    }

    static func loadSelection() -> FamilyActivitySelection? {
        guard let data = defaults?.data(forKey: Keys.selection) else { return nil }
        return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    }

    static func saveSelection(_ selection: FamilyActivitySelection) {
        guard let data = try? JSONEncoder().encode(selection) else { return }
        defaults?.set(data, forKey: Keys.selection)
    }

    static func loadBudgets() -> [GGBudget] {
        guard let data = defaults?.data(forKey: Keys.budgets) else { return [] }
        return (try? JSONDecoder().decode([GGBudget].self, from: data)) ?? []
    }

    static func saveBudgets(_ budgets: [GGBudget]) {
        guard let data = try? JSONEncoder().encode(budgets) else { return }
        defaults?.set(data, forKey: Keys.budgets)
    }

    static func loadPaused() -> [ApplicationToken] {
        guard let arr = defaults?.array(forKey: Keys.paused) as? [Data] else { return [] }
        return arr.compactMap { try? JSONDecoder().decode(ApplicationToken.self, from: $0) }
    }

    static func savePaused(_ tokens: [ApplicationToken]) {
        let arr = tokens.compactMap { try? JSONEncoder().encode($0) }
        defaults?.set(arr, forKey: Keys.paused)
    }

    // The single source of truth for what is shielded:
    // (break active → whole selection) ∪ tripped budgets ∪ paused apps.
    static func rebuildShield() {
        let store = ManagedSettingsStore(named: .init(storeName))
        var breakActive = defaults?.bool(forKey: Keys.shieldActive) ?? false

        if breakActive {
            let expiry = defaults?.double(forKey: Keys.shieldExpiry) ?? 0
            if expiry > 0, Date().timeIntervalSince1970 > expiry {
                defaults?.set(false, forKey: Keys.shieldActive)
                breakActive = false
            }
        }

        var apps = Set<ApplicationToken>()
        var cats = Set<ActivityCategoryToken>()
        var webs = Set<WebDomainToken>()

        if breakActive, let sel = loadSelection() {
            apps.formUnion(sel.applicationTokens)
            cats.formUnion(sel.categoryTokens)
            webs.formUnion(sel.webDomainTokens)
        }
        let tripped = Set(defaults?.stringArray(forKey: Keys.tripped) ?? [])
        for budget in loadBudgets() where tripped.contains(budget.id) {
            apps.insert(budget.token)
        }
        for token in loadPaused() {
            apps.insert(token)
        }

        if apps.isEmpty && cats.isEmpty && webs.isEmpty {
            store.clearAllSettings()
        } else {
            store.shield.applications = apps.isEmpty ? nil : apps
            store.shield.applicationCategories = cats.isEmpty ? nil : .specific(cats)
            store.shield.webDomains = webs.isEmpty ? nil : webs
        }
    }
}

// Arms/disarms the DeviceActivityMonitor extension's schedules.
enum GGArming {
    static func armDaily() {
        let center = DeviceActivityCenter()
        center.stopMonitoring([DeviceActivityName(GGMon.dailyActivity)])
        let budgets = GGMon.loadBudgets()
        guard !budgets.isEmpty else { return }
        let schedule = DeviceActivitySchedule(
            intervalStart: DateComponents(hour: 0, minute: 0),
            intervalEnd: DateComponents(hour: 23, minute: 59),
            repeats: true
        )
        var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]
        for budget in budgets {
            events[DeviceActivityEvent.Name(budget.id)] = DeviceActivityEvent(
                applications: [budget.token],
                threshold: DateComponents(minute: budget.minutes)
            )
        }
        do {
            try center.startMonitoring(
                DeviceActivityName(GGMon.dailyActivity), during: schedule, events: events)
        } catch {
            CAPLogPrint("[ScreenTime] armDaily failed: \(error)")
        }
    }

    static func armBreak(minutes: Int) {
        let center = DeviceActivityCenter()
        center.stopMonitoring([DeviceActivityName(GGMon.breakActivity)])
        let mins = max(15, minutes) // DeviceActivity enforces a 15-minute minimum
        let cal = Calendar.current
        let start = Date()
        let end = start.addingTimeInterval(Double(mins) * 60)
        let schedule = DeviceActivitySchedule(
            intervalStart: cal.dateComponents([.hour, .minute], from: start),
            intervalEnd: cal.dateComponents([.hour, .minute], from: end),
            repeats: false
        )
        try? center.startMonitoring(DeviceActivityName(GGMon.breakActivity), during: schedule)
    }

    static func stopBreak() {
        DeviceActivityCenter().stopMonitoring([DeviceActivityName(GGMon.breakActivity)])
    }

    static func stopAll() {
        DeviceActivityCenter().stopMonitoring()
    }

    private static func CAPLogPrint(_ msg: String) { print(msg) }
}

// ── Limits sheet (native — real names/icons stay out of JS) ──

private let ggBlue = Color(red: 0x13 / 255, green: 0x5B / 255, blue: 0xEB / 255)
private let ggInk = Color(red: 0x0F / 255, green: 0x17 / 255, blue: 0x2A / 255)
private let ggSecondary = Color(red: 0x64 / 255, green: 0x74 / 255, blue: 0x8B / 255)

private func limitLabel(_ minutes: Int) -> String {
    let h = minutes / 60
    let m = minutes % 60
    if h > 0 && m > 0 { return "\(h)h \(m)m/day" }
    if h > 0 { return "\(h)h/day" }
    return "\(m)m/day"
}

struct ScreenTimeLimitsView: View {
    let onDone: () -> Void

    @State private var tokens: [ApplicationToken] = Array(
        (GGMon.loadSelection() ?? FamilyActivitySelection()).applicationTokens)
    @State private var budgets: [GGMon.GGBudget] = GGMon.loadBudgets()
    @State private var paused: [ApplicationToken] = GGMon.loadPaused()

    var body: some View {
        NavigationView {
            Group {
                if tokens.isEmpty {
                    VStack(spacing: 8) {
                        Text("No apps selected yet")
                            .font(.headline)
                            .foregroundColor(ggInk)
                        Text("Choose apps on the Screen Time page first — then set a daily limit for each here.")
                            .font(.subheadline)
                            .foregroundColor(ggSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                } else {
                    List {
                        Section(footer: Text("Limits reset at midnight. When an app reaches its limit, it rests for the rest of the day.")) {
                            ForEach(Array(tokens.enumerated()), id: \.offset) { _, token in
                                NavigationLink {
                                    ScreenTimeLimitDetailView(
                                        token: token,
                                        budget: budgets.first { $0.token == token },
                                        isPaused: paused.contains(token),
                                        onSave: { minutes in setBudget(token, minutes: minutes) },
                                        onPause: { pauseNow(token) },
                                        onUnpause: { unpause(token) },
                                        onRemove: { remove(token) }
                                    )
                                } label: {
                                    HStack(spacing: 12) {
                                        Label(token)
                                            .labelStyle(.titleAndIcon)
                                            .foregroundColor(ggInk)
                                        Spacer()
                                        if let b = budgets.first(where: { $0.token == token }) {
                                            Text(limitLabel(b.minutes))
                                                .font(.system(size: 13, weight: .bold))
                                                .foregroundColor(ggBlue)
                                        } else {
                                            Text("no limit")
                                                .font(.system(size: 13, weight: .semibold))
                                                .foregroundColor(ggSecondary)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Daily limits")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done", action: onDone) }
            }
        }
        .navigationViewStyle(.stack)
    }

    private func setBudget(_ token: ApplicationToken, minutes: Int?) {
        budgets.removeAll { $0.token == token }
        if let minutes {
            budgets.append(GGMon.GGBudget(id: UUID().uuidString, token: token, minutes: minutes))
        }
        GGMon.saveBudgets(budgets)
        GGArming.armDaily()
        GGMon.rebuildShield()
    }

    private func pauseNow(_ token: ApplicationToken) {
        if !paused.contains(token) { paused.append(token) }
        GGMon.savePaused(paused)
        GGMon.rebuildShield()
    }

    private func unpause(_ token: ApplicationToken) {
        paused.removeAll { $0 == token }
        GGMon.savePaused(paused)
        GGMon.rebuildShield()
    }

    private func remove(_ token: ApplicationToken) {
        tokens.removeAll { $0 == token }
        var selection = GGMon.loadSelection() ?? FamilyActivitySelection()
        selection.applicationTokens.remove(token)
        GGMon.saveSelection(selection)
        budgets.removeAll { $0.token == token }
        GGMon.saveBudgets(budgets)
        paused.removeAll { $0 == token }
        GGMon.savePaused(paused)
        GGArming.armDaily()
        GGMon.rebuildShield()
    }
}

struct ScreenTimeLimitDetailView: View {
    let token: ApplicationToken
    let budget: GGMon.GGBudget?
    let isPaused: Bool
    let onSave: (Int?) -> Void
    let onPause: () -> Void
    let onUnpause: () -> Void
    let onRemove: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var limitOn: Bool
    @State private var minutes: Double

    private let presets: [(String, Int)] = [("30m", 30), ("1h", 60), ("2h", 120), ("3h", 180)]

    init(
        token: ApplicationToken, budget: GGMon.GGBudget?, isPaused: Bool,
        onSave: @escaping (Int?) -> Void, onPause: @escaping () -> Void,
        onUnpause: @escaping () -> Void, onRemove: @escaping () -> Void
    ) {
        self.token = token
        self.budget = budget
        self.isPaused = isPaused
        self.onSave = onSave
        self.onPause = onPause
        self.onUnpause = onUnpause
        self.onRemove = onRemove
        _limitOn = State(initialValue: budget != nil)
        _minutes = State(initialValue: Double(budget?.minutes ?? 120))
    }

    var body: some View {
        List {
            Section {
                HStack {
                    Spacer()
                    Label(token)
                        .labelStyle(.titleAndIcon)
                        .font(.headline)
                    Spacer()
                }
                .listRowBackground(Color.clear)
            }

            Section {
                Toggle("Daily limit", isOn: $limitOn)
                    .tint(ggBlue)
                if limitOn {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("Limit").foregroundColor(ggSecondary)
                            Spacer()
                            Text(limitLabel(Int(minutes)))
                                .font(.system(size: 20, weight: .heavy))
                                .foregroundColor(ggBlue)
                        }
                        Slider(value: $minutes, in: 15...240, step: 5)
                            .tint(ggBlue)
                        HStack(spacing: 8) {
                            ForEach(presets, id: \.1) { preset in
                                Button {
                                    minutes = Double(preset.1)
                                } label: {
                                    Text(preset.0)
                                        .font(.system(size: 13, weight: .bold))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 8)
                                        .background(
                                            Int(minutes) == preset.1
                                                ? ggBlue : Color(.systemGray6))
                                        .foregroundColor(
                                            Int(minutes) == preset.1 ? .white : ggSecondary)
                                        .clipShape(Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            } footer: {
                Text("When the limit is reached, this app rests until tomorrow.")
            }

            Section {
                if isPaused {
                    Button("Resume now") { onUnpause(); dismiss() }
                        .foregroundColor(ggBlue)
                } else {
                    Button("Pause for the rest of today") { onPause(); dismiss() }
                        .foregroundColor(ggBlue)
                }
                Button("Remove from Screen Time", role: .destructive) { onRemove(); dismiss() }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear {
            onSave(limitOn ? Int(minutes) : nil)
        }
    }
}
