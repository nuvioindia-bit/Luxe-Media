import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Light) => {
  try {
    await Haptics.impact({ style });
  } catch (e) {
    // Fail silently if not on native
  }
};

export const triggerSelectionHaptic = async () => {
  try {
    await Haptics.selectionStart();
  } catch (e) {}
};

export const triggerVibrate = async () => {
  try {
    await Haptics.vibrate();
  } catch (e) {}
};
