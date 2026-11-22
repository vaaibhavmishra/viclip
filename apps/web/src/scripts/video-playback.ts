type DemoVideo = Pick<
  HTMLVideoElement,
  "src" | "paused" | "play" | "pause" | "load"
>;

export function createVideoPlayback(
  video: DemoVideo,
  options: { src: string; reducedMotion: boolean },
) {
  let visible = false;
  let active = true;
  let reducedMotion = options.reducedMotion;
  let intent: "play" | "pause" | null = null;
  let loaded = false;
  let requested = false;
  let disposed = false;
  let requestId = 0;

  function shouldPlay() {
    return (
      !disposed &&
      visible &&
      active &&
      intent !== "pause" &&
      (intent === "play" || !reducedMotion)
    );
  }

  function sync() {
    if (!shouldPlay()) {
      requestId += 1;
      requested = false;
      video.pause();
      return;
    }
    if (requested) return;

    if (!loaded) {
      video.src = options.src;
      video.load();
      loaded = true;
    }

    requested = true;
    const id = ++requestId;
    void video.play().then(
      () => {
        if (!shouldPlay()) video.pause();
      },
      () => {
        // Autoplay may be blocked, or a tab/visibility change may abort play.
        if (id === requestId) requested = false;
      },
    );
  }

  return {
    setVisible(value: boolean) {
      visible = value;
      sync();
    },
    setActive(value: boolean) {
      active = value;
      sync();
    },
    setReducedMotion(value: boolean) {
      reducedMotion = value;
      sync();
    },
    toggle() {
      intent = requested || !video.paused ? "pause" : "play";
      sync();
    },
    dispose() {
      disposed = true;
      sync();
    },
  };
}
