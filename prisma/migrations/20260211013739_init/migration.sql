-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "email" TEXT,
    "kycTier" INTEGER NOT NULL DEFAULT 0,
    "kycProvider" TEXT,
    "kycExternalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Remittance" (
    "id" TEXT NOT NULL,
    "onChainId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientWallet" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "sourceAsset" TEXT NOT NULL,
    "destAsset" TEXT NOT NULL,
    "corridor" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "txHash" TEXT,
    "blockNumber" BIGINT,
    "agentWallet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Remittance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelRuleRecord" (
    "id" TEXT NOT NULL,
    "remittanceId" TEXT NOT NULL,
    "originatorName" TEXT NOT NULL,
    "originatorId" TEXT NOT NULL,
    "beneficiaryName" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "sharedWith" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelRuleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Remittance_onChainId_key" ON "Remittance"("onChainId");

-- AddForeignKey
ALTER TABLE "Remittance" ADD CONSTRAINT "Remittance_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceFlag" ADD CONSTRAINT "ComplianceFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
