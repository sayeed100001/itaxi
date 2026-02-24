CREATE TABLE IF NOT EXISTS `TripMetadata` (
    `id` VARCHAR(191) NOT NULL,
    `tripId` VARCHAR(191) NOT NULL,
    `isScheduled` BOOLEAN NOT NULL DEFAULT false,
    `scheduledFor` DATETIME(3) NULL,
    `scheduledDispatchedAt` DATETIME(3) NULL,
    `bookingChannel` VARCHAR(191) NOT NULL DEFAULT 'APP',
    `requestedForName` VARCHAR(191) NULL,
    `requestedForPhone` VARCHAR(191) NULL,
    `womenOnly` BOOLEAN NOT NULL DEFAULT false,
    `serviceClass` VARCHAR(191) NULL,
    `extraStops` JSON NULL,
    `specialInstructions` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TripMetadata_tripId_key`(`tripId`),
    INDEX `TripMetadata_scheduledFor_idx`(`scheduledFor`),
    INDEX `TripMetadata_isScheduled_scheduledDispatchedAt_idx`(`isScheduled`, `scheduledDispatchedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TripMetadata`
ADD CONSTRAINT `TripMetadata_tripId_fkey`
FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
