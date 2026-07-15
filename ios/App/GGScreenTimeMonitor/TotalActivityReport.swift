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
        static let shieldActive = "gg.shield.active.v1"
        static let shieldExpiry = "gg.shield.expiry.v1"
    }

    static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

    struct GGBudget: Codable {
        let id: String
        let token: ApplicationToken
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
