const config = {
  isPreRegistration: true,
  date: "24 Feb", // For testing purposes, change to current date when actual deployment
  openHouseDate: "2025-02-22T00:00:00+08:00",
  testDate: "2025-01-21T00:00:00+08:00",
  backendURL: "https://insight-oh25-back.com",
  unregisteredStatus: ["Not Found", "Deleted", "Created"],
  postEvent: new Date() > new Date("2025-02-24T00:00:00+08:00"),
};

module.exports = config;
