"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  ChevronRight,
  BellOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Job {
  id: string;
  job_type: string;
  status: string;
  progress: number;
  current_stage?: string;
  error_message?: string;
  result_data?: any;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface JobStatistics {
  total_jobs: number;
  recent_jobs_24h: number;
  unread_completed: number;
  status_breakdown: Record<string, number>;
}

interface JobsResponse {
  jobs: Job[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  statistics: JobStatistics;
}

const statusConfig = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
  processing: {
    label: "Processing",
    icon: Loader2,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
};

export default function JobsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { markAllAsRead, markJobAsRead, refreshUnreadCount, unreadCount } =
    useNotifications();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statistics, setStatistics] = useState<JobStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

      const url = new URL(`${backendUrl}/api/v1/jobs/my-jobs`);
      if (statusFilter !== "all") {
        url.searchParams.append("status", statusFilter);
      }

      const response = await fetch(url.toString(), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch jobs");
      }

      const data: JobsResponse = await response.json();
      setJobs(data.jobs);
      setStatistics(data.statistics);
      refreshUnreadCount();
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Failed to load jobs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchJobs();
    }
  }, [isAuthenticated, authLoading, statusFilter]);

  const handleClearNotifications = async () => {
    setIsClearing(true);
    try {
      await markAllAsRead();
      toast.success("All notifications cleared");
    } catch (error) {
      console.error("Error clearing notifications:", error);
      toast.error("Failed to clear notifications");
    } finally {
      setIsClearing(false);
    }
  };

  const handleJobClick = async (job: Job) => {
    if (job.status === "completed" || job.status === "failed") {
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
        const response = await fetch(
          `${backendUrl}/api/v1/jobs/my-jobs/${job.id}`,
          {
            credentials: "include",
          }
        );

        if (response.ok) {
          const data = await response.json();
          setSelectedJob(data.job);
          // Mark job as read when clicked
          await markJobAsRead(job.id);
        }
      } catch (error) {
        console.error("Error fetching job details:", error);
        toast.error("Failed to load job details");
      }
    }
  };

  const handleApproveInvoice = async (taskId: string) => {
    setIsApproving(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const response = await fetch(
        `${backendUrl}/api/v1/invoices/approve/${taskId}`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success("Invoice approved and saved successfully!");

        // Update the selected job with the returned job data from backend
        if (data.job) {
          setSelectedJob(data.job);
        }

        // Refresh the jobs list
        await fetchJobs();
      } else if (response.status === 409) {
        // Handle duplicate detection
        const data = await response.json();
        toast.warning(
          data.message ||
            "This invoice is a duplicate and was not inserted into the database."
        );

        // Update the selected job with the returned job data from backend
        if (data.job) {
          setSelectedJob(data.job);
        }

        // Refresh the jobs list to show updated status
        await fetchJobs();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to approve invoice");
      }
    } catch (error) {
      console.error("Error approving invoice:", error);
      toast.error("Failed to approve invoice");
    } finally {
      setIsApproving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-foreground">Please sign in to view jobs</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Briefcase className="h-8 w-8" />
              Processing Jobs
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your invoice processing jobs
            </p>
          </div>
        </div>

        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                Total Jobs
              </h3>
              <p className="text-2xl font-bold text-foreground">
                {statistics.total_jobs}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                Completed
              </h3>
              <p className="text-2xl font-bold text-green-600">
                {statistics.status_breakdown.completed || 0}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                Processing
              </h3>
              <p className="text-2xl font-bold text-blue-600">
                {statistics.status_breakdown.processing || 0}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                Failed
              </h3>
              <p className="text-2xl font-bold text-red-600">
                {statistics.status_breakdown.failed || 0}
              </p>
            </div>
          </div>
        )}

        {/* Filter and Actions */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2 flex-wrap">
              {[
                "all",
                "pending",
                "processing",
                "completed",
                "failed",
                "review_needed",
              ].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    statusFilter === status
                      ? "bg-foreground text-background"
                      : "bg-card border border-border text-foreground hover:bg-accent"
                  )}
                >
                  {status === "all"
                    ? "All"
                    : status === "review_needed"
                      ? "Review Needed"
                      : statusConfig[status as keyof typeof statusConfig]
                          ?.label}
                </button>
              ))}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleClearNotifications}
                disabled={isClearing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-card border border-border text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClearing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BellOff className="h-4 w-4" />
                )}
                Clear All Notifications
                {!isClearing && (
                  <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-foreground font-medium">No jobs found</p>
              <p className="text-muted-foreground text-sm mt-1">
                {statusFilter === "review_needed"
                  ? "No jobs requiring review"
                  : statusFilter !== "all"
                    ? `No ${statusFilter} jobs`
                    : "Upload some invoices to get started"}
              </p>
            </div>
          ) : (
            jobs.map((job) => {
              const config =
                statusConfig[job.status as keyof typeof statusConfig];
              const StatusIcon = config?.icon || Clock;

              return (
                <div
                  key={job.id}
                  onClick={() => handleJobClick(job)}
                  className={cn(
                    "bg-card border rounded-lg p-4 transition-all",
                    config?.borderColor || "border-border",
                    (job.status === "completed" || job.status === "failed") &&
                      "cursor-pointer hover:shadow-md"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div
                        className={cn(
                          "p-3 rounded-lg",
                          config?.bgColor || "bg-gray-50"
                        )}
                      >
                        <StatusIcon
                          className={cn(
                            "h-6 w-6",
                            config?.color || "text-gray-600",
                            job.status === "processing" && "animate-spin"
                          )}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">
                            {job.job_type || "Invoice Processing"}
                          </h3>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-medium",
                              config?.bgColor,
                              config?.color
                            )}
                          >
                            {config?.label || job.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {job.current_stage ||
                            `Created ${new Date(job.created_at).toLocaleString()}`}
                        </p>
                        {job.error_message && (
                          <p className="text-sm text-red-600 mt-1">
                            {job.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {job.status === "processing" && (
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">
                            {job.progress}%
                          </p>
                          <div className="w-32 h-2 bg-gray-200 rounded-full mt-1">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {(job.status === "completed" ||
                        job.status === "failed") && (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Job Details Modal */}
        {selectedJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black bg-opacity-50"
              onClick={() => setSelectedJob(null)}
            />
            <div className="relative bg-card border border-border rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Job Details
                </h2>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Status
                  </h3>
                  <p className="text-foreground mt-1">
                    {statusConfig[
                      selectedJob.status as keyof typeof statusConfig
                    ]?.label || selectedJob.status}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Job Type
                  </h3>
                  <p className="text-foreground mt-1">{selectedJob.job_type}</p>
                </div>
                {selectedJob.completed_at && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Completed At
                    </h3>
                    <p className="text-foreground mt-1">
                      {new Date(selectedJob.completed_at).toLocaleString()}
                    </p>
                  </div>
                )}
                {selectedJob.result_data && (
                  <>
                    {/* Auto-save Status */}
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Save Status
                      </h3>
                      <div className="mt-1">
                        {selectedJob.result_data.auto_saved ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Saved to database</span>
                            {selectedJob.result_data.invoice_id && (
                              <span className="text-sm text-muted-foreground">
                                (ID:{" "}
                                {selectedJob.result_data.invoice_id.slice(0, 8)}
                                ...)
                              </span>
                            )}
                          </div>
                        ) : selectedJob.result_data.duplicate_detected ||
                          selectedJob.result_data.db_insert_skipped ? (
                          <div className="flex items-center gap-2 text-orange-600">
                            <XCircle className="h-4 w-4" />
                            <span>Not Saved - Duplicate Entry</span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-yellow-600">
                              <XCircle className="h-4 w-4" />
                              <span>Pending Approval</span>
                            </div>
                            {selectedJob.status === "completed" &&
                              selectedJob.result_data.extraction_result
                                ?.success && (
                                <button
                                  onClick={() =>
                                    handleApproveInvoice(selectedJob.id)
                                  }
                                  disabled={isApproving}
                                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isApproving ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      <span>Approving...</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-4 w-4" />
                                      <span>Approve & Save to Database</span>
                                    </>
                                  )}
                                </button>
                              )}
                          </div>
                        )}
                        {selectedJob.result_data.save_skip_reason && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedJob.result_data.save_skip_reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Duplicate Detection */}
                    {selectedJob.result_data.duplicate_detected && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <h3 className="text-sm font-medium text-yellow-800 mb-1">
                          Duplicate Detected
                        </h3>
                        <p className="text-sm text-yellow-700">
                          {selectedJob.result_data.save_skip_reason ||
                            "This invoice number already exists in the system"}
                        </p>
                      </div>
                    )}

                    {/* Review Required */}
                    {selectedJob.result_data.requires_review && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <h3 className="text-sm font-medium text-blue-800 mb-1">
                          Review Required
                        </h3>
                        <p className="text-sm text-blue-700">
                          This invoice requires human review due to low
                          confidence or validation errors.
                        </p>
                        {selectedJob.result_data.validation_errors &&
                          selectedJob.result_data.validation_errors.length >
                            0 && (
                            <ul className="mt-2 text-sm text-blue-700 list-disc list-inside">
                              {selectedJob.result_data.validation_errors.map(
                                (error: string, idx: number) => (
                                  <li key={idx}>{error}</li>
                                )
                              )}
                            </ul>
                          )}
                      </div>
                    )}

                    {/* Confidence Score */}
                    {selectedJob.result_data.confidence_score !== undefined && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">
                          Confidence Score
                        </h3>
                        <p className="text-foreground mt-1">
                          {(
                            selectedJob.result_data.confidence_score * 100
                          ).toFixed(0)}
                          %
                        </p>
                      </div>
                    )}

                    {/* Full Results (Collapsible) */}
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        Full Results
                      </h3>
                      <pre className="bg-background border border-border rounded-lg p-4 overflow-auto max-h-96 text-sm text-foreground">
                        {JSON.stringify(selectedJob.result_data, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
                {selectedJob.error_message && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Error
                    </h3>
                    <p className="text-red-600 mt-1">
                      {selectedJob.error_message}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
