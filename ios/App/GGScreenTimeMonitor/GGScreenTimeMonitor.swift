import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

// Principal class (Info.plist NSExtensionPrincipalClass). iOS wakes this in the
// background: daily budgets trip here, breaks auto-lift here. Fail-safe rule:
// every path ends in rebuildShield() from persisted state — never a stuck shield.
class DeviceActivityMonitorExtension: DeviceActivityMonitor {

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        if activity.rawValue == GGMon.dailyActivity {
            // new day: tripped budgets + pauses reset
            GGMon.defaults?.removeObject(forKey: GGMon.Keys.tripped)
            GGMon.defaults?.removeObject(forKey: GGMon.Keys.paused)
            GGMon.defaults?.removeObject(forKey: GGMon.Keys.pausedCats)
            GGMon.rebuildShield()
        }
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        if activity.rawValue == GGMon.breakActivity {
            GGMon.defaults?.set(false, forKey: GGMon.Keys.shieldActive)
            GGMon.rebuildShield()
        }
        if activity.rawValue == GGMon.dailyActivity {
            GGMon.defaults?.removeObject(forKey: GGMon.Keys.tripped)
            GGMon.defaults?.removeObject(forKey: GGMon.Keys.paused)
            GGMon.defaults?.removeObject(forKey: GGMon.Keys.pausedCats)
            GGMon.rebuildShield()
        }
    }

    override func eventDidReachThreshold(
        _ event: DeviceActivityEvent.Name, activity: DeviceActivityName
    ) {
        super.eventDidReachThreshold(event, activity: activity)
        guard activity.rawValue == GGMon.dailyActivity else { return }
        var tripped = GGMon.defaults?.stringArray(forKey: GGMon.Keys.tripped) ?? []
        if !tripped.contains(event.rawValue) {
            tripped.append(event.rawValue)
            GGMon.defaults?.set(tripped, forKey: GGMon.Keys.tripped)
        }
        GGMon.rebuildShield()
    }
}
