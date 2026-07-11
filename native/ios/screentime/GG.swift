import Foundation

// Shared constants — this file is referenced by the app target AND every
// Screen Time extension target. The App Group is the only shared channel.
enum GG {
    static let appGroup = "group.app.guidedgrowth.screentime"
    static let storeName = "gg.slot.0"
    static let activityName = "gg.daily"

    enum Keys {
        // encoded FamilyActivitySelection (opaque tokens — never app names)
        static let selection = "gg.selection.v1"
        static let shieldActive = "gg.shield.active.v1"
        // shield copy read by the ShieldConfiguration extension
        static let shieldTitle = "gg.shield.title.v1"
        static let shieldSubtitle = "gg.shield.subtitle.v1"
        // deep-link intent written by the ShieldAction extension
        static let deepLink = "gg.deeplink.v1"
        static let budgets = "gg.budgets.v1"
        // fail-safe: epoch seconds after which any shield must auto-lift
        static let shieldExpiry = "gg.shield.expiry.v1"
    }

    static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }
}
