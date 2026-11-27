const express = require("express"); 
const cors = require("cors"); 
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config(); 
const connectDB = require("./config/db");
connectDB();
const authRoutes = require("./routes/authRoutes");
const crmRoutes = require("./routes/crmRoutes");


const app = express(); 

app.use(cors()); 
app.use(express.json()); 

app.use("/api/auth", authRoutes);
app.use("/api", crmRoutes);

const authMiddleware = require("./middleware/authMiddleware");


app.get("/", (req, res) => { 
    res.send("Node.js Server Running Successfully!"); 
}); 

const PORT = process.env.PORT || 5000; 

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`); 
});