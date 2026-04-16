import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OS } from "@/types/download";

interface InstallationInstructionProps {
  step: number;
  title: string;
  description: string;
}

interface PlatformInstructionsProps {
  win: InstallationInstructionProps[];
  mac: InstallationInstructionProps[];
  linux: InstallationInstructionProps[];
  android: InstallationInstructionProps[];
  ios: InstallationInstructionProps[];
}

const installationInstructions: PlatformInstructionsProps = {
  win: [
    {
      step: 1,
      title: "Download the installer",
      description:
        "Click the download button above to get the Windows installer (.exe file). The download should start automatically.",
    },
    {
      step: 2,
      title: "Run the installer",
      description:
        "Double-click the downloaded .exe file. If Windows Defender SmartScreen appears, click 'More info' then 'Run anyway'.",
    },
    {
      step: 3,
      title: "Launch ViClip",
      description:
        "Open ViClip from the Start menu or desktop shortcut. The app will appear in your system tray for quick access.",
    },
    {
      step: 4,
      title: "Set up your account",
      description:
        "Sign in to enable clipboard syncing across all your devices.",
    },
    {
      step: 5,
      title: "Start syncing",
      description:
        "Copy and paste across devices seamlessly. ViClip runs in the background, automatically syncing your clipboard data.",
    },
  ],
  mac: [
    {
      step: 1,
      title: "Download the DMG file",
      description:
        "Click the download button to get the macOS installer (.dmg file). Wait for the download to complete.",
    },
    {
      step: 2,
      title: "Open and mount the DMG",
      description:
        "Double-click the downloaded DMG file to mount the disk image. A new window will open.",
    },
    {
      step: 3,
      title: "Install ViClip",
      description:
        "Drag the ViClip app icon to the Applications folder shortcut in the window. Wait for the copy to complete.",
    },
    {
      step: 4,
      title: "Launch the application",
      description:
        "Open ViClip from Launchpad or Applications folder. If prompted, go to System Preferences > Security & Privacy > General and click 'Open Anyway'.",
    },
    {
      step: 5,
      title: "Grant permissions",
      description:
        "Allow push notifications and accessibility permissions for optimal clipboard syncing and monitoring.",
    },
    {
      step: 6,
      title: "Sign in and sync",
      description:
        "Sign in to your account to enable cross-device synchronization. The app will now run in your menu bar, ready to sync clipboard data.",
    },
  ],
  linux: [
    {
      step: 1,
      title: "Download AppImage",
      description:
        "Click the download button to get the Linux AppImage file. This portable format works across all major distributions.",
    },
    {
      step: 2,
      title: "Make file executable",
      description:
        "Open terminal in the download directory and run: chmod +x ViClip-*.AppImage to make the file executable.",
    },
    {
      step: 3,
      title: "Install dependencies",
      description:
        "Ensure you have libfuse installed. On Ubuntu/Debian: sudo apt install libfuse2. On Fedora: sudo dnf install fuse.",
    },
    {
      step: 4,
      title: "Install system tray support",
      description:
        "For GNOME users, install 'AppIndicator and KStatusNotifierItem Support' extension from GNOME Extensions for proper system tray functionality.",
    },
    {
      step: 5,
      title: "Launch ViClip",
      description:
        "Double-click the AppImage file or run from terminal: ./ViClip-*.AppImage. The app will start and appear in your system tray.",
    },
    {
      step: 6,
      title: "Sign in and configure",
      description:
        "Sign in to your ViClip account to enable clipboard syncing across devices. Grant any requested permissions for clipboard access.",
    },
    {
      step: 7,
      title: "Optional: Create desktop entry",
      description:
        "For easier access, right-click the AppImage and select 'Integrate and run' or use tools like AppImageLauncher for desktop integration.",
    },
  ],
  android: [
    {
      step: 1,
      title: "Download the APK",
      description:
        "Tap the download button to get the Android APK file. The file will be saved to your Downloads folder.",
    },
    {
      step: 2,
      title: "Enable unknown sources",
      description:
        "Go to Settings > Security > Install unknown apps. Find your browser (e.g., Chrome) and toggle 'Allow from this source'.",
    },
    {
      step: 3,
      title: "Install the application",
      description:
        "Open Downloads, tap the ViClip APK file, then tap 'Install'. Wait for the installation to complete.",
    },
    {
      step: 4,
      title: "Sign in to your account",
      description:
        "Create an account or sign in to enable cross-device clipboard syncing.",
    },
    {
      step: 5,
      title: "Send content to other devices",
      description:
        "Method 1: Use the share menu in any app to send text/links to ViClip. Method 2: Copy text, open ViClip, and tap the Send button.",
    },
    {
      step: 6,
      title: "Receive content from other devices",
      description:
        "Open ViClip and tap Receive or pull down to refresh. Tap any synced clip to copy it to your clipboard.",
    },
  ],
  ios: [
    {
      step: 1,
      title: "Download from App Store",
      description:
        "Search for 'ViClip' in the App Store or use the direct link above. Ensure you're downloading the official app by checking the developer name.",
    },
    {
      step: 2,
      title: "Install the application",
      description:
        "Tap 'Get' to download and install ViClip. Authenticate with Face ID, Touch ID, or your Apple ID password.",
    },
    {
      step: 3,
      title: "Grant permissions",
      description:
        "Allow push notifications when prompted to receive alerts for synced clipboard content from other devices.",
    },
    {
      step: 4,
      title: "Sign in to your account",
      description:
        "Create an account or sign in to enable cross-device clipboard syncing functionality.",
    },
    {
      step: 5,
      title: "Send content to other devices",
      description:
        "Method 1: Use the share sheet in any app to send text/links to ViClip. Method 2: Copy text, open ViClip, and tap the Send button.",
    },
    {
      step: 6,
      title: "Receive content from other devices",
      description:
        "Open ViClip and tap Receive or pull down to refresh. Tap any synced clip to copy it to your clipboard for use in other apps.",
    },
  ],
};

export function InstallationInstructions({ os }: { os: OS }) {
  return (
    <Card className="border border-blue-500/20 bg-muted/5">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        viewport={{ once: true }}
      >
        <CardHeader className="border-b border-blue-500/20 p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">
            Installation Instructions
          </CardTitle>
        </CardHeader>
      </motion.div>
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-4">
          {installationInstructions[os].map((instruction, index) => (
            <motion.div
              key={instruction.title}
              className="flex items-start space-x-3"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.3,
                delay: 0.2 + index * 0.1,
              }}
              viewport={{ once: true }}
            >
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                {instruction.step}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {instruction.title}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {instruction.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
