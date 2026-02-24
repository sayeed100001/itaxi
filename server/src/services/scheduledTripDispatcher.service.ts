import cron from 'node-cron';
import logger from '../config/logger';
import { getIo } from '../config/socket';
import { TripService } from './trip.service';

const tripService = new TripService();

export const startScheduledTripDispatcher = () => {
  cron.schedule('*/1 * * * *', async () => {
    try {
      const io = getIo();
      const dispatched = await tripService.processDueScheduledTrips(io);
      if (dispatched > 0) {
        logger.info('Scheduled trip dispatcher ran', { dispatched });
      }
    } catch (error) {
      logger.error('Scheduled trip dispatcher failed', { error });
    }
  });

  logger.info('Scheduled trip dispatcher started (every 1 minute)');
};
