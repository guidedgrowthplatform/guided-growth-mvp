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
        CAPPluginMethod(name: "applyShield", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearShield", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disable", returnType: CAPPluginReturnPromise),
    ]

    private var store: ManagedSettingsStore {
        ManagedSettingsStore(named: .init(GG.storeName))
    }

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
            "budgetCount": 0,
            "shieldActive": GG.defaults?.bool(forKey: GG.Keys.shieldActive) ?? false,
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

    // MARK: - Shield ("Take a break" + M2a demo path)

    @objc func applyShield(_ call: CAPPluginCall) {
        guard let selection = Self.loadSelection(),
              !(selection.applicationTokens.isEmpty && selection.categoryTokens.isEmpty && selection.webDomainTokens.isEmpty)
        else {
            call.reject("No apps selected yet — choose apps first.")
            return
        }
        let store = self.store
        store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
        store.shield.applicationCategories = selection.categoryTokens.isEmpty
            ? nil : .specific(selection.categoryTokens)
        store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
        GG.defaults?.set(true, forKey: GG.Keys.shieldActive)
        // constraint 5 fail-safe: shields never outlive 24h without re-arm
        GG.defaults?.set(Date().addingTimeInterval(24 * 3600).timeIntervalSince1970, forKey: GG.Keys.shieldExpiry)
        call.resolve()
    }

    @objc func clearShield(_ call: CAPPluginCall) {
        liftShield()
        call.resolve()
    }

    @objc func disable(_ call: CAPPluginCall) {
        liftShield()
        GG.defaults?.removeObject(forKey: GG.Keys.selection)
        GG.defaults?.removeObject(forKey: GG.Keys.budgets)
        call.resolve()
    }

    private func liftShield() {
        store.clearAllSettings()
        GG.defaults?.set(false, forKey: GG.Keys.shieldActive)
        GG.defaults?.removeObject(forKey: GG.Keys.shieldExpiry)
    }

    // MARK: - Later milestones (stubs so JS never crashes)

    @objc func showUsageReport(_ call: CAPPluginCall) {
        call.reject("Usage report is not available yet.")
    }

    @objc func presentBudgetEditor(_ call: CAPPluginCall) {
        call.reject("Daily limits are not available yet.")
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
