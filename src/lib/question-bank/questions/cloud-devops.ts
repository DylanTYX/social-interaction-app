import type { DrillQuestion } from "../categories";

/**
 * Cloud and operations, at the level a new graduate is actually asked.
 *
 * Absorbs Linux, containers, Kubernetes, infrastructure-as-code and SRE from
 * the research into one topic — in an interview these arrive as one
 * conversation, not five.
 */
export const CLOUD_DEVOPS_QUESTIONS: DrillQuestion[] = [
  {
    id: "cloud-1",
    category: "cloud_devops",
    prompt: "Explain IaaS, PaaS and SaaS with an example of each.",
  },
  {
    id: "cloud-2",
    category: "cloud_devops",
    prompt: "What's the difference between a virtual machine and a container?",
  },
  {
    id: "cloud-3",
    category: "cloud_devops",
    prompt: "Explain what a Docker image is versus a container.",
  },
  {
    id: "cloud-4",
    category: "cloud_devops",
    prompt:
      "What does Kubernetes actually do for you? What problem were people solving before it?",
  },
  {
    id: "cloud-5",
    category: "cloud_devops",
    prompt: "Explain the difference between a pod, a deployment and a service.",
  },
  {
    id: "cloud-6",
    category: "cloud_devops",
    prompt:
      "What is horizontal versus vertical scaling, and which does the cloud make easy?",
  },
  {
    id: "cloud-7",
    category: "cloud_devops",
    prompt:
      "Explain what a region and an availability zone are, and why you'd spread across them.",
  },
  {
    id: "cloud-8",
    category: "cloud_devops",
    prompt:
      "What goes into a CI/CD pipeline? Where would you put the slow tests?",
  },
  {
    id: "cloud-9",
    category: "cloud_devops",
    prompt:
      "Explain blue-green versus canary deployment, and when each is worth the complexity.",
  },
  {
    id: "cloud-10",
    category: "cloud_devops",
    prompt:
      "What is infrastructure as code, and what does it buy you over clicking in a console?",
  },
  {
    id: "cloud-11",
    category: "cloud_devops",
    prompt:
      "Explain the difference between logs, metrics and traces. What question does each answer?",
  },
  {
    id: "cloud-12",
    category: "cloud_devops",
    prompt: "What is an SLI, an SLO and an SLA? Who is each one for?",
  },
  {
    id: "cloud-13",
    category: "cloud_devops",
    prompt: "Explain what serverless means, and what you give up by using it.",
  },
  {
    id: "cloud-14",
    category: "cloud_devops",
    prompt: "How would you handle secrets in a deployed application?",
  },
  {
    id: "cloud-15",
    category: "cloud_devops",
    prompt: "Explain object storage versus block storage, and what each suits.",
  },
  {
    id: "cloud-16",
    category: "cloud_devops",
    prompt:
      "A deployment made things worse. Walk me through what you do in the first five minutes.",
  },
  {
    id: "cloud-17",
    category: "cloud_devops",
    prompt:
      "What Linux commands would you reach for to work out why a server is slow?",
  },
  {
    id: "cloud-18",
    category: "cloud_devops",
    prompt:
      "Explain what a reverse proxy does and why you'd put one in front of your app.",
  },
  {
    id: "cloud-19",
    category: "cloud_devops",
    prompt: "How would you keep cloud costs from surprising you?",
  },
  {
    id: "cloud-20",
    category: "cloud_devops",
    prompt:
      "What does a good on-call alert look like, and what makes a bad one?",
  },
];
