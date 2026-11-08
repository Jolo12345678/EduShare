EDUSHARE - COMPLETE SOURCE CODE

Official Platform: EduShare
Institution: University of the Assumption

Features Included:
- Secure Registration and Login for Students and Teachers
- Argon2id Password Hashing (resistant to GPU cracking)
- Official Gmail SMTP Verification (edushare12@gmail.com, port 465 SSL/TLS)
- AES-256-GCM Authenticated Encryption for sensitive records
- Remember Me persistent cookie sessions (30 days) and standard sessions
- Password Recovery and Reset (expiring in 30 minutes, SHA-256 hashed tokens)
- Interactive Quiz Generator (supports files, text prompt, scan notes, multiple-choice, true/false, mixed)

Files:
- server.js: Node.js Express server with security headers, CORS, rate limiters, session handling
- login.html: Responsive login, registration, and recovery modal interface
- login.css: Styles for login, modals, notifications, and responsive layouts
- auth.js: Client-side authentication controller communicating with backend APIs
- verify.html: Email verification landing page
- reset-password.html: Password reset landing page
- generator.html: Smart Quiz Generator dashboard
- generator.css: Styles for quiz generator
- script.js: Quiz generation engine and assessment grading
- .env.example: Environment variable template
- backend/: Modular backend (routes, services, middleware, database, utilities)
- tests/: Comprehensive test suites for auth, crypto, sessions, and emails

HOW TO RUN LOCALLY:
1. Ensure Node.js (v20+ or v26+) is installed.
2. Configure .env with your Gmail App Password:
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=edushare12@gmail.com
   SMTP_PASS=your_16_char_gmail_app_password
3. Start the server:
   npm start
4. Open http://localhost:3000 in your browser.
