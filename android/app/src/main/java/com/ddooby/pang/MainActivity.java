package com.ddooby.pang;

import android.content.res.Configuration;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Capacitor SystemBars는 시작할 때(메인 스레드 큐) 창 배경을 테마의 windowBackground 단색으로 다시 칠한다.
        // 그 뒤에 실행되도록 같은 큐에 넣는다
        new Handler(Looper.getMainLooper()).post(this::paintBarBackground);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig); // 여기서 SystemBars가 다시 칠한다
        paintBarBackground();
    }

    /**
     * 시스템 바 뒤 띠(WebView 140 미만에서 보이는 창 배경)를 하늘(위) → 땅(아래) 그라데이션으로 (W4-14).
     * 값은 drawable/app_background.xml (THEME.sky.top → THEME.hills.front)
     */
    private void paintBarBackground() {
        getWindow().getDecorView().setBackgroundResource(R.drawable.app_background);
    }
}
