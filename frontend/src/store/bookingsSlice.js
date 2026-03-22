import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../api';

export const fetchBookings = createAsyncThunk(
  'bookings/fetchBookings',
  async (params) => {
    return await api.listBookings(params);
  }
);

export const createBooking = createAsyncThunk(
  'bookings/createBooking',
  async (body) => {
    const r = await api.createBooking(body);
    return r;
  }
);

export const updateBooking = createAsyncThunk(
  'bookings/updateBooking',
  async ({ id, body }) => {
    await api.updateBooking(id, body);
    return { id, body };
  }
);

export const deleteBooking = createAsyncThunk(
  'bookings/deleteBooking',
  async (id) => {
    await api.deleteBooking(id);
    return id;
  }
);

const initialState = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 50,
  loading: false,
  error: null,
  lastQuery: {}
};

const bookingsSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    setLastQuery(state, action) {
      state.lastQuery = action.payload || {};
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBookings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items || [];
        state.total = action.payload.total || 0;
        state.page = action.payload.page || 1;
        state.pageSize = action.payload.pageSize || 50;
      })
      .addCase(fetchBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error?.message || '加载失败';
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.error = action.error?.message || '创建失败';
      })
      .addCase(updateBooking.rejected, (state, action) => {
        state.error = action.error?.message || '更新失败';
      })
      .addCase(deleteBooking.rejected, (state, action) => {
        state.error = action.error?.message || '删除失败';
      });
  }
});

export const { setLastQuery } = bookingsSlice.actions;
export default bookingsSlice.reducer;

