package com.sightwhale.android

import android.util.Log

/**
 * Minimal structured logging for MVP. Replace or wrap with Crashlytics / Analytics in P1.
 */
object AppTelemetry {
  private const val TAG = "WhaleAndroid"

  fun info(message: String) {
    Log.i(TAG, message)
  }

  fun warn(message: String, throwable: Throwable? = null) {
    if (throwable != null) Log.w(TAG, message, throwable) else Log.w(TAG, message)
  }

  fun error(message: String, throwable: Throwable? = null) {
    if (throwable != null) Log.e(TAG, message, throwable) else Log.e(TAG, message)
  }
}
