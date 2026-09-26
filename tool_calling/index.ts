import express from "express";
import cors from "cors";
import chatRouter from "./src/routes/chat.route.ts";
import customerRouter from "./src/routes/customer.route.ts";
import orderRouter from "./src/routes/order.route.ts";
import weatherRouter from "./src/routes/weather.route.ts";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/chat", chatRouter);
app.use("/api/customers", customerRouter);
app.use("/api/orders", orderRouter);
app.use("/api/weather", weatherRouter);
app.get("/", (req, res) => {
    res.send("Agentic App Backend is running!");
});

// Start the server
const PORT = process.env.PORT || 4200;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
