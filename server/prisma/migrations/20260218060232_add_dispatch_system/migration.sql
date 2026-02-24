-- CreateTable
CREATE TABLE `TripOffer` (
    `id` VARCHAR(191) NOT NULL,
    `tripId` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `score` DOUBLE NOT NULL,
    `eta` DOUBLE NOT NULL,
    `offeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `respondedAt` DATETIME(3) NULL,

    INDEX `TripOffer_tripId_idx`(`tripId`),
    INDEX `TripOffer_driverId_idx`(`driverId`),
    INDEX `TripOffer_status_idx`(`status`),
    INDEX `TripOffer_offeredAt_idx`(`offeredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DispatchConfig` (
    `id` VARCHAR(191) NOT NULL,
    `weightETA` DOUBLE NOT NULL DEFAULT 0.5,
    `weightRating` DOUBLE NOT NULL DEFAULT 0.3,
    `weightAcceptance` DOUBLE NOT NULL DEFAULT 0.2,
    `serviceMatchBonus` DOUBLE NOT NULL DEFAULT 0.1,
    `offerTimeout` INTEGER NOT NULL DEFAULT 30,
    `maxOffers` INTEGER NOT NULL DEFAULT 3,
    `searchRadius` DOUBLE NOT NULL DEFAULT 10,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
