package com.sightwhale.android

import android.app.Activity
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams

class PlayBillingManager(
  private val activity: Activity,
  private val onPurchaseSynced: (GoogleBillingSyncRequest) -> Unit,
  private val onError: (String) -> Unit
) : PurchasesUpdatedListener {

  private val billingClient: BillingClient = BillingClient.newBuilder(activity)
    .setListener(this)
    .enablePendingPurchases()
    .build()

  fun connect(onReady: () -> Unit) {
    billingClient.startConnection(object : BillingClientStateListener {
      override fun onBillingSetupFinished(result: BillingResult) {
        if (result.responseCode == BillingClient.BillingResponseCode.OK) {
          onReady()
        } else {
          onError("billing_setup_failed_${result.responseCode}")
        }
      }

      override fun onBillingServiceDisconnected() {
        onError("billing_service_disconnected")
      }
    })
  }

  fun launchSubscription(productId: String) {
    val params = QueryProductDetailsParams.newBuilder()
      .setProductList(
        listOf(
          QueryProductDetailsParams.Product.newBuilder()
            .setProductId(productId)
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        )
      )
      .build()

    billingClient.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
      if (billingResult.responseCode != BillingClient.BillingResponseCode.OK || productDetailsList.isEmpty()) {
        onError("query_product_failed_${billingResult.responseCode}")
        return@queryProductDetailsAsync
      }
      launchBillingFlow(productDetailsList.first())
    }
  }

  private fun launchBillingFlow(productDetails: ProductDetails) {
    val offerToken = productDetails.subscriptionOfferDetails?.firstOrNull()?.offerToken
    if (offerToken.isNullOrBlank()) {
      onError("missing_offer_token")
      return
    }
    val billingFlowParams = BillingFlowParams.newBuilder()
      .setProductDetailsParamsList(
        listOf(
          BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(productDetails)
            .setOfferToken(offerToken)
            .build()
        )
      )
      .build()
    val result = billingClient.launchBillingFlow(activity, billingFlowParams)
    if (result.responseCode != BillingClient.BillingResponseCode.OK) {
      onError("launch_billing_failed_${result.responseCode}")
    }
  }

  override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
    if (result.responseCode != BillingClient.BillingResponseCode.OK || purchases.isNullOrEmpty()) {
      onError("purchase_update_failed_${result.responseCode}")
      return
    }
    purchases.forEach { purchase ->
      acknowledgeIfNeeded(purchase)
      val productId = purchase.products.firstOrNull() ?: return@forEach
      val purchaseToken = purchase.purchaseToken
      if (purchaseToken.isBlank()) return@forEach
      onPurchaseSynced(
        GoogleBillingSyncRequest(
          purchaseToken = purchaseToken,
          productId = productId,
          orderId = purchase.orderId ?: "unknown_order",
          purchaseTimeMs = purchase.purchaseTime,
          expiryTimeMs = purchase.purchaseTime + 30L * 24L * 60L * 60L * 1000L,
          isAutoRenewing = purchase.isAutoRenewing
        )
      )
    }
  }

  private fun acknowledgeIfNeeded(purchase: Purchase) {
    if (purchase.isAcknowledged) return
    val ack = AcknowledgePurchaseParams.newBuilder()
      .setPurchaseToken(purchase.purchaseToken)
      .build()
    billingClient.acknowledgePurchase(ack) { result ->
      if (result.responseCode != BillingClient.BillingResponseCode.OK) {
        onError("ack_failed_${result.responseCode}")
      }
    }
  }
}
