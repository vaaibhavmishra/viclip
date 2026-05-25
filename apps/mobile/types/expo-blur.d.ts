import type { BlurViewProps } from "expo-blur/build/BlurView.types";
import React from "react";

declare module "expo-blur" {
  class BlurView extends React.Component<BlurViewProps, unknown> {
    render(): React.JSX.Element;
  }
}
