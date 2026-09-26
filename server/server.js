import express from "express";
import cors from "cors";
import chatRouter from "./src/ChatRouter.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/chat", chatRouter);
app.use("/api/gemini", chatRouter);

app.get("/", (req, res) => {
    res.send("Hello World");
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
