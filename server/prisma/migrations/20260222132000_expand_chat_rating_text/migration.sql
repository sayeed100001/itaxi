ALTER TABLE `TripMessage`
  MODIFY `body` TEXT NOT NULL,
  MODIFY `deliveryError` TEXT NULL;

ALTER TABLE `TripRating`
  MODIFY `comment` TEXT NULL;
