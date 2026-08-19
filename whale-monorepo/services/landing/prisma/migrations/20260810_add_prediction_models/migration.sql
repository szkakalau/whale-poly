-- CreateTable for the calibrated prediction (logistic regression) model
-- coefficients. Hand-written migration; apply with `npx prisma migrate deploy`.

CREATE TABLE "prediction_models" (
    "id" SERIAL NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "intercept" DOUBLE PRECISION NOT NULL,
    "score_coef" DOUBLE PRECISION NOT NULL,
    "bullish_coef" DOUBLE PRECISION NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "trained_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prediction_models_trained_at_idx" ON "prediction_models"("trained_at");
