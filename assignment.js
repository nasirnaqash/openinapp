const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
require("dotenv").config();

// Load credentials from the file you downloaded from the Developer Console
const credentials = require("./credentials.json");
const TOKEN_PATH = "token.json";

// Create an OAuth2 client
const { client_secret, client_id, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

// Load token from file or get a new one
let token;
try {
  token = fs.readFileSync(TOKEN_PATH);
  oAuth2Client.setCredentials(JSON.parse(token));
} catch (err) {
  getNewToken(oAuth2Client);
}

// Set up Gmail API
const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

// Nodemailer setup (for sending replies)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "nasirrnaqash@gmail.com", // Your Gmail email address
    pass: process.env.GOOGLE_PASSWORD, // Your Gmail password (use an app password for security)
  },
});

// Function to check for new emails and respond
async function checkAndRespond() {
  try {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: "is:inbox is:unread", // Filter for unread emails
    });

    const messages = response.data.messages;
    if (messages && messages.length > 0) {
      const message = messages[0]; // Assuming the first unread email
      const email = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
      });

      const threadId = email.data.threadId;

      // Check if you have replied to this thread
      const replies = await gmail.users.messages.list({
        userId: "me",
        q: `in:inbox thread:${threadId} -from:you`,
      });

      if (!replies.data.messages || replies.data.messages.length === 0) {
        // You haven't replied to this thread, send a reply
        const replyMessage = {
          to: email.data.payload.headers.find(
            (header) => header.name === "From"
          ).value,
          subject:
            "Re: " +
            email.data.payload.headers.find(
              (header) => header.name === "Subject"
            ).value,
          text: "Thank you for your email! This is an automated response.",
        };

        await transporter.sendMail(replyMessage);

        // Add a label to the email
        try {
          // Get the list of labels
          const labelsResponse = await gmail.users.labels.list({
            userId: "me",
          });

          // Find the label with the desired name, e.g., "CustomLabel"
          const customLabel = labelsResponse.data.labels.find(
            (label) => label.name === "CustomLabel"
          );

          if (customLabel) {
            // Add the label to the message
            await gmail.users.messages.modify({
              userId: "me",
              id: message.id,
              resource: {
                addLabelIds: [customLabel.id],
              },
            });

            console.log("Label added successfully.");
          } else {
            console.error("CustomLabel not found.");
          }
        } catch (error) {
          console.error("Error adding label:", error.message);
        }

        console.log("Replied to email and added label.");
      } else {
        console.log("Already replied to this thread.");
      }
    } else {
      console.log("No unread emails.");
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Function to get a new token if it doesn't exist
function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.modify"],
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question("Enter the code from that page here: ", (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error("Error retrieving access token", err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log("Token stored to", TOKEN_PATH);
    });
  });
}

// Set up a loop to repeat the process in random intervals
function runInterval() {
  const interval = Math.floor(Math.random() * (120000 - 45000 + 1)) + 45000; // Random interval between 45 and 120 seconds
  checkAndRespond();
  setTimeout(runInterval, interval);
}

// Start the loop
runInterval();
