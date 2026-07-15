package app.guidedgrowth.mvp.screentime;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.provider.Settings;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

// Android ScreenTime plugin — data-reading track only (UsageStatsManager).
// Blocking (AccessibilityService + disclosure) is a later, review-sensitive
// milestone and deliberately absent here. JS sees real app names/icons on
// Android (contract: they never LEAVE the device); boundary ids are opaque
// UUIDs so session_log payloads stay name-free.
@CapacitorPlugin(name = "ScreenTime")
public class ScreenTimePlugin extends Plugin {

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context ctx = getContext();
        Set<String> selection = GGScreenTime.loadSelection(ctx);
        JSObject ret = new JSObject();
        ret.put("supported", true);
        // Android can't distinguish denied from not-yet-granted for Usage Access
        ret.put("status", GGScreenTime.usageAccessGranted(ctx) ? "approved" : "notDetermined");
        ret.put("hasSelection", !selection.isEmpty());
        ret.put("applicationCount", selection.size());
        ret.put("categoryCount", 0);
        ret.put("budgetCount", GGScreenTime.loadBudgets(ctx).length());
        ret.put("shieldActive", false); // blocking track not built yet
        ret.put("breakEndsAt", 0);
        call.resolve(ret);
    }

    // Deep-links to the system Usage Access screen; the grant happens there.
    // JS re-checks getStatus() on app resume.
    @PluginMethod
    public void requestAuthorization(PluginCall call) {
        Context ctx = getContext();
        if (!GGScreenTime.usageAccessGranted(ctx)) {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
        }
        JSObject ret = new JSObject();
        ret.put("status", GGScreenTime.usageAccessGranted(ctx) ? "approved" : "notDetermined");
        call.resolve(ret);
    }

    // Launcher apps only (scoped <queries> filter — no QUERY_ALL_PACKAGES).
    // Names + icons are for on-device rendering; never transmit them.
    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> resolved = pm.queryIntentActivities(launcher, 0);
        String self = getContext().getPackageName();
        JSArray apps = new JSArray();
        Set<String> seen = new HashSet<>();
        for (ResolveInfo info : resolved) {
            ApplicationInfo app = info.activityInfo.applicationInfo;
            if (app.packageName.equals(self) || !seen.add(app.packageName)) continue;
            JSObject row = new JSObject();
            row.put("packageName", app.packageName);
            row.put("label", String.valueOf(pm.getApplicationLabel(app)));
            String icon = iconBase64(pm, app);
            if (icon != null) row.put("icon", icon);
            apps.put(row);
        }
        JSObject ret = new JSObject();
        ret.put("apps", apps);
        call.resolve(ret);
    }

    @PluginMethod
    public void setSelection(PluginCall call) {
        try {
            JSArray names = call.getArray("packageNames");
            Set<String> selection = new HashSet<>();
            for (int i = 0; i < names.length(); i++) selection.add(names.getString(i));
            Context ctx = getContext();
            GGScreenTime.saveSelection(ctx, selection);
            // budgets for deselected apps die with the selection
            JSONArray budgets = GGScreenTime.loadBudgets(ctx);
            JSONArray kept = new JSONArray();
            Set<String> keptIds = new HashSet<>();
            for (int i = 0; i < budgets.length(); i++) {
                JSONObject b = budgets.getJSONObject(i);
                if (selection.contains(b.getString("packageName"))) {
                    kept.put(b);
                    keptIds.add(b.getString("id"));
                }
            }
            GGScreenTime.saveBudgets(ctx, kept);
            GGScreenTime.pruneBands(ctx, keptIds);
            JSObject ret = new JSObject();
            ret.put("applicationCount", selection.size());
            call.resolve(ret);
        } catch (JSONException e) {
            call.reject("Could not save the selection.");
        }
    }

    @PluginMethod
    public void getSelection(PluginCall call) {
        JSArray names = new JSArray();
        for (String pkg : GGScreenTime.loadSelection(getContext())) names.put(pkg);
        JSObject ret = new JSObject();
        ret.put("packageNames", names);
        call.resolve(ret);
    }

    // budgets: [{id?, packageName, minutes}] — ids are UUIDs minted here so the
    // id→package mapping never has to leave the device.
    @PluginMethod
    public void setBudgets(PluginCall call) {
        try {
            JSArray incoming = call.getArray("budgets");
            Context ctx = getContext();
            JSONArray existing = GGScreenTime.loadBudgets(ctx);
            JSONArray budgets = new JSONArray();
            Set<String> ids = new HashSet<>();
            for (int i = 0; i < incoming.length(); i++) {
                JSONObject in = incoming.getJSONObject(i);
                String pkg = in.getString("packageName");
                String id = in.optString("id", "");
                if (id.isEmpty()) id = existingIdFor(existing, pkg);
                if (id.isEmpty()) id = UUID.randomUUID().toString();
                JSONObject budget = new JSONObject();
                budget.put("id", id);
                budget.put("packageName", pkg);
                budget.put("minutes", in.getInt("minutes"));
                budgets.put(budget);
                ids.add(id);
            }
            GGScreenTime.saveBudgets(ctx, budgets);
            GGScreenTime.pruneBands(ctx, ids);
            JSObject ret = new JSObject();
            ret.put("budgetCount", budgets.length());
            call.resolve(ret);
        } catch (JSONException e) {
            call.reject("Could not save the limits.");
        }
    }

    // Full budgets incl. package names — for OUR limits editor only (on-device).
    @PluginMethod
    public void getBudgets(PluginCall call) {
        try {
            JSONArray budgets = GGScreenTime.loadBudgets(getContext());
            JSArray rows = new JSArray();
            for (int i = 0; i < budgets.length(); i++) {
                JSONObject b = budgets.getJSONObject(i);
                JSObject row = new JSObject();
                row.put("id", b.getString("id"));
                row.put("packageName", b.getString("packageName"));
                row.put("minutes", b.getInt("minutes"));
                rows.put(row);
            }
            JSObject ret = new JSObject();
            ret.put("budgets", rows);
            call.resolve(ret);
        } catch (JSONException e) {
            call.reject("Could not read the limits.");
        }
    }

    private static String existingIdFor(JSONArray budgets, String pkg) {
        for (int i = 0; i < budgets.length(); i++) {
            JSONObject b = budgets.optJSONObject(i);
            if (b != null && pkg.equals(b.optString("packageName"))) return b.optString("id", "");
        }
        return "";
    }

    // Real per-app minutes for OUR on-device detail view (Android enricher —
    // renders locally, never transmitted, never fed to the coach).
    @PluginMethod
    public void getUsage(PluginCall call) {
        Context ctx = getContext();
        if (!GGScreenTime.usageAccessGranted(ctx)) {
            call.reject("Usage access has not been granted yet.");
            return;
        }
        String range = call.getString("range", "today");
        long end = System.currentTimeMillis();
        long start = "week".equals(range)
            ? GGScreenTime.startOfToday() - 6L * 24 * 60 * 60 * 1000
            : GGScreenTime.startOfToday();
        Set<String> selection = GGScreenTime.loadSelection(ctx);
        java.util.Map<String, Long> ms = GGScreenTime.foregroundMillis(ctx, selection, start, end);
        PackageManager pm = ctx.getPackageManager();
        JSArray rows = new JSArray();
        long total = 0;
        for (String pkg : selection) {
            long minutes = ms.getOrDefault(pkg, 0L) / 60_000L;
            total += minutes;
            JSObject row = new JSObject();
            row.put("packageName", pkg);
            row.put("label", labelFor(pm, pkg));
            row.put("minutes", minutes);
            rows.put(row);
        }
        JSObject ret = new JSObject();
        ret.put("apps", rows);
        ret.put("totalMinutes", total);
        ret.put("range", range);
        call.resolve(ret);
    }

    private static String labelFor(PackageManager pm, String pkg) {
        try {
            return String.valueOf(pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)));
        } catch (PackageManager.NameNotFoundException e) {
            return pkg;
        }
    }

    // ── Coach bands (docs/screentime/coach-data-contract.md) ──
    // Same JS shape as iOS: bands only, never names, never measured minutes.

    @PluginMethod
    public void getBoundaryStates(PluginCall call) {
        try {
            Context ctx = getContext();
            GGScreenTime.evaluateBands(ctx);
            JSONArray budgets = GGScreenTime.loadBudgets(ctx);
            JSONObject bands = GGScreenTime.loadBands(ctx);
            String today = GGScreenTime.dayString(new java.util.Date());
            JSArray boundaries = new JSArray();
            JSArray states = new JSArray();
            for (int i = 0; i < budgets.length(); i++) {
                JSONObject budget = budgets.getJSONObject(i);
                String id = budget.getString("id");
                JSObject boundary = new JSObject();
                boundary.put("id", id);
                boundary.put("kind", "app");
                boundary.put("limitMinutes", budget.getInt("minutes"));
                boundary.put("window", "daily");
                boundaries.put(boundary);
                JSObject state = new JSObject();
                state.put("boundaryId", id);
                state.put("band", bands.optString(id, "kept"));
                state.put("date", today);
                states.put(state);
            }
            JSObject ret = new JSObject();
            ret.put("boundaries", boundaries);
            ret.put("states", states);
            call.resolve(ret);
        } catch (JSONException e) {
            call.reject("Could not read boundary states.");
        }
    }

    @PluginMethod
    public void drainBoundaryTransitions(PluginCall call) {
        try {
            Context ctx = getContext();
            GGScreenTime.evaluateBands(ctx);
            JSONArray log = GGScreenTime.drainBandLog(ctx);
            JSArray transitions = new JSArray();
            for (int i = 0; i < log.length(); i++) transitions.put(log.getJSONObject(i));
            JSObject ret = new JSObject();
            ret.put("transitions", transitions);
            call.resolve(ret);
        } catch (JSONException e) {
            call.reject("Could not drain boundary transitions.");
        }
    }

    @PluginMethod
    public void disable(PluginCall call) {
        GGScreenTime.prefs(getContext()).edit().clear().apply();
        call.resolve();
    }

    private static String iconBase64(PackageManager pm, ApplicationInfo app) {
        try {
            Drawable drawable = pm.getApplicationIcon(app);
            int size = 96;
            Bitmap bitmap;
            if (drawable instanceof BitmapDrawable && ((BitmapDrawable) drawable).getBitmap() != null) {
                bitmap = Bitmap.createScaledBitmap(((BitmapDrawable) drawable).getBitmap(), size, size, true);
            } else {
                bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(bitmap);
                drawable.setBounds(0, 0, size, size);
                drawable.draw(canvas);
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 90, out);
            return "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }
}
