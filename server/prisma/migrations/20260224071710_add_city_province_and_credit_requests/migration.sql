/*
  Warnings:

  - You are about to drop the column `timestamp` on the `communicationlog` table. All the data in the column will be lost.
  - You are about to drop the column `anomalyCount` on the `driverlocation` table. All the data in the column will be lost.
  - You are about to drop the column `bearing` on the `driverlocation` table. All the data in the column will be lost.
  - You are about to drop the column `deviation` on the `driverlocation` table. All the data in the column will be lost.
  - You are about to drop the column `rawLat` on the `driverlocation` table. All the data in the column will be lost.
  - You are about to drop the column `rawLng` on the `driverlocation` table. All the data in the column will be lost.
  - You are about to drop the column `snappedLat` on the `driverlocation` table. All the data in the column will be lost.
  - You are about to drop the column `snappedLng` on the `driverlocation` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `otp` table. All the data in the column will be lost.
  - You are about to alter the column `deliveryStatus` on the `otp` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(6))`.
  - You are about to drop the column `attempts` on the `otplock` table. All the data in the column will be lost.
  - You are about to drop the column `stripePayoutId` on the `payout` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `payout` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(2))` to `Enum(EnumId(8))`.
  - You are about to drop the column `reconciledAt` on the `reconciliationlog` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ridenotification` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `ridenotification` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(9))`.
  - You are about to drop the column `offeredAt` on the `tripoffer` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `tripoffer` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(7))`.
  - A unique constraint covering the columns `[stripeAccountId]` on the table `Driver` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `Payout` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `otp` DROP FOREIGN KEY `OTP_userId_fkey`;

-- DropForeignKey
ALTER TABLE `transaction` DROP FOREIGN KEY `Transaction_userId_fkey`;

-- DropForeignKey
ALTER TABLE `trip` DROP FOREIGN KEY `Trip_riderId_fkey`;

-- DropIndex
DROP INDEX `CommunicationLog_fromUserId_idx` ON `communicationlog`;

-- DropIndex
DROP INDEX `CommunicationLog_timestamp_idx` ON `communicationlog`;

-- DropIndex
DROP INDEX `Driver_status_idx` ON `driver`;

-- DropIndex
DROP INDEX `OTP_messageId_idx` ON `otp`;

-- DropIndex
DROP INDEX `OTP_userId_fkey` ON `otp`;

-- DropIndex
DROP INDEX `OTPLock_lockedUntil_idx` ON `otplock`;

-- DropIndex
DROP INDEX `OTPLock_phone_idx` ON `otplock`;

-- DropIndex
DROP INDEX `Payout_createdAt_idx` ON `payout`;

-- DropIndex
DROP INDEX `ReconciliationLog_periodEnd_idx` ON `reconciliationlog`;

-- DropIndex
DROP INDEX `ReconciliationLog_periodStart_idx` ON `reconciliationlog`;

-- DropIndex
DROP INDEX `RideNotification_status_idx` ON `ridenotification`;

-- DropIndex
DROP INDEX `Transaction_createdAt_idx` ON `transaction`;

-- DropIndex
DROP INDEX `Transaction_stripeSessionId_idx` ON `transaction`;

-- DropIndex
DROP INDEX `Transaction_userId_idx` ON `transaction`;

-- DropIndex
DROP INDEX `Trip_createdAt_idx` ON `trip`;

-- DropIndex
DROP INDEX `Trip_riderId_idx` ON `trip`;

-- DropIndex
DROP INDEX `Trip_status_idx` ON `trip`;

-- DropIndex
DROP INDEX `TripOffer_offeredAt_idx` ON `tripoffer`;

-- DropIndex
DROP INDEX `TripOffer_status_idx` ON `tripoffer`;

-- DropIndex
DROP INDEX `User_phone_idx` ON `user`;

-- DropIndex
DROP INDEX `User_role_idx` ON `user`;

-- AlterTable
ALTER TABLE `auditlog` MODIFY `details` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `communicationlog` DROP COLUMN `timestamp`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `dispatchconfig` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `driver` ADD COLUMN `anomalyCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `province` VARCHAR(191) NULL,
    ADD COLUMN `stripeAccountId` VARCHAR(191) NULL,
    ADD COLUMN `verified` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `driverlocation` DROP COLUMN `anomalyCount`,
    DROP COLUMN `bearing`,
    DROP COLUMN `deviation`,
    DROP COLUMN `rawLat`,
    DROP COLUMN `rawLng`,
    DROP COLUMN `snappedLat`,
    DROP COLUMN `snappedLng`;

-- AlterTable
ALTER TABLE `otp` DROP COLUMN `userId`,
    MODIFY `deliveryStatus` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `otplock` DROP COLUMN `attempts`,
    ADD COLUMN `failedAttempts` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `payout` DROP COLUMN `stripePayoutId`,
    ADD COLUMN `failureReason` VARCHAR(191) NULL,
    ADD COLUMN `idempotencyKey` VARCHAR(191) NULL,
    ADD COLUMN `stripeTransferId` VARCHAR(191) NULL,
    MODIFY `status` ENUM('PENDING_MANUAL_REVIEW', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING_MANUAL_REVIEW';

-- AlterTable
ALTER TABLE `reconciliationlog` DROP COLUMN `reconciledAt`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `details` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ridenotification` DROP COLUMN `updatedAt`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    MODIFY `sentAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `trip` ADD COLUMN `paymentMethod` VARCHAR(191) NOT NULL DEFAULT 'CASH',
    ADD COLUMN `paymentStatus` ENUM('PENDING', 'PAID', 'FAILED', 'CASH_COLLECTED') NOT NULL DEFAULT 'PENDING',
    MODIFY `serviceType` VARCHAR(191) NOT NULL DEFAULT 'TAXI';

-- AlterTable
ALTER TABLE `tripoffer` DROP COLUMN `offeredAt`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `user` ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `province` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `CreditPackage` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `priceAfn` DOUBLE NOT NULL,
    `credits` INTEGER NOT NULL,
    `durationDays` INTEGER NOT NULL DEFAULT 30,
    `perKmRate` DOUBLE NULL,
    `commissionRate` DOUBLE NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CreditPackage_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditPurchaseRequest` (
    `id` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `packageName` VARCHAR(191) NOT NULL,
    `credits` INTEGER NOT NULL,
    `amountAfn` DOUBLE NOT NULL,
    `months` INTEGER NOT NULL DEFAULT 1,
    `paymentMethod` ENUM('CASH', 'MOBILE_MONEY', 'BANK_TRANSFER') NOT NULL DEFAULT 'CASH',
    `paymentReference` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    `reviewedByUserId` VARCHAR(191) NULL,
    `reviewNotes` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CreditPurchaseRequest_driverId_status_idx`(`driverId`, `status`),
    INDEX `CreditPurchaseRequest_status_requestedAt_idx`(`status`, `requestedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Driver_stripeAccountId_key` ON `Driver`(`stripeAccountId`);

-- CreateIndex
CREATE UNIQUE INDEX `Payout_idempotencyKey_key` ON `Payout`(`idempotencyKey`);

-- AddForeignKey
ALTER TABLE `Trip` ADD CONSTRAINT `Trip_riderId_fkey` FOREIGN KEY (`riderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TripOffer` ADD CONSTRAINT `TripOffer_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TripOffer` ADD CONSTRAINT `TripOffer_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payout` ADD CONSTRAINT `Payout_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RideNotification` ADD CONSTRAINT `RideNotification_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationLog` ADD CONSTRAINT `CommunicationLog_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditPurchaseRequest` ADD CONSTRAINT `CreditPurchaseRequest_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
