package app.guidedgrowth.mvp.screentime;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.concurrent.TimeUnit;

// Periodic band evaluation so limit crossings register even when GG stays
// closed ("a few times a day plus on app-open" — coach-data-contract.md).
// Journal entries wait in prefs until the next app-open drain.
public class BandEvalWorker extends Worker {
    private static final String WORK_NAME = "gg.screentime.bandeval";

    public BandEvalWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            GGScreenTime.evaluateBands(getApplicationContext());
            return Result.success();
        } catch (Exception e) {
            return Result.failure(); // next period retries anyway
        }
    }

    static void schedule(Context ctx) {
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                BandEvalWorker.class, 4, TimeUnit.HOURS)
            .setConstraints(Constraints.NONE)
            .build();
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
            WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    static void cancel(Context ctx) {
        WorkManager.getInstance(ctx).cancelUniqueWork(WORK_NAME);
    }
}
