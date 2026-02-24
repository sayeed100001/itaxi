ALTER TABLE `Driver`
  ADD COLUMN `creditBalance` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `creditExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `monthlyPackage` VARCHAR(191) NULL;

CREATE TABLE IF NOT EXISTS `DriverCreditLedger` (
    `id` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `tripId` VARCHAR(191) NULL,
    `actorUserId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `creditsDelta` INTEGER NOT NULL,
    `balanceAfter` INTEGER NOT NULL,
    `amountAfn` DOUBLE NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `paymentReference` VARCHAR(191) NULL,
    `packageName` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DriverCreditLedger_driverId_createdAt_idx`(`driverId`, `createdAt`),
    INDEX `DriverCreditLedger_tripId_idx`(`tripId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DriverCreditLedger`
ADD CONSTRAINT `DriverCreditLedger_driverId_fkey`
FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
