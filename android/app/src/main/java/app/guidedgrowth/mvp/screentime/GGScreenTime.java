package app.guidedgrowth.mvp.screentime;

import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.app.AppOpsManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Process;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

// Android half of the Screen Time state + the coach band reducer
// (docs/screentime/coach-data-contract.md). Real per-app minutes are read via
// UsageStatsManager and REDUCED to kept/approaching/crossed here — measured
// minutes and package names never leave the device. Boundary ids are UUIDs;
// the id→package mapping lives only in these prefs.
final class GGScreenTime {
    static final String PREFS = "gg.screentime";
    static final String KEY_SELECTION = "gg.selection.v1"; // StringSet of package names
    static final String KEY_BUDGETS = "gg.budgets.v1"; // JSON [{id,packageName,minutes}]
    static final String KEY_BANDS = "gg.bands.v1"; // JSON {boundaryId: band}
    static final String KEY_BANDS_DATE = "gg.bandsdate.v1";
    static final String KEY_BAND_LOG = "gg.bandlog.v1"; // JSON [transition]

    static final double WARN_FRACTION = 0.8; // approaching at 80% of the limit (tunable)

    private GGScreenTime() {}

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean usageAccessGranted(Context ctx) {
        AppOpsManager ops = (AppOpsManager) ctx.getSystemService(Context.APP_OPS_SERVICE);
        int mode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            mode = ops.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
        } else {
            mode = ops.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    static Set<String> loadSelection(Context ctx) {
        Set<String> stored = prefs(ctx).getStringSet(KEY_SELECTION, null);
        return stored == null ? new HashSet<>() : new HashSet<>(stored);
    }

    static void saveSelection(Context ctx, Set<String> packages) {
        prefs(ctx).edit().putStringSet(KEY_SELECTION, new HashSet<>(packages)).apply();
    }

    static JSONArray loadBudgets(Context ctx) {
        try {
            return new JSONArray(prefs(ctx).getString(KEY_BUDGETS, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    static void saveBudgets(Context ctx, JSONArray budgets) {
        prefs(ctx).edit().putString(KEY_BUDGETS, budgets.toString()).apply();
    }

    static String dayString(Date date) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date);
    }

    // Foreground milliseconds per package since `start`, reconstructed from
    // resume/pause event pairs. Sessions open at a crash/reboot close at `end`
    // conservatively.
    static Map<String, Long> foregroundMillis(
            Context ctx, Set<String> packages, long start, long end) {
        Map<String, Long> totals = new HashMap<>();
        UsageStatsManager usm = (UsageStatsManager) ctx.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return totals;
        UsageEvents events = usm.queryEvents(start, end);
        Map<String, Long> openedAt = new HashMap<>();
        UsageEvents.Event event = new UsageEvents.Event();
        int resumed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? UsageEvents.Event.ACTIVITY_RESUMED : UsageEvents.Event.MOVE_TO_FOREGROUND;
        int paused = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? UsageEvents.Event.ACTIVITY_PAUSED : UsageEvents.Event.MOVE_TO_BACKGROUND;
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            String pkg = event.getPackageName();
            if (pkg == null || !packages.contains(pkg)) continue;
            int type = event.getEventType();
            if (type == resumed) {
                // multiple activities of one app: keep the earliest open time
                if (!openedAt.containsKey(pkg)) openedAt.put(pkg, event.getTimeStamp());
            } else if (type == paused) {
                Long open = openedAt.remove(pkg);
                if (open != null) {
                    long ms = Math.max(0, event.getTimeStamp() - open);
                    totals.put(pkg, totals.getOrDefault(pkg, 0L) + ms);
                }
            }
        }
        for (Map.Entry<String, Long> stillOpen : openedAt.entrySet()) {
            long ms = Math.max(0, end - stillOpen.getValue());
            totals.put(stillOpen.getKey(), totals.getOrDefault(stillOpen.getKey(), 0L) + ms);
        }
        return totals;
    }

    static long startOfToday() {
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        return cal.getTimeInMillis();
    }

    // ── Coach bands: same semantics as the iOS GGMon copy ──
    // kept → approaching → crossed, escalate-only within a day, rollover
    // resets, every change journaled for the JS drain.

    private static int bandRank(String band) {
        if ("crossed".equals(band)) return 2;
        if ("approaching".equals(band)) return 1;
        return 0;
    }

    static JSONObject loadBands(Context ctx) {
        try {
            return new JSONObject(prefs(ctx).getString(KEY_BANDS, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    // Reads today's usage, reduces every budget to a band, journals changes.
    // Called from getBoundaryStates + drainBoundaryTransitions (app-open /
    // foreground cadence — not a live feed).
    static void evaluateBands(Context ctx) throws JSONException {
        if (!usageAccessGranted(ctx)) return;
        String today = dayString(new Date());
        SharedPreferences p = prefs(ctx);
        if (!today.equals(p.getString(KEY_BANDS_DATE, null))) rolloverBands(ctx, today);

        JSONArray budgets = loadBudgets(ctx);
        if (budgets.length() == 0) return;
        Set<String> packages = new HashSet<>();
        for (int i = 0; i < budgets.length(); i++) {
            packages.add(budgets.getJSONObject(i).getString("packageName"));
        }
        Map<String, Long> ms = foregroundMillis(ctx, packages, startOfToday(), System.currentTimeMillis());

        JSONObject bands = loadBands(ctx);
        for (int i = 0; i < budgets.length(); i++) {
            JSONObject budget = budgets.getJSONObject(i);
            String id = budget.getString("id");
            int limit = budget.getInt("minutes");
            long minutes = ms.getOrDefault(budget.getString("packageName"), 0L) / 60_000L;
            String band = minutes >= limit ? "crossed"
                : minutes >= Math.max(1, Math.round(limit * WARN_FRACTION)) ? "approaching" : "kept";
            String previous = bands.optString(id, "kept");
            if (bandRank(band) > bandRank(previous)) {
                bands.put(id, band);
                appendBandLog(ctx, id, band, previous, today);
            }
        }
        p.edit().putString(KEY_BANDS, bands.toString()).apply();
    }

    static void rolloverBands(Context ctx, String today) throws JSONException {
        JSONObject bands = loadBands(ctx);
        for (java.util.Iterator<String> it = bands.keys(); it.hasNext(); ) {
            String id = it.next();
            String band = bands.getString(id);
            if (!"kept".equals(band)) appendBandLog(ctx, id, "kept", band, today);
        }
        prefs(ctx).edit()
            .putString(KEY_BANDS, "{}")
            .putString(KEY_BANDS_DATE, today)
            .apply();
    }

    // budgets edited/removed → drop bands for ids that no longer exist
    static void pruneBands(Context ctx, Set<String> validIds) {
        JSONObject bands = loadBands(ctx);
        JSONObject kept = new JSONObject();
        boolean changed = false;
        for (java.util.Iterator<String> it = bands.keys(); it.hasNext(); ) {
            String id = it.next();
            if (validIds.contains(id)) {
                try {
                    kept.put(id, bands.getString(id));
                } catch (JSONException ignored) {}
            } else {
                changed = true;
            }
        }
        if (changed) prefs(ctx).edit().putString(KEY_BANDS, kept.toString()).apply();
    }

    private static void appendBandLog(
            Context ctx, String id, String band, String previous, String date) throws JSONException {
        SharedPreferences p = prefs(ctx);
        JSONArray log;
        try {
            log = new JSONArray(p.getString(KEY_BAND_LOG, "[]"));
        } catch (JSONException e) {
            log = new JSONArray();
        }
        JSONObject entry = new JSONObject();
        entry.put("boundaryId", id);
        entry.put("band", band);
        entry.put("previousBand", previous);
        entry.put("date", date);
        entry.put("at", System.currentTimeMillis() / 1000.0);
        log.put(entry);
        while (log.length() > 200) log.remove(0);
        p.edit().putString(KEY_BAND_LOG, log.toString()).apply();
    }

    static JSONArray drainBandLog(Context ctx) {
        SharedPreferences p = prefs(ctx);
        JSONArray log;
        try {
            log = new JSONArray(p.getString(KEY_BAND_LOG, "[]"));
        } catch (JSONException e) {
            log = new JSONArray();
        }
        p.edit().remove(KEY_BAND_LOG).apply();
        return log;
    }
}
