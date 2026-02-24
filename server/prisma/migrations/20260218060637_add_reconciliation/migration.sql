-- CreateTable
CREATE TABLE `ReconciliationLog` (
    `id` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `dbTotal` DOUBLE NOT NULL,
    `stripeTotal` DOUBLE NOT NULL,
    `mismatch` DOUBLE NOT NULL,
    `details` TEXT NOT NULL,
    `reconciledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReconciliationLog_periodStart_idx`(`periodStart`),
    INDEX `ReconciliationLog_periodEnd_idx`(`periodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
