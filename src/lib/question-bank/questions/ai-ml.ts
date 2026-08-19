import type { DrillQuestion } from "../categories";

/**
 * The fundamentals layer of AI/ML, and nothing deeper.
 *
 * "Explain overfitting and how it differs from underfitting" is a definition
 * question and fits `cs_fundamentals` exactly. "Design a recommender" is a
 * system-design question and lives there; "derive backpropagation" is a maths
 * question and lives nowhere in this product. The line is drawn at what the
 * rubric can actually mark.
 */
export const AI_ML_QUESTIONS: DrillQuestion[] = [
  {
    id: "ml-1",
    category: "ai_ml",
    prompt:
      "Explain supervised versus unsupervised learning, with a problem for each.",
  },
  {
    id: "ml-2",
    category: "ai_ml",
    prompt:
      "What is overfitting, and how is it different from underfitting? How would you spot each?",
  },
  {
    id: "ml-3",
    category: "ai_ml",
    prompt:
      "Explain the bias-variance tradeoff without using the word tradeoff.",
  },
  {
    id: "ml-4",
    category: "ai_ml",
    prompt:
      "Why do you split data into train, validation and test? What goes wrong with only two of those?",
  },
  {
    id: "ml-5",
    category: "ai_ml",
    prompt: "What is cross-validation, and when is it worth the extra compute?",
  },
  {
    id: "ml-6",
    category: "ai_ml",
    prompt: "Explain data leakage. Give me a way it sneaks into a pipeline.",
  },
  {
    id: "ml-7",
    category: "ai_ml",
    prompt: "When is accuracy a misleading metric? What would you use instead?",
  },
  {
    id: "ml-8",
    category: "ai_ml",
    prompt:
      "Explain precision and recall, and a product where you'd deliberately sacrifice one.",
  },
  {
    id: "ml-9",
    category: "ai_ml",
    prompt: "What does ROC-AUC actually measure? When is it the wrong choice?",
  },
  {
    id: "ml-10",
    category: "ai_ml",
    prompt: "Explain regularization. What is L1 doing that L2 isn't?",
  },
  {
    id: "ml-11",
    category: "ai_ml",
    prompt:
      "Compare logistic regression and a decision tree. When would you pick the simpler model?",
  },
  {
    id: "ml-12",
    category: "ai_ml",
    prompt: "Explain how a random forest improves on a single decision tree.",
  },
  {
    id: "ml-13",
    category: "ai_ml",
    prompt:
      "What is gradient descent doing, and what does the learning rate control?",
  },
  {
    id: "ml-14",
    category: "ai_ml",
    prompt: "Explain what a neural network layer actually computes.",
  },
  {
    id: "ml-15",
    category: "ai_ml",
    prompt:
      "What is an embedding, and why is it more useful than one-hot encoding?",
  },
  {
    id: "ml-16",
    category: "ai_ml",
    prompt:
      "Explain attention at a high level. What problem did it solve for sequence models?",
  },
  {
    id: "ml-17",
    category: "ai_ml",
    prompt:
      "What's the difference between fine-tuning a model and using retrieval-augmented generation? When would you pick each?",
  },
  {
    id: "ml-18",
    category: "ai_ml",
    prompt:
      "Why do language models hallucinate, and what can you actually do about it in a product?",
  },
  {
    id: "ml-19",
    category: "ai_ml",
    prompt:
      "How would you evaluate an LLM feature where there's no single correct answer?",
  },
  {
    id: "ml-20",
    category: "ai_ml",
    prompt:
      "Your model does well offline and badly in production. What do you check first?",
  },
];
