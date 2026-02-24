-- AlterTable
ALTER TABLE `Driver` ADD COLUMN `whatsappNumber` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `RideNotification` (
    `id` VARCHAR(191) NOT NULL,
    `tripId` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `messageId` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RideNotification_tripId_idx`(`tripId`),
    INDEX `RideNotification_driverId_idx`(`driverId`),
    INDEX `RideNotification_sentAt_idx`(`sentAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RideNotification` ADD CONSTRAINT `RideNotification_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
