import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../api';

export const fetchAnalytics = createAsyncThunk(
  'analytics/fetchAnalytics',
  async () => {
    return await api.getAnalytics();
  }
);

const initialState = {
  loading: false,
  error: null,
  data: null
};

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnalytics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnalytics.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchAnalytics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error?.message || '加载失败';
      });
  }
});

export default analyticsSlice.reducer;

