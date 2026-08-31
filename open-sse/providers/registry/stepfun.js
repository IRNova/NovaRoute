export default {
  id: "stepfun",
  alias: "stepfun",
  hasFree: true,
  display: {
    name: "StepFun",
    icon: "auto_awesome",
    color: "#8B5CF6",
    textIcon: "SF",
    website: "https://stepfun.com",
    notice: {
      text: "This connects to StepFun's China platform (platform.stepfun.com), whose sign-up appears to require a Chinese phone number. Users outside mainland China can instead register at the global StepFun Open Platform (platform.stepfun.ai, operated by Sparkling AI Pte. Ltd., Singapore) with email/Google/Discord login.",
      signupUrl: "https://platform.stepfun.ai",
    },
  },
  category: "apikey",
  authHint: "Get API key at platform.stepfun.com",
  transport: {
    baseUrl: "https://api.stepfun.com/v1/chat/completions",
    authType: "apikey",
    auth: {
      header: "Authorization",
      scheme: "bearer",
      combined: true,
    },
  },
  models: [
    {
      id: "step-3.7-flash",
      name: "Step 3.7 Flash",
      contextLength: 262144,
    },
    {
      id: "step-3.5-flash",
      name: "Step 3.5 Flash",
      contextLength: 262144,
    },
    {
      id: "step-3.5-flash-2603",
      name: "Step 3.5 Flash 2603",
      contextLength: 262144,
    },
    {
      id: "step-1o-turbo-vision",
      name: "Step 1o Turbo Vision",
      contextLength: 32768,
    },
    {
      id: "step-1v",
      name: "Step 1V",
    },
  ],
  passthroughModels: true,
};
