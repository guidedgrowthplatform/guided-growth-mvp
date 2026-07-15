import FamilyControls
import Foundation
import ManagedSettings

// Monitor-side copy of the shared Screen Time state (App Group). Serialization
// MUST match the app target's GGMon (ScreenTimeLimits.swift) byte-for-byte.
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
        static let bands = "gg.bands.v1"
        static let bandsDate = "gg.bandsdate.v1"
        static let bandLog = "gg.bandlog.v1"
    }

    static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

    // exactly one of token/category is set (apps or whole categories can have limits)
    struct GGBudget: Codable {
        let id: String
        var token: ApplicationToken?
        var category: ActivityCategoryToken?
        var minutes: Int
    }

    static func loadSelection() -> FamilyActivitySelection? {
        guard let data = defaults?.data(forKey: Keys.selection) else { return nil }
        return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    }

    static func loadBudgets() -> [GGBudget] {
        guard let data = defaults?.data(forKey: Keys.budgets) else { return [] }
        return (try? JSONDecoder().decode([GGBudget].self, from: data)) ?? []
    }

    static func loadPaused() -> [ApplicationToken] {
        guard let arr = defaults?.array(forKey: Keys.paused) as? [Data] else { return [] }
        return arr.compactMap { try? JSONDecoder().decode(ApplicationToken.self, from: $0) }
    }

    static func loadPausedCats() -> [ActivityCategoryToken] {
        guard let arr = defaults?.array(forKey: Keys.pausedCats) as? [Data] else { return [] }
        return arr.compactMap { try? JSONDecoder().decode(ActivityCategoryToken.self, from: $0) }
    }

    // ── Coach band state (docs/screentime/coach-data-contract.md) ──
    // Band per budget for today: kept → approaching → crossed. Escalate-only
    // within a day; day rollover resets. Every change is journaled to bandLog
    // for the app to drain into session_log — ids + bands only, never app
    // names or measured minutes.

    static let warnSuffix = ".warn"
    static let warnFraction = 0.8 // approaching at 80% of the limit (tunable)

    private static let bandRank = ["kept": 0, "approaching": 1, "crossed": 2]

    static func dayString(_ date: Date = Date()) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    static func loadBands() -> [String: String] {
        (defaults?.dictionary(forKey: Keys.bands) as? [String: String]) ?? [:]
    }

    static func raiseBand(_ id: String, to band: String) {
        let today = dayString()
        if defaults?.string(forKey: Keys.bandsDate) != today { rolloverBands(to: today) }
        var bands = loadBands()
        let previous = bands[id] ?? "kept"
        guard (bandRank[band] ?? 0) > (bandRank[previous] ?? 0) else { return }
        bands[id] = band
        defaults?.set(bands, forKey: Keys.bands)
        appendBandLog(id: id, band: band, previous: previous, date: today)
    }

    static func rolloverBands(to today: String = dayString()) {
        for (id, band) in loadBands() where band != "kept" {
            appendBandLog(id: id, band: "kept", previous: band, date: today)
        }
        defaults?.set([String: String](), forKey: Keys.bands)
        defaults?.set(today, forKey: Keys.bandsDate)
    }

    // budgets edited/removed → drop bands for ids that no longer exist
    static func pruneBands(validIds: Set<String>) {
        var bands = loadBands()
        let stale = bands.keys.filter { !validIds.contains($0) }
        guard !stale.isEmpty else { return }
        for key in stale { bands.removeValue(forKey: key) }
        defaults?.set(bands, forKey: Keys.bands)
    }

    private static func appendBandLog(id: String, band: String, previous: String, date: String) {
        var log = defaults?.array(forKey: Keys.bandLog) as? [[String: Any]] ?? []
        log.append([
            "boundaryId": id, "band": band, "previousBand": previous,
            "date": date, "at": Date().timeIntervalSince1970,
        ])
        if log.count > 200 { log.removeFirst(log.count - 200) }
        defaults?.set(log, forKey: Keys.bandLog)
    }

    // The single source of truth for what is shielded:
    // (break active → whole selection) ∪ tripped budgets ∪ paused apps.
    static func rebuildShield() {
        let store = ManagedSettingsStore(named: .init(storeName))
        var breakActive = defaults?.bool(forKey: Keys.shieldActive) ?? false

        // fail-safe: a break must never outlive its expiry
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
        for token in loadPaused() {
            apps.insert(token)
        }
        for cat in loadPausedCats() {
            cats.insert(cat)
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
