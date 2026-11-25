import { Alert, Linking } from "react-native";

export async function openExternalLink(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Could Not Open Link", `Open ${url} in your browser.`);
  }
}
