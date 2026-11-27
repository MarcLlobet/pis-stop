import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'pis-stop:install-hint-dismissed';

/** Chrome's own event, not in the standard DOM types: only the part we use. */
interface BeforeInstallPromptEvent extends Event {
  readonly prompt: () => Promise<void>;
}

export type InstallPlatform = 'ios' | 'other';

export interface InstallPromptState {
  /** `false` when running as the installed app, or once dismissed on this device. */
  readonly show: boolean;
  /** The browser just finished installing the app: time to leave this tab for it. */
  readonly installed: boolean;
  readonly platform: InstallPlatform;
  /** Triggers the native install dialog directly; `null` where none is offered (e.g. iOS). */
  readonly install: (() => void) | null;
  readonly dismiss: () => void;
}

const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { readonly standalone?: boolean }).standalone === true;

const isIos = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Per-device UI preference only, never read back by anything else. */
const wasDismissed = (): boolean => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

const rememberDismissed = (): void => {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Private browsing or storage disabled: it will just ask again next time.
  }
};

/**
 * Whether, and how, to suggest installing the app: a one-tap native prompt
 * where the browser offers one (deferred until the user acts on it, per the
 * `beforeinstallprompt` contract), otherwise left to the caller to show
 * platform-appropriate instructions instead.
 */
export const useInstallPrompt = (): InstallPromptState => {
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [standalone] = useState(isStandalone);
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return {
    show: installed || (!standalone && !dismissed),
    installed,
    platform: isIos() ? 'ios' : 'other',
    install:
      deferred === null
        ? null
        : () => {
            // Nothing else to do here: `appinstalled` follows if they accept.
            void deferred.prompt();
            setDeferred(null);
          },
    dismiss: () => {
      rememberDismissed();
      setDismissed(true);
      setInstalled(false);
    },
  };
};
