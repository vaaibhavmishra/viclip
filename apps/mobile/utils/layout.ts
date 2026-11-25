import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Keep screen content and floating navigation inside the current safe window. */
export function useResponsiveLayout() {
  const { width, height, fontScale = 1 } = useWindowDimensions();
  const modalInsets = useSafeAreaInsets();
  const availableWidth = Math.max(
    0,
    width - modalInsets.left - modalInsets.right,
  );
  const horizontalPadding = availableWidth < 360 ? 12 : 20;
  const contentWidth = Math.min(
    840,
    Math.max(0, availableWidth - horizontalPadding * 2),
  );
  const contentMargin = (availableWidth - contentWidth) / 2;
  const tabBarWidth = Math.min(contentWidth, 480);
  const tabBarMargin = (availableWidth - tabBarWidth) / 2;
  const tabBarBottom = modalInsets.bottom + 12;
  const tabBarHeight = Math.ceil(50 + 14 * fontScale);

  return {
    width,
    height,
    fontScale,
    isCompact: contentWidth / fontScale < 360,
    horizontalPadding,
    contentWidth,
    modalInsets,
    tabBarBottom,
    tabBarHeight,
    tabBarStyle: {
      left: modalInsets.left + tabBarMargin,
      right: modalInsets.right + tabBarMargin,
      bottom: tabBarBottom,
      height: tabBarHeight,
    },
    contentContainerStyle: {
      flexGrow: 1,
      paddingTop: 16,
      paddingBottom: tabBarBottom + tabBarHeight + 16,
      paddingLeft: modalInsets.left + contentMargin,
      paddingRight: modalInsets.right + contentMargin,
    },
  };
}
