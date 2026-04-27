import React from "react";
import type { BlurViewProps } from "expo-blur/build/BlurView.types";

declare module "expo-blur" {
  class BlurView extends React.Component<BlurViewProps, unknown> {
    render(): React.JSX.Element;
  }
}
