import type { TypedUseSelectorHook } from 'react-redux';
import type { AppDispatch, RootState } from '../app/store';

/** Shorthand for a thunk that can be dispatched directly. */
export type AppThunk<ReturnType = void> = (
  dispatch: AppDispatch,
  getState: () => RootState,
) => ReturnType | Promise<ReturnType>;

export type { AppDispatch, RootState, TypedUseSelectorHook };
