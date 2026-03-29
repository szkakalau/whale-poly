package com.sightwhale.android

import android.app.Activity
import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    MobileSession.init(this)
    setContent {
      MaterialTheme {
        WhaleApp()
      }
    }
  }
}

private enum class AppTab {
  LEADERBOARD,
  SIGNALS,
  WHALE_DETAIL,
  SUBSCRIPTION
}

@Composable
private fun WhaleApp() {
  val appContext = LocalContext.current.applicationContext
  val repo = remember(appContext) { WhaleRepository.create(appContext) }
  var currentTab by remember { mutableStateOf(AppTab.LEADERBOARD) }

  Scaffold(
    bottomBar = {
      BottomAppBar {
        TabButton(label = "Leaderboard") { currentTab = AppTab.LEADERBOARD }
        TabButton(label = "Signals") { currentTab = AppTab.SIGNALS }
        TabButton(label = "Whale") { currentTab = AppTab.WHALE_DETAIL }
        TabButton(label = "Subscription") { currentTab = AppTab.SUBSCRIPTION }
      }
    }
  ) { padding ->
    Column(modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
      when (currentTab) {
        AppTab.LEADERBOARD -> LeaderboardScreen(repo)
        AppTab.SIGNALS -> SignalsScreen(repo)
        AppTab.WHALE_DETAIL -> WhaleDetailScreen(repo)
        AppTab.SUBSCRIPTION -> SubscriptionScreen(repo)
      }
    }
  }
}

@Composable
private fun SubscriptionScreen(repo: WhaleRepository) {
  val context = LocalContext.current
  val appContext = context.applicationContext
  val activity = context as? Activity
  val scope = rememberCoroutineScope()
  var initData by remember { mutableStateOf("") }
  var authStatus by remember { mutableStateOf<String?>(null) }
  var status by remember { mutableStateOf("Billing idle") }
  val manager = remember(activity) {
    activity?.let {
      PlayBillingManager(
        activity = it,
        onPurchaseSynced = { request ->
          scope.launch {
            runCatching { repo.syncGoogleBilling(request) }
              .onSuccess {
                status = "Synced plan=${it.plan}"
                AppTelemetry.info("billing_sync_ok plan=${it.plan}")
              }
              .onFailure {
                status = "Sync failed: ${it.message}"
                AppTelemetry.error("billing_sync_failed", it)
              }
          }
        },
        onError = { status = it }
      )
    }
  }

  DisposableEffect(manager) {
    manager?.connect {
      status = "Billing connected"
    }
    onDispose { }
  }

  Column(
    modifier = Modifier
      .fillMaxWidth()
      .verticalScroll(rememberScrollState()),
    verticalArrangement = Arrangement.spacedBy(12.dp)
  ) {
    Text("Telegram login", style = MaterialTheme.typography.titleMedium)
    Text(
      "Paste initData from Telegram Mini App WebApp, then tap Login so subscription sync is authorized.",
      style = MaterialTheme.typography.bodySmall
    )
    OutlinedTextField(
      value = initData,
      onValueChange = { initData = it },
      modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
      label = { Text("initData") },
      maxLines = 8
    )
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      Button(onClick = {
        scope.launch {
          authStatus = "Logging in…"
          runCatching { repo.loginWithTelegram(appContext, initData) }
            .onSuccess {
              authStatus = "Logged in"
              AppTelemetry.info("telegram_login_ok")
            }
            .onFailure {
              authStatus = "Login failed: ${it.message}"
              AppTelemetry.error("telegram_login_failed", it)
            }
        }
      }) {
        Text("Login")
      }
      Button(onClick = {
        MobileSession.setToken(appContext, null)
        authStatus = "Logged out"
      }) {
        Text("Logout")
      }
    }
    authStatus?.let { Text(it) }

    Text("Google Play Billing", style = MaterialTheme.typography.titleMedium)
    Text(status)
    if (manager == null) {
      Text("Billing unavailable: Activity context missing")
      return@Column
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      Button(onClick = { manager.launchSubscription("pro_monthly") }) {
        Text("Buy Pro")
      }
      Button(onClick = { manager.launchSubscription("elite_monthly") }) {
        Text("Buy Elite")
      }
    }
  }
}

@Composable
private fun TabButton(label: String, onClick: () -> Unit) {
  Text(
    text = label,
    modifier = Modifier.padding(horizontal = 12.dp).clickable { onClick() }
  )
}

@Composable
private fun LeaderboardScreen(repo: WhaleRepository) {
  var loading by remember { mutableStateOf(true) }
  var rows by remember { mutableStateOf<List<LeaderboardItem>>(emptyList()) }
  var error by remember { mutableStateOf<String?>(null) }
  val scope = rememberCoroutineScope()

  LaunchedEffect(Unit) {
    scope.launch {
      loading = true
      error = null
      runCatching { repo.fetchLeaderboard() }
        .onSuccess { rows = it }
        .onFailure { error = it.message }
      loading = false
    }
  }

  if (loading) {
    CircularProgressIndicator()
    return
  }

  if (error != null) {
    Text("Load failed: $error")
    return
  }

  LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    items(rows) { row ->
      Column(modifier = Modifier.fillMaxWidth()) {
        Text(row.wallet, style = MaterialTheme.typography.titleSmall)
        Text("Profit: ${row.profit}  Vol: ${row.volume}  ROI: ${row.roi}")
      }
    }
  }
}

@Composable
private fun SignalsScreen(repo: WhaleRepository) {
  var loading by remember { mutableStateOf(true) }
  var rows by remember { mutableStateOf<List<LiveSignal>>(emptyList()) }
  var error by remember { mutableStateOf<String?>(null) }
  val scope = rememberCoroutineScope()

  LaunchedEffect(Unit) {
    scope.launch {
      loading = true
      error = null
      runCatching { repo.fetchSignals() }
        .onSuccess { rows = it }
        .onFailure { error = it.message }
      loading = false
    }
  }

  if (loading) {
    CircularProgressIndicator()
    return
  }

  if (error != null) {
    Text("Load failed: $error")
    return
  }

  if (rows.isEmpty()) {
    Text("No live signals yet.")
    return
  }

  LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    items(rows) { row ->
      Column(modifier = Modifier.fillMaxWidth()) {
        Text(row.market, style = MaterialTheme.typography.titleSmall)
        Text("${row.walletMasked} · ${row.side} · \$${"%.0f".format(row.sizeUsd)}")
      }
    }
  }
}

@Composable
private fun WhaleDetailScreen(repo: WhaleRepository) {
  var wallet by remember { mutableStateOf("0x0000000000000000000000000000000000000000") }
  var loading by remember { mutableStateOf(false) }
  var profile by remember { mutableStateOf<WhaleProfile?>(null) }
  var error by remember { mutableStateOf<String?>(null) }
  val scope = rememberCoroutineScope()

  Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Text("Wallet: $wallet")
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      Button(onClick = {
        scope.launch {
          loading = true
          error = null
          runCatching { repo.fetchWhale(wallet) }
            .onSuccess { profile = it }
            .onFailure { error = it.message }
          loading = false
        }
      }) {
        Text("Load Whale Detail")
      }
    }

    if (loading) {
      CircularProgressIndicator()
    } else if (error != null) {
      Text("Load failed: $error")
    } else if (profile != null) {
      Text("Display: ${profile?.displayName ?: profile?.wallet}")
      Text("Score: ${profile?.whaleScore ?: 0.0}")
      Text("Trades: ${profile?.totalTrades ?: 0}")
      Text("Win rate: ${profile?.winRate ?: 0.0}")
      Text("PnL: ${profile?.realizedPnl ?: 0.0}")
    }
  }
}

private class WhaleRepository(private val appContext: Context, private val api: WhaleApi) {
  suspend fun fetchLeaderboard(): List<LeaderboardItem> =
    withContext(Dispatchers.IO) {
      api.getLeaderboard(limit = 25).items
    }

  suspend fun fetchSignals(): List<LiveSignal> =
    withContext(Dispatchers.IO) {
      api.getSignals().signals
    }

  suspend fun fetchWhale(wallet: String): WhaleProfile =
    withContext(Dispatchers.IO) {
      api.getWhale(wallet)
    }

  suspend fun syncGoogleBilling(request: GoogleBillingSyncRequest): GoogleBillingSyncResponse =
    withContext(Dispatchers.IO) {
      api.syncGoogleBilling(request)
    }

  suspend fun loginWithTelegram(context: Context, initData: String): Unit =
    withContext(Dispatchers.IO) {
      val trimmed = initData.trim()
      if (trimmed.isEmpty()) {
        throw IllegalArgumentException("initData is empty")
      }
      val res = api.authTelegram(TelegramAuthBody(initData = trimmed))
      if (!res.ok || res.accessToken.isBlank()) {
        throw IllegalStateException("auth failed")
      }
      MobileSession.setToken(context.applicationContext, res.accessToken)
    }

  companion object {
    fun create(appContext: Context): WhaleRepository {
      val json = Json { ignoreUnknownKeys = true }
      val contentType = "application/json".toMediaType()
      val logging = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }
      val client = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor())
        .addInterceptor(logging)
        .build()
      val retrofit = Retrofit.Builder()
        .baseUrl("${BuildConfig.API_BASE_URL}/")
        .addConverterFactory(json.asConverterFactory(contentType))
        .client(client)
        .build()
      return WhaleRepository(appContext.applicationContext, retrofit.create(WhaleApi::class.java))
    }
  }
}

private interface WhaleApi {
  @GET("api/smart-money/leaderboard")
  suspend fun getLeaderboard(
    @Query("orderBy") orderBy: String = "PNL",
    @Query("timePeriod") timePeriod: String = "MONTH",
    @Query("category") category: String = "OVERALL",
    @Query("limit") limit: Int = 25
  ): LeaderboardResponse

  @GET("api/live-signals")
  suspend fun getSignals(): SignalsResponse

  @GET("api/mobile/whales/{wallet}")
  suspend fun getWhale(@Path("wallet") wallet: String): WhaleProfile

  @POST("api/mobile/billing/google/sync")
  suspend fun syncGoogleBilling(@Body body: GoogleBillingSyncRequest): GoogleBillingSyncResponse

  @POST("api/mobile/auth/telegram")
  suspend fun authTelegram(@Body body: TelegramAuthBody): TelegramAuthResponse
}

@Serializable
private data class LeaderboardResponse(
  val items: List<LeaderboardItem> = emptyList()
)

@Serializable
private data class LeaderboardItem(
  val wallet: String,
  val profit: Double = 0.0,
  val volume: Double = 0.0,
  val roi: Double = 0.0
)

@Serializable
private data class SignalsResponse(
  val signals: List<LiveSignal> = emptyList()
)

@Serializable
private data class LiveSignal(
  val id: String = "",
  val occurredAt: String = "",
  val walletMasked: String = "",
  val market: String = "",
  val side: String = "UNKNOWN",
  val sizeUsd: Double = 0.0,
  val whaleScore: Double? = null,
  val href: String? = null
)

@Serializable
private data class WhaleProfile(
  val wallet: String? = null,
  @SerialName("display_name") val displayName: String? = null,
  @SerialName("whale_score") val whaleScore: Double = 0.0,
  @SerialName("total_trades") val totalTrades: Int = 0,
  @SerialName("win_rate") val winRate: Double = 0.0,
  @SerialName("realized_pnl") val realizedPnl: Double = 0.0
)

@Serializable
data class GoogleBillingSyncRequest(
  val purchaseToken: String,
  val productId: String,
  val orderId: String,
  val purchaseTimeMs: Long,
  val expiryTimeMs: Long,
  val isAutoRenewing: Boolean
)

@Serializable
data class GoogleBillingSyncResponse(
  val ok: Boolean = false,
  val plan: String = "FREE",
  val planExpireAt: String? = null
)

@Serializable
private data class TelegramAuthBody(val initData: String)

@Serializable
private data class TelegramAuthResponse(
  val ok: Boolean = false,
  val accessToken: String = "",
  val expiresIn: Long = 0
)
