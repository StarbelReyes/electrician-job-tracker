import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

export type JobStatus = "active" | "completed";

export type Job = {
  id: string;
  createdAt: string;
  customerName: string;
  jobAddress: string;
  jobDescription?: string;
  status: JobStatus; // 👈 NEW
};

type JobsContextValue = {
  jobs: Job[];
  addJob: (data: {
    customerName: string;
    jobAddress: string;
    jobDescription?: string;
  }) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  editJob: (
    id: string,
    updates: Partial<
      Pick<Job, "customerName" | "jobAddress" | "jobDescription" | "status">
    >
  ) => Promise<void>;
  toggleJobStatus: (id: string) => Promise<void>;
};

const JobsContext = createContext<JobsContextValue | null>(null);

const STORAGE_KEY = "jobs";

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);

  // Load saved jobs on app start
  useEffect(() => {
    const loadJobs = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setJobs(parsed);
          }
        }
      } catch (e) {
        console.log("Error loading jobs", e);
      }
    };

    loadJobs();
  }, []);

  const persistJobs = async (list: Job[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.log("Error saving jobs", e);
    }
  };

  const addJob = async (data: {
    customerName: string;
    jobAddress: string;
    jobDescription?: string;
  }) => {
    const newJob: Job = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      customerName: data.customerName,
      jobAddress: data.jobAddress,
      jobDescription: data.jobDescription ?? "",
      status: "active", // 👈 default new jobs are active
    };

    const updated = [...jobs, newJob];
    setJobs(updated);
    await persistJobs(updated);
  };

  const deleteJob = async (id: string) => {
    const updated = jobs.filter((job) => job.id !== id);
    setJobs(updated);
    await persistJobs(updated);
  };

  const editJob = async (
    id: string,
    updates: Partial<
      Pick<Job, "customerName" | "jobAddress" | "jobDescription" | "status">
    >
  ) => {
    const updated = jobs.map((job) =>
      job.id === id ? { ...job, ...updates } : job
    );
    setJobs(updated);
    await persistJobs(updated);
  };

 // 🔁 TOGGLE ACTIVE / COMPLETED
const toggleJobStatus = async (id: string) => {
  const updated: Job[] = jobs.map((job: Job) => {
    if (job.id === id) {
      const newStatus: JobStatus =
        job.status === "completed" ? "active" : "completed";

      return {
        ...job,
        status: newStatus,
      };
    }
    return job;
  });

  setJobs(updated);
  await persistJobs(updated);
};``


  return (
    <JobsContext.Provider
      value={{ jobs, addJob, deleteJob, editJob, toggleJobStatus }}
    >
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs() {
  const ctx = useContext(JobsContext);
  if (!ctx) {
    throw new Error("useJobs must be used inside JobsProvider");
  }
  return ctx;
}
