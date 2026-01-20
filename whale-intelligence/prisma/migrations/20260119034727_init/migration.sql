-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bindings" (
    "user_id" TEXT NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "telegram_username" TEXT,
    "bound_at" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "access_tokens" (
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL,

    CONSTRAINT "access_tokens_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "trades_raw" (
    "trade_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "whale_profiles" (
    "wallet" TEXT NOT NULL,
    "total_volume" DECIMAL(65,30) NOT NULL,
    "win_rate" DECIMAL(65,30) NOT NULL,
    "avg_size" DECIMAL(65,30) NOT NULL,
    "markets_count" INTEGER NOT NULL,

    CONSTRAINT "whale_profiles_pkey" PRIMARY KEY ("wallet")
);

-- CreateTable
CREATE TABLE "whale_scores" (
    "wallet" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whale_scores_pkey" PRIMARY KEY ("wallet","market_id","calculated_at")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bindings_user_id_key" ON "telegram_bindings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bindings_telegram_user_id_key" ON "telegram_bindings"("telegram_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trades_raw_trade_id_key" ON "trades_raw"("trade_id");

-- AddForeignKey
ALTER TABLE "telegram_bindings" ADD CONSTRAINT "telegram_bindings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
