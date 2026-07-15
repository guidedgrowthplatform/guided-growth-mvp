import Capacitor
import FamilyControls
import ManagedSettings
import SwiftUI

@objc(ScreenTimePlugin)
public class ScreenTimePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScreenTimePlugin"
    public let jsName = "ScreenTime"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentPicker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentBudgetEditor", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showUsageReport", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "attachUsageReport", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateUsageReportRect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setUsageReportRange", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "detachUsageReport", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getBoundaryStates", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "drainBoundaryTransitions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "applyShield", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearShield", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disable", returnType: CAPPluginReturnPromise),
    ]

    private var store: ManagedSettingsStore {
        ManagedSettingsStore(named: .init(GG.storeName))
    }

    // Inline report overlay (Maps-style: native view positioned over a WebView placeholder)
    private var inlineHost: UIHostingController<ScreenTimeInlineReportView>?
    private let inlineModel = GGInlineReportModel()

    // MARK: - Capability / status

    @objc func isSupported(_ call: CAPPluginCall) {
        call.resolve(["supported": true])
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        let selection = Self.loadSelection()
        call.resolve([
            "supported": true,
            "status": Self.authStatusString(),
            "hasSelection": selection != nil,
            "applicationCount": selection?.applicationTokens.count ?? 0,
            "categoryCount": selection?.categoryTokens.count ?? 0,
            "budgetCount": GGMon.loadBudgets().count,
            "shieldActive": GG.defaults?.bool(forKey: GG.Keys.shieldActive) ?? false,
            // epoch seconds the current break auto-lifts at (0 = no break)
            "breakEndsAt": (GG.defaults?.bool(forKey: GG.Keys.shieldActive) ?? false)
                ? (GG.defaults?.double(forKey: GG.Keys.shieldExpiry) ?? 0) : 0,
        ])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        Task {
            do {
                try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                call.resolve(["status": Self.authStatusString()])
            } catch {
                // user declined the Face ID prompt or FC unavailable
                call.resolve(["status": Self.authStatusString()])
            }
        }
    }

    // MARK: - Picker

    @objc func presentPicker(_ call: CAPPluginCall) {
        guard AuthorizationCenter.shared.authorizationStatus == .approved else {
            call.reject("Screen Time access has not been approved yet.")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self, let presenter = self.bridge?.viewController else {
                call.reject("No view controller to present from.")
                return
            }
            var host: UIHostingController<ScreenTimePickerView>?
            let view = ScreenTimePickerView(
                selection: Self.loadSelection() ?? FamilyActivitySelection(),
                onDone: { selection in
                    Self.saveSelection(selection)
                    CAPLog.print("[ScreenTime] selection saved — apps: \(selection.applicationTokens.count), categories: \(selection.categoryTokens.count), domains: \(selection.webDomainTokens.count)")
                    host?.dismiss(animated: true)
                    call.resolve([
                        "cancelled": false,
                        "applicationCount": selection.applicationTokens.count,
                        "categoryCount": selection.categoryTokens.count,
                        "webDomainCount": selection.webDomainTokens.count,
                    ])
                },
                onCancel: {
                    host?.dismiss(animated: true)
                    let kept = Self.loadSelection()
                    call.resolve([
                        "cancelled": true,
                        "applicationCount": kept?.applicationTokens.count ?? 0,
                        "categoryCount": kept?.categoryTokens.count ?? 0,
                        "webDomainCount": kept?.webDomainTokens.count ?? 0,
                    ])
                }
            )
            let controller = UIHostingController(rootView: view)
            controller.modalPresentationStyle = .formSheet
            controller.isModalInPresentation = true
            host = controller
            presenter.present(controller, animated: true)
        }
    }

    // MARK: - Coach bands (docs/screentime/coach-data-contract.md)

    // Bands only — never app names, never measured minutes.
    @objc func getBoundaryStates(_ call: CAPPluginCall) {
        let budgets = GGMon.loadBudgets()
        let today = GGMon.dayString()
        // a bands dict from a previous day reads as kept (rollover not yet run)
        let bands = GG.defaults?.string(forKey: GGMon.Keys.bandsDate) == today
            ? GGMon.loadBands() : [:]
        call.resolve([
            "boundaries": budgets.map { [
                "id": $0.id,
                "kind": $0.token != nil ? "app" : "category",
                "limitMinutes": $0.minutes,
                "window": "daily",
            ] },
            "states": budgets.map { [
                "boundaryId": $0.id,
                "band": bands[$0.id] ?? "kept",
                "date": today,
            ] },
        ])
    }

    // Returns + clears the pending band-transition journal (monitor-written).
    @objc func drainBoundaryTransitions(_ call: CAPPluginCall) {
        let log = GG.defaults?.array(forKey: GGMon.Keys.bandLog) as? [[String: Any]] ?? []
        GG.defaults?.removeObject(forKey: GGMon.Keys.bandLog)
        call.resolve(["transitions": log])
    }

    // MARK: - Shield ("Take a break" + M2a demo path)

    @objc func applyShield(_ call: CAPPluginCall) {
        guard let selection = Self.loadSelection(),
              !(selection.applicationTokens.isEmpty && selection.categoryTokens.isEmpty && selection.webDomainTokens.isEmpty)
        else {
            call.reject("No apps selected yet — choose apps first.")
            return
        }
        // optional timed break; without minutes the 24h fail-safe still bounds it
        let minutes = call.getInt("minutes")
        let seconds = Double(minutes ?? 24 * 60) * 60
        GG.defaults?.set(true, forKey: GG.Keys.shieldActive)
        GG.defaults?.set(Date().addingTimeInterval(seconds).timeIntervalSince1970, forKey: GG.Keys.shieldExpiry)
        GGMon.rebuildShield()
        if let minutes { GGArming.armBreak(minutes: minutes) }
        call.resolve()
    }

    @objc func clearShield(_ call: CAPPluginCall) {
        GG.defaults?.set(false, forKey: GG.Keys.shieldActive)
        GG.defaults?.removeObject(forKey: GG.Keys.shieldExpiry)
        GGArming.stopBreak()
        // keeps tripped-budget + paused shields — only the break lifts
        GGMon.rebuildShield()
        call.resolve()
    }

    @objc func disable(_ call: CAPPluginCall) {
        GGArming.stopAll()
        store.clearAllSettings()
        for key in [GG.Keys.selection, GG.Keys.budgets, GG.Keys.shieldActive,
                    GG.Keys.shieldExpiry, GGMon.Keys.tripped, GGMon.Keys.paused,
                    GGMon.Keys.pausedCats, GGMon.Keys.bands, GGMon.Keys.bandsDate,
                    GGMon.Keys.bandLog] {
            GG.defaults?.removeObject(forKey: key)
        }
        call.resolve()
    }

    // MARK: - Usage report (M1 — DeviceActivityReport extension renders it)

    @objc func showUsageReport(_ call: CAPPluginCall) {
        guard AuthorizationCenter.shared.authorizationStatus == .approved else {
            call.reject("Screen Time access has not been approved yet.")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self, let presenter = self.bridge?.viewController else {
                call.reject("No view controller to present from.")
                return
            }
            var host: UIHostingController<ScreenTimeUsageReportView>?
            let view = ScreenTimeUsageReportView(onDone: {
                host?.dismiss(animated: true)
                call.resolve()
            })
            let controller = UIHostingController(rootView: view)
            controller.modalPresentationStyle = .fullScreen
            controller.overrideUserInterfaceStyle = .light
            host = controller
            presenter.present(controller, animated: true)
        }
    }

    // MARK: - Inline usage report (embedded in the dashboard card)

    private func rect(from call: CAPPluginCall) -> CGRect {
        CGRect(
            x: call.getDouble("x") ?? 0,
            y: call.getDouble("y") ?? 0,
            width: call.getDouble("width") ?? 0,
            height: call.getDouble("height") ?? 0
        )
    }

    @objc func attachUsageReport(_ call: CAPPluginCall) {
        guard AuthorizationCenter.shared.authorizationStatus == .approved else {
            call.reject("Screen Time access has not been approved yet.")
            return
        }
        let frame = rect(from: call)
        let range = call.getString("range") ?? "today"
        DispatchQueue.main.async { [weak self] in
            guard let self, let container = self.bridge?.viewController else {
                call.reject("No view controller to attach to.")
                return
            }
            self.inlineModel.range = range
            if self.inlineHost == nil {
                let host = UIHostingController(rootView: ScreenTimeInlineReportView(model: self.inlineModel))
                host.view.backgroundColor = .clear
                // match the app's light card look regardless of system dark mode
                host.overrideUserInterfaceStyle = .light
                host.view.layer.cornerRadius = 16
                host.view.layer.masksToBounds = true
                // interactive: the card's app list scrolls; page scrolls outside the card
                container.addChild(host)
                container.view.addSubview(host.view)
                host.didMove(toParent: container)
                self.inlineHost = host
            }
            self.inlineHost?.view.frame = frame
            call.resolve()
        }
    }

    @objc func updateUsageReportRect(_ call: CAPPluginCall) {
        let frame = rect(from: call)
        DispatchQueue.main.async { [weak self] in
            self?.inlineHost?.view.frame = frame
            call.resolve()
        }
    }

    @objc func setUsageReportRange(_ call: CAPPluginCall) {
        let range = call.getString("range") ?? "today"
        DispatchQueue.main.async { [weak self] in
            self?.inlineModel.range = range
            call.resolve()
        }
    }

    @objc func detachUsageReport(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            if let host = self?.inlineHost {
                host.willMove(toParent: nil)
                host.view.removeFromSuperview()
                host.removeFromParent()
            }
            self?.inlineHost = nil
            call.resolve()
        }
    }

    // MARK: - Later milestones (stubs so JS never crashes)

    @objc func presentBudgetEditor(_ call: CAPPluginCall) {
        guard AuthorizationCenter.shared.authorizationStatus == .approved else {
            call.reject("Screen Time access has not been approved yet.")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self, let presenter = self.bridge?.viewController else {
                call.reject("No view controller to present from.")
                return
            }
            var host: UIHostingController<ScreenTimeLimitsView>?
            let view = ScreenTimeLimitsView(onDone: {
                host?.dismiss(animated: true)
                call.resolve(["budgetCount": GGMon.loadBudgets().count])
            })
            let controller = UIHostingController(rootView: view)
            controller.modalPresentationStyle = .formSheet
            controller.overrideUserInterfaceStyle = .light
            host = controller
            presenter.present(controller, animated: true)
        }
    }

    // MARK: - Selection persistence (App Group — the only shared channel)

    static func loadSelection() -> FamilyActivitySelection? {
        guard let data = GG.defaults?.data(forKey: GG.Keys.selection) else { return nil }
        return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    }

    static func saveSelection(_ selection: FamilyActivitySelection) {
        guard let data = try? JSONEncoder().encode(selection) else { return }
        GG.defaults?.set(data, forKey: GG.Keys.selection)
    }

    static func authStatusString() -> String {
        switch AuthorizationCenter.shared.authorizationStatus {
        case .approved: return "approved"
        case .denied: return "denied"
        case .notDetermined: return "notDetermined"
        @unknown default: return "notDetermined"
        }
    }
}
