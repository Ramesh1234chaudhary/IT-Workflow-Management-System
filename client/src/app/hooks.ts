import { TypedUseSelectorHook, useDispatch, useSelector, useStore } from 'react-redux';
import { store } from './store';

/** The store's dispatch type: accepts both plain actions and RTK thunks. */
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;
export type RootState = ReturnType<typeof store.getState>;

/** Typed shortcuts so components never import from react-redux directly. */
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export const useAppStore = () => useStore<AppStore>();

export default { useAppDispatch, useAppSelector, useAppStore };