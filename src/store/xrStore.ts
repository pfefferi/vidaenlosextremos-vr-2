import { createXRStore } from '@react-three/xr';

export const xrStore = createXRStore({
  controller: true,
  hand: true,
  gaze: true,
  transientPointer: true,
  domOverlay: false,
  layers: false,
  anchors: false,
  hitTest: false,
  meshDetection: false,
  planeDetection: false,
  depthSensing: false,
  offerSession: false,
  emulate: false,
  foveation: 0,
});
