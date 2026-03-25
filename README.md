# EchoRouth – AI Text, URL & Real-Time News Summarizer

EchoRouth is an AI-powered summarization platform that allows users to summarize text, articles, and URLs, and also get real-time news summaries by simply typing a topic (for example: AI, Technology, Startups, Sports). The platform extracts important information and generates short, easy-to-read summaries using AI.

The goal of EchoRouth is to help users consume information faster by converting long articles, news, and text into short and meaningful summaries.

---

## Features

* Text Summarization
* URL / Article Summarization
* Real-Time News Summarization (Topic-based)
* AI-generated Short Summaries
* Clean and Simple UI
* Fast Processing
* Copy & Download Summary
* User Authentication
* History of Summaries
* Topic-based News Search (Example: "AI", "Space", "Stock Market")

---

## How It Works

EchoRouth uses AI to analyze content and extract the most important points.

1. User enters text or pastes an article URL.
2. The system extracts the content from the URL.
3. The content is sent to the AI model.
4. AI generates a short summary.
5. If the user enters a topic (like "AI"), the system fetches latest news.
6. AI summarizes the latest news and shows it to the user.

---

## Tech Stack

**Frontend**

* React.js
* Tailwind CSS
* Vite

**Backend**

* Node.js
* Express.js

**Database**

* Firebase Firestore

**Authentication**

* Firebase Authentication

**APIs Used**

* Google Gemini API (for summarization)
* News API (for real-time news)
* Article Extractor API (for URL content extraction)

---

## Installation & Setup

### Clone the Repository

```
git clone https://github.com/Hemanthkumar25s/EchoRouth.git
cd EchoRouth
```

### Install Frontend

```
cd client
npm install
npm run dev
```

### Install Backend

```
cd server
npm install
npm start
```

### Environment Variables

Create a `.env` file in the server folder and add:

```
GEMINI_API_KEY=your_api_key
NEWS_API_KEY=your_news_api_key
```

### Firebase Setup

* Create Firebase project
* Enable Authentication
* Enable Firestore Database
* Add Firebase config in:

```
client/src/firebase.ts
```

---

## Example Use Cases

| Input                | Output                       |
| -------------------- | ---------------------------- |
| Paste a long article | Short summary                |
| Paste a blog URL     | Article summary              |
| Type "AI"            | Latest AI news summarized    |
| Type "Tesla"         | Latest Tesla news summarized |
| Paste research paper | Research summary             |

---

## Future Improvements

* Multi-language summarization
* Voice input summarization
* PDF summarization
* YouTube video summarization
* Chrome Extension
* Daily news email summary
* Summary length control (Short / Medium / Detailed)

---

## Author

Hemanth Kumar
GitHub: https://github.com/Hemanthkumar25s

---

## License

This project is licensed under the MIT License.
