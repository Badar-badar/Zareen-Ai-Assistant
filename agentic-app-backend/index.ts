import { connectDB } from "./src/config/mongodb.js";
import { createApp } from "./src/app.js";
import ChatSession from "./src/models/chatSession.model.js";
import User from "./src/models/user.model.js";
import PendingAction from "./src/models/pendingAction.model.js";
import { initOtel } from "./src/obs/otel.js";
import TraceModel from "./src/models/trace.model.js";
initOtel();
const app = createApp();

const PORT = Number(process.env.PORT) || 4200;
const HOST = process.env.HOST ?? "127.0.0.1";

async function startServer() {
  try {
    await connectDB();
    await Promise.all([ChatSession.init(), User.init(), PendingAction.init()]);
    app.listen(PORT, HOST, () => {
      console.log(`Server is running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.log("Error starting the server", error);
    process.exit(1);
  }
}

startServer();