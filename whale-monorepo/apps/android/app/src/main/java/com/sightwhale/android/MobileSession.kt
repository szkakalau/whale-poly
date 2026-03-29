package com.sightwhale.android

import android.content.Context

object MobileSession {
  private const val PREFS = "whale_mobile"
  private const val KEY_TOKEN = "access_token"

  @Volatile
  var accessToken: String? = null
    private set

  fun init(context: Context) {
    val app = context.applicationContext
    val p = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    accessToken = p.getString(KEY_TOKEN, null)
  }

  fun setToken(context: Context, token: String?) {
    val app = context.applicationContext
    accessToken = token
    app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_TOKEN, token).apply()
  }
}
