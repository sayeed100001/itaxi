-- CreateTable
CREATE TABLE `AdminDriverMessage` (
    `id` VARCHAR(191) NOT NULL,
    `adminUserId` VARCHAR(191) NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `channel` ENUM('IN_APP', 'WHATSAPP') NOT NULL DEFAULT 'IN_APP',
    `messageId` VARCHAR(191) NULL,
    `deliveryStatus` ENUM('SENT', 'FAILED') NOT NULL DEFAULT 'SENT',
    `deliveryError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminDriverMessage_driverId_createdAt_idx`(`driverId`, `createdAt`),
    INDEX `AdminDriverMessage_adminUserId_idx`(`adminUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminRiderMessage` (
    `id` VARCHAR(191) NOT NULL,
    `adminUserId` VARCHAR(191) NULL,
    `riderId` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `channel` ENUM('IN_APP', 'WHATSAPP') NOT NULL DEFAULT 'IN_APP',
    `messageId` VARCHAR(191) NULL,
    `deliveryStatus` ENUM('SENT', 'FAILED') NOT NULL DEFAULT 'SENT',
    `deliveryError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminRiderMessage_riderId_createdAt_idx`(`riderId`, `createdAt`),
    INDEX `AdminRiderMessage_adminUserId_idx`(`adminUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
