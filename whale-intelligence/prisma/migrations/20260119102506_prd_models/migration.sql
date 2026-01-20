-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_outcomes" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "market_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orderbook_snapshots" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "outcome_label" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "bid_depth_usd" DECIMAL(65,30) NOT NULL,
    "ask_depth_usd" DECIMAL(65,30) NOT NULL,
    "total_depth_usd" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "orderbook_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_settlements" (
    "market_id" TEXT NOT NULL,
    "settled_outcome" TEXT NOT NULL,
    "settled_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_settlements_pkey" PRIMARY KEY ("market_id")
);

-- CreateTable
CREATE TABLE "whale_scores_ext" (
    "wallet" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL,
    "capital_impact" INTEGER NOT NULL,
    "timing_advantage" INTEGER NOT NULL,
    "historical_accuracy" INTEGER NOT NULL,
    "market_impact" INTEGER NOT NULL,

    CONSTRAINT "whale_scores_ext_pkey" PRIMARY KEY ("wallet","market_id","calculated_at")
);

-- CreateIndex
CREATE INDEX "orderbook_snapshots_market_id_outcome_label_timestamp_idx" ON "orderbook_snapshots"("market_id", "outcome_label", "timestamp");
