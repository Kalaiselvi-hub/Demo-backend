const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || "mongodb+srv://selvikalai0315_db_user:Puvaneshwari2008@puvaneshwari.usesw4s.mongodb.net/naira_hospital";
        await mongoose.connect(uri, {
            dbName: process.env.DB_NAME || 'naira_hospital'
        });

        console.log("MongoDB Connected Successfully!");
    } catch (error) {
        console.error("MongoDB Connection Failed:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
