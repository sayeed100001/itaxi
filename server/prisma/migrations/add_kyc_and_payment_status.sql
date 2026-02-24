-- Add verified field to Driver table
ALTER TABLE `Driver` ADD COLUMN `verified` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Driver` ADD INDEX `Driver_verified_idx`(`verified`);

-- Add payment fields to Trip table
ALTER TABLE `Trip` ADD COLUMN `paymentMethod` VARCHAR(191) NOT NULL DEFAULT 'CASH';
ALTER TABLE `Trip` ADD COLUMN `paymentStatus` ENUM('PENDING', 'PAID', 'FAILED', 'CASH_COLLECTED') NOT NULL DEFAULT 'PENDING';
ALTER TABLE `Trip` ADD INDEX `Trip_paymentStatus_idx`(`paymentStatus`);

-- Create DriverDocument table
CREATE TABLE `DriverDocument` (
    `id` VARCHAR(191) NOT NULL,
    `driverId` VARCHAR(191) NOT NULL,
    `type` ENUM('LICENSE', 'ID_CARD', 'VEHICLE_REG', 'PHOTO') NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DriverDocument_driverId_idx`(`driverId`),
    INDEX `DriverDocument_status_idx`(`status`),
    INDEX `DriverDocument_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign key constraint
ALTER TABLE `DriverDocument` ADD CONSTRAINT `DriverDocument_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
