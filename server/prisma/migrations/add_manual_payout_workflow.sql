-- Add PENDING_MANUAL_REVIEW status to PayoutStatus enum
ALTER TABLE `Payout` MODIFY COLUMN `status` ENUM('PENDING', 'PENDING_MANUAL_REVIEW', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING';

-- Add idempotencyKey column
ALTER TABLE `Payout` ADD COLUMN `idempotencyKey` VARCHAR(191) NULL UNIQUE;

-- Add index on idempotencyKey
CREATE INDEX `Payout_idempotencyKey_idx` ON `Payout`(`idempotencyKey`);

-- Update existing PENDING payouts to PENDING_MANUAL_REVIEW
UPDATE `Payout` SET `status` = 'PENDING_MANUAL_REVIEW' WHERE `status` = 'PENDING';
