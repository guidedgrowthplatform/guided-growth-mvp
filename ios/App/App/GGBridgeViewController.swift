import Capacitor

// Custom plugins must register here — the CLI-managed SPM package would be
// wiped by `cap sync`; app-target Swift survives (ios/ is committed).
class GGBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ScreenTimePlugin())
    }
}
