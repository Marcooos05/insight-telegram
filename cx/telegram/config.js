const config = {
  isPreRegistration: true,
  date: "24 Feb", // For testing purposes, change to current date when actual deployment
  openHouseDate: "2025-02-22T00:00:00+08:00",
  testDate: "2025-01-21T00:00:00+08:00",
  backendURL: "https://insight-oh25-back.com",
  unregisteredStatus: ["Not Found", "Deleted", "Created"],
  postEventBoolean: new Date() > new Date("2025-02-24T10:00:00+08:00"), //set to true after event 24 Feb 10am TODO schedule follow up message at 10am
  surveyLink: "https://mock-survey.com",
};

module.exports = config;
