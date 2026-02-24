CREATE TABLE `CorporateCompany` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `contactEmail` VARCHAR(191) NULL,
  `contactPhone` VARCHAR(191) NULL,
  `address` VARCHAR(191) NULL,
  `walletBalance` DOUBLE NOT NULL DEFAULT 0,
  `status` ENUM('ACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `createdByUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CorporateCompany_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CorporateMember` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `role` ENUM('COMPANY_ADMIN', 'COMPANY_MANAGER', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CorporateMember_companyId_userId_key`(`companyId`, `userId`),
  INDEX `CorporateMember_userId_role_idx`(`userId`, `role`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CorporatePolicy` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `maxFarePerRide` DOUBLE NULL,
  `maxRidesPerDay` INTEGER NULL,
  `allowedServiceTypes` JSON NULL,
  `allowedServiceClasses` JSON NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `CorporatePolicy_companyId_active_idx`(`companyId`, `active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CorporateTrip` (
  `id` VARCHAR(191) NOT NULL,
  `tripId` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `employeeUserId` VARCHAR(191) NOT NULL,
  `authorizedByUserId` VARCHAR(191) NULL,
  `purpose` VARCHAR(191) NULL,
  `costCenter` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CorporateTrip_tripId_key`(`tripId`),
  INDEX `CorporateTrip_companyId_createdAt_idx`(`companyId`, `createdAt`),
  INDEX `CorporateTrip_employeeUserId_idx`(`employeeUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CorporateInvoice` (
  `id` VARCHAR(191) NOT NULL,
  `companyId` VARCHAR(191) NOT NULL,
  `periodStart` DATETIME(3) NOT NULL,
  `periodEnd` DATETIME(3) NOT NULL,
  `totalAmount` DOUBLE NOT NULL,
  `status` ENUM('DRAFT', 'ISSUED', 'PAID', 'VOID') NOT NULL DEFAULT 'DRAFT',
  `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `dueAt` DATETIME(3) NULL,
  `paidAt` DATETIME(3) NULL,
  `details` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `CorporateInvoice_companyId_issuedAt_idx`(`companyId`, `issuedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LoyaltyProfile` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `points` INTEGER NOT NULL DEFAULT 0,
  `lifetimePoints` INTEGER NOT NULL DEFAULT 0,
  `tier` ENUM('BRONZE', 'SILVER', 'GOLD', 'PLATINUM') NOT NULL DEFAULT 'BRONZE',
  `referralCode` VARCHAR(191) NOT NULL,
  `referredByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `LoyaltyProfile_userId_key`(`userId`),
  UNIQUE INDEX `LoyaltyProfile_referralCode_key`(`referralCode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LoyaltyPointTransaction` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `tripId` VARCHAR(191) NULL,
  `type` ENUM('EARNED', 'REDEEMED', 'BONUS', 'REFERRAL_BONUS') NOT NULL,
  `pointsDelta` INTEGER NOT NULL,
  `balanceAfter` INTEGER NOT NULL,
  `reason` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `LoyaltyPointTransaction_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `LoyaltyPointTransaction_tripId_idx`(`tripId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Referral` (
  `id` VARCHAR(191) NOT NULL,
  `referrerUserId` VARCHAR(191) NOT NULL,
  `refereeUserId` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
  `rewardPoints` INTEGER NOT NULL DEFAULT 100,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  UNIQUE INDEX `Referral_referrerUserId_refereeUserId_key`(`referrerUserId`, `refereeUserId`),
  UNIQUE INDEX `Referral_refereeUserId_key`(`refereeUserId`),
  INDEX `Referral_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CorporateCompany`
  ADD CONSTRAINT `CorporateCompany_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CorporateMember`
  ADD CONSTRAINT `CorporateMember_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `CorporateCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CorporateMember_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CorporateMember_createdByUserId_fkey`
  FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CorporatePolicy`
  ADD CONSTRAINT `CorporatePolicy_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `CorporateCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CorporateTrip`
  ADD CONSTRAINT `CorporateTrip_tripId_fkey`
  FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CorporateTrip_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `CorporateCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CorporateTrip_employeeUserId_fkey`
  FOREIGN KEY (`employeeUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CorporateTrip_authorizedByUserId_fkey`
  FOREIGN KEY (`authorizedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CorporateInvoice`
  ADD CONSTRAINT `CorporateInvoice_companyId_fkey`
  FOREIGN KEY (`companyId`) REFERENCES `CorporateCompany`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LoyaltyProfile`
  ADD CONSTRAINT `LoyaltyProfile_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LoyaltyProfile_referredByUserId_fkey`
  FOREIGN KEY (`referredByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `LoyaltyPointTransaction`
  ADD CONSTRAINT `LoyaltyPointTransaction_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `LoyaltyPointTransaction_tripId_fkey`
  FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Referral`
  ADD CONSTRAINT `Referral_referrerUserId_fkey`
  FOREIGN KEY (`referrerUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Referral_refereeUserId_fkey`
  FOREIGN KEY (`refereeUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
