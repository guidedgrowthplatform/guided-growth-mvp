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
        static let pausedCats = "gg.pausedcats.v1"
        static let shieldActive = "gg.shield.active.v1"
        static let shieldExpiry = "gg.shield.expiry.v1"
    }

    static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

    // exactly one of token/category is set (apps or whole categories can have limits)
    struct GGBudget: Codable, Identifiable {
        let id: String
        var token: ApplicationToken?
        var category: ActivityCategoryToken?
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

    static func loadPausedCats() -> [ActivityCategoryToken] {
        guard let arr = defaults?.array(forKey: Keys.pausedCats) as? [Data] else { return [] }
        return arr.compactMap { try? JSONDecoder().decode(ActivityCategoryToken.self, from: $0) }
    }

    static func savePausedCats(_ tokens: [ActivityCategoryToken]) {
        let arr = tokens.compactMap { try? JSONEncoder().encode($0) }
        defaults?.set(arr, forKey: Keys.pausedCats)
    }

    // The single source of truth for what is shielded:
    // (break active → whole selection) ∪ tripped budgets ∪ paused apps/categories.
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
            if let token = budget.token { apps.insert(token) }
            if let cat = budget.category { cats.insert(cat) }
        }
        for token in loadPaused() { apps.insert(token) }
        for cat in loadPausedCats() { cats.insert(cat) }

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
                applications: budget.token.map { Set([$0]) } ?? [],
                categories: budget.category.map { Set([$0]) } ?? [],
                threshold: DateComponents(minute: budget.minutes)
            )
        }
        do {
            try center.startMonitoring(
                DeviceActivityName(GGMon.dailyActivity), during: schedule, events: events)
        } catch {
            print("[ScreenTime] armDaily failed: \(error)")
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
}

// A limit target — an individual app or a whole category from the picker.
enum GGLimitTarget: Hashable {
    case app(ApplicationToken)
    case category(ActivityCategoryToken)
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

    @State private var targets: [GGLimitTarget]
    @State private var budgets: [GGMon.GGBudget] = GGMon.loadBudgets()
    @State private var paused: [ApplicationToken] = GGMon.loadPaused()
    @State private var pausedCats: [ActivityCategoryToken] = GGMon.loadPausedCats()

    init(onDone: @escaping () -> Void) {
        self.onDone = onDone
        let sel = GGMon.loadSelection() ?? FamilyActivitySelection()
        var list: [GGLimitTarget] = sel.categoryTokens.map { .category($0) }
        list += sel.applicationTokens.map { .app($0) }
        _targets = State(initialValue: list)
    }

    private func budget(for target: GGLimitTarget) -> GGMon.GGBudget? {
        switch target {
        case .app(let t): return budgets.first { $0.token == t }
        case .category(let c): return budgets.first { $0.category == c }
        }
    }

    private func isPaused(_ target: GGLimitTarget) -> Bool {
        switch target {
        case .app(let t): return paused.contains(t)
        case .category(let c): return pausedCats.contains(c)
        }
    }

    var body: some View {
        NavigationView {
            Group {
                if targets.isEmpty {
                    VStack(spacing: 8) {
                        Text("Nothing selected yet")
                            .font(.headline)
                            .foregroundColor(ggInk)
                        Text("Choose apps or categories on the Screen Time page first — then set a daily limit for each here.")
                            .font(.subheadline)
                            .foregroundColor(ggSecondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                } else {
                    List {
                        Section(footer: Text("Limits reset at midnight. When an app or category reaches its limit, it rests for the rest of the day.")) {
                            ForEach(targets, id: \.self) { target in
                                NavigationLink {
                                    ScreenTimeLimitDetailView(
                                        target: target,
                                        budget: budget(for: target),
                                        isPaused: isPaused(target),
                                        onSave: { minutes in setBudget(target, minutes: minutes) },
                                        onPause: { pauseNow(target) },
                                        onUnpause: { unpause(target) },
                                        onRemove: { remove(target) }
                                    )
                                } label: {
                                    HStack(spacing: 12) {
                                        targetLabel(target)
                                            .foregroundColor(ggInk)
                                        Spacer()
                                        if isPaused(target) {
                                            Text("paused")
                                                .font(.system(size: 13, weight: .bold))
                                                .foregroundColor(ggBlue)
                                        } else if let b = budget(for: target) {
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

    private func setBudget(_ target: GGLimitTarget, minutes: Int?) {
        // detail's exit-save fires after Remove too — never resurrect a removed target
        guard targets.contains(target) else { return }
        switch target {
        case .app(let t): budgets.removeAll { $0.token == t }
        case .category(let c): budgets.removeAll { $0.category == c }
        }
        if let minutes {
            switch target {
            case .app(let t):
                budgets.append(GGMon.GGBudget(id: UUID().uuidString, token: t, category: nil, minutes: minutes))
            case .category(let c):
                budgets.append(GGMon.GGBudget(id: UUID().uuidString, token: nil, category: c, minutes: minutes))
            }
        }
        GGMon.saveBudgets(budgets)
        GGArming.armDaily()
        GGMon.rebuildShield()
    }

    private func pauseNow(_ target: GGLimitTarget) {
        switch target {
        case .app(let t): if !paused.contains(t) { paused.append(t) }; GGMon.savePaused(paused)
        case .category(let c): if !pausedCats.contains(c) { pausedCats.append(c) }; GGMon.savePausedCats(pausedCats)
        }
        GGMon.rebuildShield()
    }

    private func unpause(_ target: GGLimitTarget) {
        switch target {
        case .app(let t): paused.removeAll { $0 == t }; GGMon.savePaused(paused)
        case .category(let c): pausedCats.removeAll { $0 == c }; GGMon.savePausedCats(pausedCats)
        }
        GGMon.rebuildShield()
    }

    private func remove(_ target: GGLimitTarget) {
        targets.removeAll { $0 == target }
        var selection = GGMon.loadSelection() ?? FamilyActivitySelection()
        switch target {
        case .app(let t):
            selection.applicationTokens.remove(t)
            budgets.removeAll { $0.token == t }
            paused.removeAll { $0 == t }
            GGMon.savePaused(paused)
        case .category(let c):
            selection.categoryTokens.remove(c)
            budgets.removeAll { $0.category == c }
            pausedCats.removeAll { $0 == c }
            GGMon.savePausedCats(pausedCats)
        }
        GGMon.saveSelection(selection)
        GGMon.saveBudgets(budgets)
        GGArming.armDaily()
        GGMon.rebuildShield()
    }
}

@ViewBuilder
func targetLabel(_ target: GGLimitTarget) -> some View {
    switch target {
    case .app(let token): Label(token).labelStyle(.titleAndIcon)
    case .category(let token): Label(token).labelStyle(.titleAndIcon)
    }
}

struct ScreenTimeLimitDetailView: View {
    let target: GGLimitTarget
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
        target: GGLimitTarget, budget: GGMon.GGBudget?, isPaused: Bool,
        onSave: @escaping (Int?) -> Void, onPause: @escaping () -> Void,
        onUnpause: @escaping () -> Void, onRemove: @escaping () -> Void
    ) {
        self.target = target
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
                    targetLabel(target).font(.headline)
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
                Text("When the limit is reached, it rests until tomorrow.")
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
