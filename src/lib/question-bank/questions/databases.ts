import type { DrillQuestion } from "../categories";

/**
 * SQL, the relational model, and where data actually lives.
 *
 * Prep sources converge hard here: ACID, keys, normalization to 3NF, joins,
 * indexes, and DELETE/TRUNCATE/DROP cover the large majority of fresher DBMS
 * questions, so those are all present rather than sampled.
 */
export const DATABASE_QUESTIONS: DrillQuestion[] = [
  {
    id: "db-1",
    category: "databases",
    prompt:
      "Explain the difference between an INNER JOIN and a LEFT JOIN, with a case where the choice changes the answer.",
  },
  {
    id: "db-2",
    category: "databases",
    prompt: "What's the difference between WHERE and HAVING?",
  },
  {
    id: "db-3",
    category: "databases",
    prompt:
      "Explain normalization up to third normal form. When would you deliberately denormalize?",
  },
  {
    id: "db-4",
    category: "databases",
    prompt:
      "What does an index actually do? When does adding one make things worse?",
  },
  {
    id: "db-5",
    category: "databases",
    prompt:
      "Explain ACID. Which of the four is hardest to keep in a distributed system?",
  },
  {
    id: "db-6",
    category: "databases",
    prompt:
      "What's the difference between a primary key and a unique constraint?",
  },
  {
    id: "db-7",
    category: "databases",
    prompt: "Explain the difference between DELETE, TRUNCATE and DROP.",
  },
  {
    id: "db-8",
    category: "databases",
    prompt:
      "What is a transaction isolation level? Talk me through a dirty read.",
  },
  {
    id: "db-9",
    category: "databases",
    prompt:
      "Explain what a deadlock looks like in a database, and how you'd avoid one.",
  },
  {
    id: "db-10",
    category: "databases",
    prompt:
      "When would you choose NoSQL over a relational database? Be specific about what you're giving up.",
  },
  {
    id: "db-11",
    category: "databases",
    prompt: "Explain sharding and partitioning. What breaks once you shard?",
  },
  {
    id: "db-12",
    category: "databases",
    prompt:
      "What is the CAP theorem, and what does it actually force you to choose between?",
  },
  {
    id: "db-13",
    category: "databases",
    prompt:
      "Explain replication. What's the difference between synchronous and asynchronous, and what does each cost?",
  },
  {
    id: "db-14",
    category: "databases",
    prompt: "A query is slow. Walk me through how you'd find out why.",
  },
  {
    id: "db-15",
    category: "databases",
    prompt: "Explain the N+1 query problem and how you'd fix it.",
  },
  {
    id: "db-16",
    category: "databases",
    prompt: "What's a foreign key for, beyond documentation?",
  },
  {
    id: "db-17",
    category: "databases",
    prompt:
      "Explain a window function and something it makes easy that GROUP BY makes hard.",
  },
  {
    id: "db-18",
    category: "databases",
    prompt:
      "What's the difference between a B-tree index and an LSM tree, and which workload suits each?",
  },
  {
    id: "db-19",
    category: "databases",
    prompt:
      "How would you design the schema for a system where users can follow each other?",
  },
  {
    id: "db-20",
    category: "databases",
    prompt:
      "When would you add a cache in front of your database, and what problem does that create?",
  },
];
