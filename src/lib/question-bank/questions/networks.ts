import type { DrillQuestion } from "../categories";

/**
 * The wire, and everything layered on it.
 *
 * The URL-to-browser question lived under `technical_swe` and was always a
 * networking question; it moves here, where the rubric matches what it asks
 * for.
 */
export const NETWORK_QUESTIONS: DrillQuestion[] = [
  {
    id: "net-1",
    category: "networks",
    prompt:
      "What happens, end to end, when you type a URL into a browser and hit enter?",
  },
  {
    id: "net-2",
    category: "networks",
    prompt: "Explain TCP versus UDP, and give me a real case for each.",
  },
  {
    id: "net-3",
    category: "networks",
    prompt:
      "Walk me through the TCP three-way handshake. What is each message for?",
  },
  {
    id: "net-4",
    category: "networks",
    prompt:
      "Explain the OSI model. Which layers do you actually touch as a developer?",
  },
  {
    id: "net-5",
    category: "networks",
    prompt:
      "How does DNS resolution work? Talk me through a lookup that isn't cached.",
  },
  {
    id: "net-6",
    category: "networks",
    prompt:
      "What's the difference between HTTP and HTTPS? What exactly does the S add?",
  },
  {
    id: "net-7",
    category: "networks",
    prompt:
      "Explain the difference between GET, POST and PUT, and what idempotent means here.",
  },
  {
    id: "net-8",
    category: "networks",
    prompt:
      "What's the difference between a 401 and a 403? And between a 301 and a 302?",
  },
  {
    id: "net-9",
    category: "networks",
    prompt:
      "Explain cookies versus sessions versus tokens for keeping a user logged in.",
  },
  {
    id: "net-10",
    category: "networks",
    prompt: "What makes an API RESTful? Is that actually worth caring about?",
  },
  {
    id: "net-11",
    category: "networks",
    prompt: "When would you use WebSockets over normal HTTP requests?",
  },
  {
    id: "net-12",
    category: "networks",
    prompt:
      "Explain TCP congestion control at a high level. What is it protecting?",
  },
  {
    id: "net-13",
    category: "networks",
    prompt:
      "What's the difference between flow control and congestion control?",
  },
  {
    id: "net-14",
    category: "networks",
    prompt:
      "Explain what a load balancer does, and two ways it might choose a server.",
  },
  {
    id: "net-15",
    category: "networks",
    prompt: "What is ARP for, and where does it sit relative to IP?",
  },
  {
    id: "net-16",
    category: "networks",
    prompt: "Explain what a subnet mask does.",
  },
  {
    id: "net-17",
    category: "networks",
    prompt:
      "What is latency versus bandwidth, and which one does adding a CDN fix?",
  },
  {
    id: "net-18",
    category: "networks",
    prompt:
      "A request works from your machine but not from the server. How do you narrow it down?",
  },
  {
    id: "net-19",
    category: "networks",
    prompt: "Explain what a port is, and what it means for one to be 'open'.",
  },
  {
    id: "net-20",
    category: "networks",
    prompt:
      "What does HTTP/2 change compared to HTTP/1.1, and why did that matter?",
  },
];
