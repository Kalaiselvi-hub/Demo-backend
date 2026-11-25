const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// REGISTER
exports.register = async (req, res) => {
    try {
        const { emailAddress, password, directLine, hospitalCentre, location } = req.body;

        if (!emailAddress || !password || !directLine || !hospitalCentre || !location) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const existingUser = await User.findOne({ emailAddress });

        if (existingUser) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        // Save user
        const user = await User.create({
            emailAddress,
            password,
            directLine,
            hospitalCentre,
            location
        });

        res.status(201).json({
            message: "Registration successful",
            user: {
                emailAddress: user.emailAddress,
                password: user.password,
                directLine: user.directLine,
                hospitalCentre: user.hospitalCentre,
                location: user.location
            }
        });

    } catch (error) {
        res.status(500).json({
            message: "Registration failed",
            error: error.message
        });
    }
};


// LOGIN
exports.login = async (req, res) => {
    try {
        const { emailAddress, password } = req.body;

        if (!emailAddress || !password) {
            return res.status(400).json({
                message: "emailAddress and password required"
            });
        }

        // Find user
        const user = await User.findOne({
            emailAddress: emailAddress.toLowerCase().trim(),
            password: password.trim()
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid emailAddress or password"
            });
        }

        // Generate JWT
        const token = jwt.sign(
            {
                emailAddress: user.emailAddress
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "1d"
            }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                emailAddress: user.emailAddress,
                password: user.password,
                directLine: user.directLine,
                hospitalCentre: user.hospitalCentre,
                location: user.location
            }
        });

    } catch (error) {
        res.status(500).json({
            message: "Login failed",
            error: error.message
        });
    }
};
