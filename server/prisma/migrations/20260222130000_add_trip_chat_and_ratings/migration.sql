CREATE TABLE IF NOT EXISTS `TripMessage` (
    `id` VARCHAR(191) NOT NULL,
    `tripId` VARCHAR(191) NOT NULL,
    `fromUserId` VARCHAR(191) NOT NULL,
    `toUserId` VARCHAR(191) NOT NULL,
    `channel` ENUM('IN_APP', 'WHATSAPP') NOT NULL DEFAULT 'IN_APP',
    `body` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NULL,
    `deliveryStatus` ENUM('SENT', 'FAILED') NOT NULL DEFAULT 'SENT',
    `deliveryError` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TripMessage_tripId_createdAt_idx`(`tripId`, `createdAt`),
    INDEX `TripMessage_toUserId_createdAt_idx`(`toUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `TripRating` (
    `id` VARCHAR(191) NOT NULL,
    `tripId` VARCHAR(191) NOT NULL,
    `fromUserId` VARCHAR(191) NOT NULL,
    `toUserId` VARCHAR(191) NOT NULL,
    `fromRole` ENUM('ADMIN', 'DRIVER', 'RIDER') NOT NULL,
    `toRole` ENUM('ADMIN', 'DRIVER', 'RIDER') NOT NULL,
    `score` INTEGER NOT NULL,
    `comment` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TripRating_tripId_fromUserId_key`(`tripId`, `fromUserId`),
    INDEX `TripRating_tripId_idx`(`tripId`),
    INDEX `TripRating_toUserId_toRole_idx`(`toUserId`, `toRole`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TripMessage`
ADD CONSTRAINT `TripMessage_tripId_fkey`
FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `TripRating`
ADD CONSTRAINT `TripRating_tripId_fkey`
FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
