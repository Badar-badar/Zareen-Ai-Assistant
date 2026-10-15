// Fake, test-only values. No real keys are ever used in tests.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.JWT_ISSUER = "zareena-api";
process.env.JWT_AUDIENCE = "zareena-client";
process.env.JWT_TTL = "1h";
process.env.GOOGLE_API_KEY = "fake-key-for-tests";
process.env.ALLOWED_ORIGINS = "http://localhost:5173";