import React, { useEffect, useRef } from "react";
import type { UINotification } from "../store.js";

interface ExtensionUINotificationsProps {
  notifications: UINotification[];
  onDismiss: (id: string) => void;
}

const NotificationItem: React.FC<{
  notification: UINotification;
  onDismiss: (id: string) => void;
}> = ({ notification, onDismiss }) => {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismissRef.current(notification.id);
    }, 8000);
    return () => clearTimeout(timer);
  }, [notification.id]);

  return (
    <div className={`extension-ui-notification ${notification.type}`}>
      <span className="extension-ui-notification-message">
        {notification.message}
      </span>
      <button
        className="extension-ui-notification-dismiss"
        onClick={() => onDismiss(notification.id)}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
};

export const ExtensionUINotifications: React.FC<ExtensionUINotificationsProps> = ({
  notifications,
  onDismiss,
}) => {
  if (notifications.length === 0) return null;

  const recentNotifications = notifications.slice(-5);

  return (
    <div className="extension-ui-notifications">
      {recentNotifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};
