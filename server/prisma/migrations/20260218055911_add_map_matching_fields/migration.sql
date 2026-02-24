/*
  Warnings:

  - Made the column `deliveryStatus` on table `otp` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `RideNotification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `driverlocation` ADD COLUMN `anomalyCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `deviation` DOUBLE NULL DEFAULT 0,
    ADD COLUMN `rawLat` DOUBLE NULL,
    ADD COLUMN `rawLng` DOUBLE NULL,
    ADD COLUMN `snappedLat` DOUBLE NULL,
    ADD COLUMN `snappedLng` DOUBLE NULL;

-- AlterTable
ALTER TABLE `otp` MODIFY `deliveryStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `ridenotification` ADD COLUMN `error` VARCHAR(191) NULL,
    ADD COLUMN `retries` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `OTPLock` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OTPLock_phone_key`(`phone`),
    INDEX `OTPLock_phone_idx`(`phone`),
    INDEX `OTPLock_lockedUntil_idx`(`lockedUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `OTP_messageId_idx` ON `OTP`(`messageId`);

-- CreateIndex
CREATE INDEX `RideNotification_status_idx` ON `RideNotification`(`status`);
