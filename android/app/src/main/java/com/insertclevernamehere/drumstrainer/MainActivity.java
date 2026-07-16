package com.insertclevernamehere.drumstrainer;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Handle share intent on cold start
        handleIntent(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        // Handle share intent on warm start
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        String type = intent.getType();

        // 1. Handle SHARE (ACTION_SEND)
        if (Intent.ACTION_SEND.equals(action) && "text/plain".equals(type)) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (sharedText != null && this.bridge != null) {
                String encoded = Uri.encode(sharedText);
                // Redirects to your live site with the query param your JS already supports
                String url = "https://insertclevernamehere.github.io/Drums-Trainer/index.html?share_text=" + encoded;
                this.bridge.getWebView().loadUrl(url);
            }
        }
        // 2. Handle SHORTCUTS (HTTPS)
        else {
            Uri data = intent.getData();
            if (data != null && "https".equals(data.getScheme())) {
                this.bridge.getWebView().loadUrl(data.toString());
            }
        }
    }
}
