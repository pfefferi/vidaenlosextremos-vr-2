import { createXRStore } from '@react-three/xr';

export const xrStore = createXRStore({
  controller: true,
  hand: true,
  gaze: false,
  transientPointer: true,
});
