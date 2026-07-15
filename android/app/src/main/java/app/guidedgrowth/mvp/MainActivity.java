package app.guidedgrowth.mvp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import app.guidedgrowth.mvp.screentime.ScreenTimePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScreenTimePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
