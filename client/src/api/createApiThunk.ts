import { createAsyncThunk } from '@reduxjs/toolkit';
import type { AxiosResponse } from 'axios';
import { toApiError, type NormalisedApiError } from './httpClient';

/**
 * Every slice needs the same try/catch/rejectWithValue wrapper. Building the
 * thunk here means each one declares its real return and argument types, which
 * is what lets `action.payload` and the store selectors infer correctly all the
 * way to the components.
 */
export function createApiThunk<Returned, Arg = void>(
  type: string,
  call: (arg: Arg) => Promise<AxiosResponse<Returned>>,
) {
  return createAsyncThunk<Returned, Arg, { rejectValue: NormalisedApiError }>(type, async (arg, { rejectWithValue }) => {
    try {
      const { data } = await call(arg);
      return data;
    } catch (err) {
      return rejectWithValue(toApiError(err));
    }
  });
}

export type { NormalisedApiError };
