package com.sightwhale.android

import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor : Interceptor {
  override fun intercept(chain: Interceptor.Chain): Response {
    val token = MobileSession.accessToken?.trim().orEmpty()
    val request =
      if (token.isNotEmpty()) {
        chain.request().newBuilder().header("Authorization", "Bearer $token").build()
      } else {
        chain.request()
      }
    return chain.proceed(request)
  }
}
