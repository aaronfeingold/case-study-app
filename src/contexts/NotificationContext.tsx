"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useProcessing } from "./ProcessingContext";
import { useAuth } from "./AuthContext";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";

interface NotificationContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markJobAsRead: (jobId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { jobs } = useProcessing();
  const { user } = useAuth();
  const previousJobsRef = useRef<Map<string, any>>(new Map());
  const notificationSocketRef = useRef<Socket | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const response = await fetch(
        `${backendUrl}/api/v1/jobs/my-jobs/unread-count`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Unread count from backend:", data.unread_count);
        setUnreadCount(data.unread_count || 0);
      } else {
        console.error("Failed to fetch unread count:", response.status);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const response = await fetch(
        `${backendUrl}/api/v1/jobs/my-jobs/mark-as-read`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Mark all as read response:", data);
        // Set to 0 immediately for instant UI feedback
        setUnreadCount(0);
        // Also refresh from backend to ensure consistency
        await refreshUnreadCount();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Failed to mark jobs as read:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          url: response.url,
        });
        toast.error(
          `Failed to mark notifications as read: ${errorData.error || errorData.message || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Error marking jobs as read:", error);
    }
  }, [refreshUnreadCount]);

  const markJobAsRead = useCallback(
    async (jobId: string) => {
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        const response = await fetch(
          `${backendUrl}/api/v1/jobs/my-jobs/mark-as-read`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ job_id: jobId }),
          }
        );

        if (response.ok) {
          // Refresh the unread count after marking a job as read
          await refreshUnreadCount();
        }
      } catch (error) {
        console.error("Error marking job as read:", error);
      }
    },
    [refreshUnreadCount]
  );

  // Initial fetch on mount
  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  // Setup WebSocket connection for user notifications
  useEffect(() => {
    if (!user?.id) return;

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

    const socket = io(backendUrl, {
      transports: ["polling", "websocket"],
      reconnection: true,
    });

    socket.on("connect", () => {
      console.log("Notification socket connected");
      // Join user's notification room
      socket.emit("join_user_notifications", { user_id: user.id });
    });

    socket.on("joined_notifications", (data: any) => {
      console.log("Joined notification room:", data.room);
    });

    // Listen for user-specific notifications
    socket.on("user_notification", (data: any) => {
      console.log("Received user notification:", data);

      // The jobs watcher useEffect handles both unread count and toasts
      // This just logs for debugging purposes
    });

    notificationSocketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  // Listen to WebSocket job updates in real-time
  useEffect(() => {
    const previousJobs = previousJobsRef.current;

    jobs.forEach((job, taskId) => {
      const previousJob = previousJobs.get(taskId);

      // Check if job just completed or failed
      if (previousJob && previousJob.status !== job.status) {
        if (job.status === "completed") {
          // Increment unread count immediately
          setUnreadCount((prev) => prev + 1);

          // Show notification toast
          toast.success(`Processing completed for ${job.filename}`, {
            description: "Click the notification bell to view results",
            duration: 5000,
          });
        } else if (job.status === "failed") {
          // Increment unread count for failed jobs too
          setUnreadCount((prev) => prev + 1);

          // Show error notification
          toast.error(`Processing failed for ${job.filename}`, {
            description: job.error || "Check job details for more information",
            duration: 5000,
          });
        }
      }
    });

    // Update the ref with current jobs
    previousJobsRef.current = new Map(jobs);
  }, [jobs]);

  const value: NotificationContextType = {
    unreadCount,
    refreshUnreadCount,
    markAllAsRead,
    markJobAsRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
}
