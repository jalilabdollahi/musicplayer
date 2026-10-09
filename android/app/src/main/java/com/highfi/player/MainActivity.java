package com.highfi.player;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.highfi.player.car.CarMediaPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CarMediaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
