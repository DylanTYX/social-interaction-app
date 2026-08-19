import type { DrillQuestion } from "../categories";

/**
 * Processes, memory, scheduling, concurrency, deadlock.
 *
 * Also absorbs the computer-architecture questions that get asked in practice —
 * caches and the memory hierarchy — rather than giving architecture a topic of
 * its own, because that is the slice of it interviewers reach for.
 */
export const OS_QUESTIONS: DrillQuestion[] = [
  {
    id: "os-1",
    category: "operating_systems",
    prompt: "What's actually different between a process and a thread?",
  },
  {
    id: "os-2",
    category: "operating_systems",
    prompt:
      "Explain what happens during a context switch, and why it isn't free.",
  },
  {
    id: "os-3",
    category: "operating_systems",
    prompt:
      "What is virtual memory, and what problem was it invented to solve?",
  },
  {
    id: "os-4",
    category: "operating_systems",
    prompt: "Explain paging versus segmentation.",
  },
  {
    id: "os-5",
    category: "operating_systems",
    prompt: "What happens on a page fault? Walk me through it.",
  },
  {
    id: "os-6",
    category: "operating_systems",
    prompt: "What is the TLB, and what happens when you miss it?",
  },
  {
    id: "os-7",
    category: "operating_systems",
    prompt: "Explain the four conditions required for deadlock.",
  },
  {
    id: "os-8",
    category: "operating_systems",
    prompt:
      "What's the difference between deadlock prevention, avoidance and detection? Which do real systems use?",
  },
  {
    id: "os-9",
    category: "operating_systems",
    prompt: "Explain the difference between a mutex and a semaphore.",
  },
  {
    id: "os-10",
    category: "operating_systems",
    prompt: "What is a critical section, and what goes wrong without one?",
  },
  {
    id: "os-11",
    category: "operating_systems",
    prompt:
      "Explain a race condition, and how you'd reproduce one deliberately.",
  },
  {
    id: "os-12",
    category: "operating_systems",
    prompt:
      "Compare round-robin and shortest-job-first scheduling. What is each optimising for?",
  },
  {
    id: "os-13",
    category: "operating_systems",
    prompt: "What is starvation, and how does a scheduler avoid it?",
  },
  {
    id: "os-14",
    category: "operating_systems",
    prompt: "Explain the difference between user space and kernel space.",
  },
  {
    id: "os-15",
    category: "operating_systems",
    prompt:
      "What is a system call? Walk me through what happens when you call one.",
  },
  {
    id: "os-16",
    category: "operating_systems",
    prompt:
      "Explain how the CPU cache hierarchy affects the code you write. Give me a concrete example.",
  },
  {
    id: "os-17",
    category: "operating_systems",
    prompt:
      "What's the difference between the stack and the heap from the operating system's point of view?",
  },
  {
    id: "os-18",
    category: "operating_systems",
    prompt:
      "Explain inter-process communication. What options do you have, and what does each cost?",
  },
  {
    id: "os-19",
    category: "operating_systems",
    prompt:
      "What is an inode, and what does it store that the filename doesn't?",
  },
  {
    id: "os-20",
    category: "operating_systems",
    prompt: "Your program is slow and the CPU is idle. What do you suspect?",
  },
];
