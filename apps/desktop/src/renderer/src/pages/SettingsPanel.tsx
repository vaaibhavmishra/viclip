import { type User, useGlobalStore } from "@renderer/components/global-context";
import type { DeviceData } from "@viclip/types";
import {
  Bell,
  Keyboard,
  Laptop,
  LogOut,
  Mail,
  RefreshCw,
  Smartphone,
  Tablet,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

// --- Sub-components ---

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  children,
}) => (
  <div className="p-2 space-y-1">
    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
      {title}
    </h3>
    {children}
  </div>
);

interface ToggleButtonProps {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}

const ToggleButton: React.FC<ToggleButtonProps> = ({
  enabled,
  onChange,
  disabled,
}) => (
  <button
    type="button"
    onClick={onChange}
    disabled={disabled}
    role="switch"
    aria-checked={enabled}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      enabled ? "bg-blue-500 dark:bg-blue-600" : "bg-gray-200 dark:bg-gray-600"
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        enabled ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

interface UserProfileProps {
  user: User | null;
  onSignOut: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onSignOut }) => {
  const [failedPhotoURL, setFailedPhotoURL] = useState<string | null>(null);
  const photoURL = user?.photoURL?.trim();

  if (!user) return null;

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-gray-700/50">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 shrink-0 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
          {photoURL && photoURL !== failedPhotoURL ? (
            <img
              src={photoURL}
              alt={user.displayName || "User"}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setFailedPhotoURL(photoURL)}
            />
          ) : (
            getInitials(user.displayName)
          )}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {user.displayName || "User"}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {user.email}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
        title="Sign Out"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  );
};

interface ExtendedDeviceData extends DeviceData {
  firebaseKey: string;
}

interface DeviceItemProps {
  device: ExtendedDeviceData;
  isCurrentDevice: boolean;
  onRemove: (deviceKey: string) => void;
}

const DeviceItem: React.FC<DeviceItemProps> = ({
  device,
  isCurrentDevice,
  onRemove,
}) => {
  const getDeviceIcon = (platform?: string) => {
    const p = (platform || "").toLowerCase();
    if (p.includes("mobile") || p.includes("android") || p.includes("ios"))
      return Smartphone;
    if (p.includes("tablet") || p.includes("ipad")) return Tablet;
    return Laptop;
  };

  const Icon = getDeviceIcon(device.platform);

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/50">
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {device.deviceName || "Unknown Device"}
            </span>
            {isCurrentDevice && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30 rounded">
                This Device
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last active:{" "}
            {device.lastActive
              ? new Date(device.lastActive).toLocaleDateString()
              : "Unknown"}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <div
          className={`w-2 h-2 rounded-full ${isCurrentDevice ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
        />
        {!isCurrentDevice && (
          <button
            type="button"
            onClick={() => onRemove(device.firebaseKey || device.id)}
            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            title="Logout device"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

interface ShortcutRecorderProps {
  currentShortcut: string;
  onSave: (shortcut: string) => void;
  disabled?: boolean;
}

const ShortcutRecorder: React.FC<ShortcutRecorderProps> = ({
  currentShortcut,
  onSave,
  disabled,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [keys, setKeys] = useState<string[]>([]);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const key = e.key;
      // Ignore isolated modifier keys press (wait for combination)
      if (
        ["Control", "Shift", "Alt", "Meta", "Command"].includes(key) &&
        !keys.includes(key)
      ) {
        // Just add to display, don't finalize
      }

      // Build safe electron accelerator string
      const modifiers: string[] = [];
      if (e.metaKey || e.ctrlKey) modifiers.push("CommandOrControl");
      if (e.altKey) modifiers.push("Alt");
      if (e.shiftKey) modifiers.push("Shift");

      let mainKey = e.code.replace("Key", "").replace("Digit", "");
      if (mainKey.startsWith("Arrow")) mainKey = mainKey.replace("Arrow", "");

      // If just modifiers, don't save yet
      if (
        ["Control", "Shift", "Alt", "Meta", "Command"].some((k) =>
          e.key.includes(k),
        )
      ) {
        setKeys([...modifiers]);
        return;
      }

      const shortcut = [...modifiers, mainKey].join("+");
      setKeys([...modifiers, mainKey]);

      // Save logic could be here or on key up, but key down is usually fine for shortcuts
      onSave(shortcut);
      setIsRecording(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording, onSave, keys]);

  const displayShortcut = isRecording
    ? keys.join(" + ") || "Type shortcut..."
    : currentShortcut.replace("CommandOrControl", "Cmd/Ctrl");

  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-gray-700/50">
      <div className="flex items-center space-x-3">
        <Keyboard className="w-5 h-5 text-blue-500 dark:text-blue-400" />
        <div className="flex flex-col">
          <span className="text-gray-900 dark:text-gray-100 font-medium">
            Global Shortcut
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Click to record new shortcut
          </span>
        </div>
      </div>
      <button
        type="button"
        ref={ref}
        disabled={disabled}
        onClick={() => {
          setIsRecording(true);
          setKeys([]);
        }}
        className={`px-3 py-1.5 min-w-[100px] text-sm font-medium rounded-lg border transition-all ${
          isRecording
            ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
            : "border-gray-200 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500"
        }`}
      >
        {displayShortcut}
      </button>
    </div>
  );
};

// --- Main Component ---

export const SettingsPanel: React.FC = () => {
  const { user } = useGlobalStore();
  const navigate = useNavigate();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [devices, setDevices] = useState<ExtendedDeviceData[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");
  const [shortcut, setShortcut] = useState("CommandOrControl+Shift+V");
  const [appVersion, setAppVersion] = useState<string>("");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [reload, setReload] = useState(0);
  const busy = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const syncRevision = useRef(0);
  const latestReload = useRef(reload);
  latestReload.current = reload;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const expectedUserId = user?.uid;
    const requestedReload = reload;
    const revision = ++generation.current;
    let isMounted = true;
    let receivedSyncState = false;
    const unsubscribeSync = window.api.onSyncStateChanged((active) => {
      if (isMounted && generation.current === revision) {
        receivedSyncState = true;
        syncRevision.current++;
        setSyncEnabled(active);
      }
    });

    const loadSettings = async () => {
      if (!isMounted) return;
      try {
        setLoading(true);
        setError("");
        const [isSync, isNotif, deviceList, devId, storedShortcut, version] =
          await Promise.all([
            window.api.getSyncState(),
            window.api.getNotificationsEnabled(),
            window.api.getDevices(),
            window.api.getDeviceId(),
            window.api.getShortcut(),
            window.api.getAppVersion(),
          ]);
        if (
          !isMounted ||
          generation.current !== revision ||
          requestedReload !== latestReload.current ||
          useGlobalStore.getState().user?.uid !== expectedUserId
        )
          return;
        if (!receivedSyncState) setSyncEnabled(isSync);
        setNotificationsEnabled(isNotif);
        setCurrentDeviceId(devId);
        setShortcut(storedShortcut);
        setAppVersion(version);
        // Convert Record to Array and sort by lastActive
        setDevices(
          Object.entries(deviceList || {})
            .map(([key, value]) => ({ ...value, firebaseKey: key }))
            .sort(
              (a, b) =>
                new Date(b.lastActive).getTime() -
                new Date(a.lastActive).getTime(),
            ),
        );
      } catch {
        if (isMounted)
          setError("Unable to load settings. Check your connection and retry.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void loadSettings();
    return () => {
      isMounted = false;
      generation.current++;
      unsubscribeSync();
    };
  }, [reload, user?.uid]);

  const performAction = async (action: () => Promise<void>): Promise<void> => {
    if (busy.current) return;
    const revision = generation.current;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await action();
    } catch {
      if (generation.current === revision)
        setError(
          "Unable to save this change. Check your connection and retry.",
        );
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  };
  const onSignOut = () =>
    performAction(async () => {
      const revision = generation.current;
      await window.api.signOutUser();
      if (generation.current === revision) navigate("/auth");
    });
  const onNotificationsChange = () =>
    performAction(async () => {
      const revision = generation.current;
      const actual = await window.api.toggleNotifications(
        !notificationsEnabled,
      );
      if (generation.current === revision) setNotificationsEnabled(actual);
    });
  const onSyncChange = () =>
    performAction(async () => {
      const revision = generation.current;
      const currentSyncRevision = syncRevision.current;
      const actual = await window.api.toggleClipboardSync(!syncEnabled);
      if (
        generation.current === revision &&
        syncRevision.current === currentSyncRevision
      )
        setSyncEnabled(actual);
    });
  const onShortcutChange = (newShortcut: string) =>
    performAction(async () => {
      const revision = generation.current;
      const registered = await window.api.setShortcut(newShortcut);
      if (!registered) throw new Error("Shortcut unavailable.");
      if (generation.current === revision) setShortcut(newShortcut);
    });
  const handleRemoveDevice = async (deviceKey: string) => {
    if (
      busy.current ||
      !confirm("Are you sure you want to logout this device?")
    )
      return;
    await performAction(async () => {
      const revision = generation.current;
      await window.api.removeDevice(deviceKey);
      // We need to reload devices to reflect changes
      const deviceList = await window.api.getDevices();
      if (generation.current === revision)
        setDevices(
          Object.entries(deviceList || {})
            .map(([key, value]) => ({ ...value, firebaseKey: key }))
            .sort(
              (a, b) =>
                new Date(b.lastActive).getTime() -
                new Date(a.lastActive).getTime(),
            ),
        );
    });
  };
  const handleCheckUpdates = () =>
    performAction(async () => {
      setCheckingUpdate(true);
      try {
        await window.api.checkForUpdates();
      } finally {
        if (mounted.current) setCheckingUpdate(false);
      }
    });

  return (
    <div className="px-2 py-8 h-full overflow-y-auto">
      {error && (
        <div role="alert" className="p-3 text-sm text-red-500">
          {error}{" "}
          <button
            type="button"
            disabled={pending}
            onClick={() => setReload((value) => value + 1)}
          >
            Reload settings
          </button>
        </div>
      )}
      <fieldset disabled={pending} className="space-y-2">
        {/* User Profile */}
        <SettingsSection title="Account">
          {user ? (
            <UserProfile key={user?.uid} user={user} onSignOut={onSignOut} />
          ) : (
            <div className="p-4 rounded-xl bg-gray-100 dark:bg-gray-700/50 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Not logged in
              </p>
            </div>
          )}
        </SettingsSection>
      </fieldset>
      {loading && (
        <div role="status" className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          <span className="sr-only">Loading settings...</span>
        </div>
      )}
      <fieldset
        disabled={loading || pending || Boolean(error)}
        hidden={loading}
        className="space-y-2"
      >
        {/* Sync Settings */}
        <SettingsSection title="Sync">
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-gray-700/50">
            <div className="flex items-center space-x-3">
              <RefreshCw
                className={`w-5 h-5 text-blue-500 dark:text-blue-400 ${syncEnabled ? "animate-spin-slow" : ""}`}
              />
              <div className="flex flex-col">
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  Clipboard Sync
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Sync clips across all your devices
                </span>
              </div>
            </div>
            <ToggleButton
              enabled={syncEnabled}
              onChange={onSyncChange}
              disabled={pending}
            />
          </div>
        </SettingsSection>

        {/* Shortcut Settings */}
        <SettingsSection title="Shortcuts">
          <ShortcutRecorder
            currentShortcut={shortcut}
            onSave={onShortcutChange}
            disabled={pending}
          />
        </SettingsSection>

        {/* Devices List */}
        <SettingsSection title={`Devices (${devices.length})`}>
          <div className="space-y-2">
            {devices.length > 0 ? (
              devices.map((device) => (
                <DeviceItem
                  key={device.firebaseKey || device.id}
                  device={device}
                  isCurrentDevice={
                    device.firebaseKey === currentDeviceId ||
                    device.id === currentDeviceId
                  }
                  onRemove={handleRemoveDevice}
                />
              ))
            ) : (
              <div className="text-center p-4 text-gray-500 rounded-xl bg-gray-100 dark:bg-gray-700/50">
                <span className="text-sm">No devices found</span>
              </div>
            )}
          </div>
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Notifications">
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-gray-700/50">
            <div className="flex items-center space-x-3">
              <Bell className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              <div className="flex flex-col">
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  Enable Notifications
                </span>
              </div>
            </div>
            <ToggleButton
              enabled={notificationsEnabled}
              onChange={onNotificationsChange}
              disabled={pending}
            />
          </div>
        </SettingsSection>

        {/* Support */}
        <SettingsSection title="Support">
          <a
            href="mailto:mishravaibhav12321@gmail.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              <span className="text-gray-700 dark:text-gray-300">
                Send Feedback
              </span>
            </div>
          </a>
        </SettingsSection>

        {/* About & Updates */}
        <SettingsSection title="About & Updates">
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-gray-700/50">
            <div className="flex items-center space-x-3">
              <div className="flex flex-col">
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  ViClip {appVersion ? `v${appVersion}` : ""}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Update via DMG or Homebrew
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCheckUpdates}
              disabled={checkingUpdate}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {checkingUpdate ? "Checking..." : "Check for Updates"}
            </button>
          </div>
        </SettingsSection>
      </fieldset>
    </div>
  );
};
