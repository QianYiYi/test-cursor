import { configureStore } from '@reduxjs/toolkit';
import bookingsReducer from './store/bookingsSlice';
import analyticsReducer from './store/analyticsSlice';

export const store = configureStore({
  reducer: {
    bookings: bookingsReducer,
    analytics: analyticsReducer
  }
});

