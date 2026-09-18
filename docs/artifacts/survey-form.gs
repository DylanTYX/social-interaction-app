/**
 * Builds the scope survey described in docs/SURVEY.md as a Google Form.
 *
 * Paste into script.google.com (New project), save, run `createScopeSurvey`,
 * grant the permissions it asks for, then read the two URLs from the log.
 *
 * Everything the form needs is here: questions, grids, scales, sections,
 * settings, and the consent gate on Q1. Change the wording here rather than in
 * the form, so the instrument in the report and the one people answered stay
 * the same document.
 */

const TITLE = "Which job interviews do you actually face?";

const INTRO = [
  "This short survey asks which kinds of job interview you face and which parts you find hardest.",
  "",
  "It takes about four minutes and is anonymous: no name, no email, no student number.",
  "Answers are used in aggregate in a final-year project report on interview practice software.",
  "You may stop at any time.",
].join("\n");

/** The six round types the system practises, in plain words. */
const ROUNDS = [
  "Recruiter screen (background and motivation)",
  'Behavioural questions ("tell me about a time…")',
  "HR and people questions (values, notice, salary)",
  "Technical coding questions",
  "System design questions",
  "Computer science fundamentals (explain a concept)",
];

/** The fifteen drill topics, collapsed to what a student would recognise. */
const TOPICS = [
  "Data structures and algorithms",
  "Programming languages",
  "Testing and debugging",
  "Object-oriented design",
  "Databases and SQL",
  "Operating systems",
  "Computer networks",
  "Security",
  "System design",
  "AI and machine learning",
  "Cloud and DevOps",
  "Web and front-end",
  "None of these, my interviews are not technical",
];

function createScopeSurvey() {
  const form = FormApp.create(TITLE);
  form
    .setDescription(INTRO)
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false)
    .setProgressBar(true)
    .setShuffleQuestions(false)
    .setConfirmationMessage(
      "Thank you. Your answers are anonymous and will be reported only as totals.",
    );

  // --- Consent -------------------------------------------------------------
  // A "No" must end the form rather than collect the rest of the answers, so
  // the two choices navigate to different pages.
  const consent = form.addMultipleChoiceItem().setTitle("Do you agree to take part?").setRequired(true);

  const aboutYou = form.addPageBreakItem().setTitle("About you");

  consent.setChoices([
    consent.createChoice("Yes, I agree", aboutYou),
    consent.createChoice("No, I would rather not", FormApp.PageNavigationType.SUBMIT),
  ]);

  // --- About you -----------------------------------------------------------
  form
    .addMultipleChoiceItem()
    .setTitle("Which faculty or school are you in?")
    .setChoiceValues([
      "Computing / Computer Science / IT",
      "Engineering",
      "Business",
      "Science",
      "Arts and Social Sciences",
      "Design or Media",
      "Medicine or Health Sciences",
    ])
    .showOtherOption(true)
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle("Year of study")
    .setChoiceValues([
      "Year 1",
      "Year 2",
      "Year 3",
      "Year 4 or above",
      "Postgraduate",
      "Graduated in the last year",
    ])
    .setRequired(true);

  form
    .addCheckboxItem()
    .setTitle("Which kinds of role are you applying for, or planning to?")
    .setChoiceValues([
      "Software engineering",
      "Data, AI or machine learning",
      "Product management",
      "Consulting",
      "Finance or accounting",
      "Design",
      "Research or academia",
      "Marketing, HR or operations",
      "Not sure yet",
    ])
    .showOtherOption(true);

  form
    .addMultipleChoiceItem()
    .setTitle("How many job or internship interviews have you had in the past 12 months?")
    .setChoiceValues(["None", "1–2", "3–5", "6 or more"])
    .setRequired(true);

  // --- Rounds --------------------------------------------------------------
  form.addPageBreakItem().setTitle("Kinds of interview round");

  form
    .addGridItem()
    .setTitle("How relevant is each kind of round to the roles you are applying for?")
    .setRows(ROUNDS)
    .setColumns(["Not relevant", "Slightly", "Moderately", "Very", "Essential"])
    .setRequired(true);

  form
    .addGridItem()
    .setTitle("How difficult do you find each one?")
    .setRows(ROUNDS)
    .setColumns([
      "Have not faced it",
      "Not difficult",
      "Slightly",
      "Moderately",
      "Very difficult",
    ])
    .setRequired(true);

  form
    .addCheckboxItem()
    .setTitle("Which would you most want to practise? Choose up to three.")
    .setChoiceValues(ROUNDS.concat(["None of these"]))
    .setValidation(
      FormApp.createCheckboxValidation().requireSelectAtMost(3).build(),
    );

  // --- Topics --------------------------------------------------------------
  form.addPageBreakItem().setTitle("Technical topics");

  form
    .addCheckboxItem()
    .setTitle(
      "Which technical topics have come up in your interviews, or do you expect them to? Choose any.",
    )
    .setChoiceValues(TOPICS);

  // --- Practice today ------------------------------------------------------
  form.addPageBreakItem().setTitle("How you practise now");

  form
    .addCheckboxItem()
    .setTitle("How do you prepare for interviews today? Choose any.")
    .setChoiceValues([
      "Reading question lists or guides",
      "Coding practice sites",
      "Mock interview with a friend",
      "University career service",
      "Paid coaching",
      "Asking an AI chatbot to role-play",
      "Recording myself",
      "I do not prepare",
    ])
    .showOtherOption(true);

  form
    .addScaleItem()
    .setTitle("How useful is your current preparation?")
    .setBounds(1, 5)
    .setLabels("Not useful at all", "Very useful")
    .setRequired(true);

  form
    .addCheckboxItem()
    .setTitle("What is missing from how you practise now? Choose any.")
    .setChoiceValues([
      "Follow-up questions that react to what I said",
      "Feedback on what I said",
      "Feedback on how I sounded",
      "Realistic pressure",
      "Questions tied to a specific job description",
      "Practising several rounds in one sitting",
      "Knowing what to work on next",
      "Nothing is missing",
    ])
    .showOtherOption(true);

  form
    .addMultipleChoiceItem()
    .setTitle("If you practised with software, would you rather speak your answers or type them?")
    .setChoiceValues(["Speak them", "Type them", "Depends on the round", "No preference"])
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle(
      "Would practising several rounds back to back — screen, then technical, then hiring manager — be useful to you?",
    )
    .setChoiceValues(["Yes", "No", "Unsure"])
    .setRequired(true);

  // --- Free text -----------------------------------------------------------
  form.addPageBreakItem().setTitle("In your words");

  form
    .addParagraphTextItem()
    .setTitle("What is the hardest part of interviews for you?")
    .setRequired(true);

  form
    .addParagraphTextItem()
    .setTitle("Anything else you would want practice software to do?");

  Logger.log("Edit:  %s", form.getEditUrl());
  Logger.log("Share: %s", form.getPublishedUrl());
  return form.getPublishedUrl();
}
