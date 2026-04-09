'use client';

import { useNotifications } from '@/context/notification-context';

export function NotificationSettings() {
  const { settings, updateSettings, requestDesktopPermission } = useNotifications();

  const handleDesktopToggle = async () => {
    if (!settings.desktopEnabled) {
      // Request permission if enabling
      const permission = await requestDesktopPermission();
      if (permission !== 'granted') {
        // Permission denied, don't enable
        return;
      }
    }
    updateSettings({ desktopEnabled: !settings.desktopEnabled });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Notification Preferences
        </h3>
        <div className="space-y-4">
          {/* Toast Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <label
                htmlFor="toast-notifications"
                className="text-sm font-medium text-gray-900 dark:text-white"
              >
                In-App Notifications
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Show popup notifications within the app
              </p>
            </div>
            <button
              id="toast-notifications"
              type="button"
              role="switch"
              aria-checked={settings.toastEnabled}
              onClick={() => updateSettings({ toastEnabled: !settings.toastEnabled })}
              className={`
                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2
                ${settings.toastEnabled ? 'bg-lime-500' : 'bg-gray-200 dark:bg-gray-700'}
              `}
            >
              <span
                className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                  transition duration-200 ease-in-out
                  ${settings.toastEnabled ? 'translate-x-5' : 'translate-x-0'}
                `}
              />
            </button>
          </div>

          {/* Sound Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <label
                htmlFor="sound-notifications"
                className="text-sm font-medium text-gray-900 dark:text-white"
              >
                Sound Alerts
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Play a sound when new notifications arrive
              </p>
            </div>
            <button
              id="sound-notifications"
              type="button"
              role="switch"
              aria-checked={settings.soundEnabled}
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              className={`
                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2
                ${settings.soundEnabled ? 'bg-lime-500' : 'bg-gray-200 dark:bg-gray-700'}
              `}
            >
              <span
                className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                  transition duration-200 ease-in-out
                  ${settings.soundEnabled ? 'translate-x-5' : 'translate-x-0'}
                `}
              />
            </button>
          </div>

          {/* Desktop Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <label
                htmlFor="desktop-notifications"
                className="text-sm font-medium text-gray-900 dark:text-white"
              >
                Desktop Notifications
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Show notifications even when the app is in background
              </p>
            </div>
            <button
              id="desktop-notifications"
              type="button"
              role="switch"
              aria-checked={settings.desktopEnabled}
              onClick={handleDesktopToggle}
              className={`
                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2
                ${settings.desktopEnabled ? 'bg-lime-500' : 'bg-gray-200 dark:bg-gray-700'}
              `}
            >
              <span
                className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                  transition duration-200 ease-in-out
                  ${settings.desktopEnabled ? 'translate-x-5' : 'translate-x-0'}
                `}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Info Note */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Desktop notifications require browser permission. You may need to allow notifications
              in your browser settings if the prompt doesn&apos;t appear.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
