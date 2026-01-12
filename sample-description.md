# Project Overview

This is a comprehensive example showcasing various markdown formatting options for Jira descriptions.

## Features

### Task Management
This section describes the key features of our task management system.

### User Authentication
Secure login and authorization for all users.

## Requirements

Here are the main requirements for this project:

1. User registration and login
2. Dashboard with analytics
3. Real-time notifications
4. Export functionality
5. Mobile responsive design

## Technical Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Frontend | React | 18.2.0 |
| Backend | Node.js | 20.x |
| Database | PostgreSQL | 15.x |
| Cache | Redis | 7.x |

## Checklist

- [x] Set up project repository
- [x] Configure development environment
- [ ] Implement authentication module
- [ ] Create API endpoints
- [ ] Write unit tests
- [ ] Deploy to staging
- [ ] Perform security audit
- [ ] Launch to production

## Important Links

- [Documentation](https://docs.example.com)
- [GitHub Repository](https://github.com/example/project)
- [Design Mockups](https://figma.com/example)
- [API Reference](https://api.example.com/docs)

## Code Example

```javascript
function authenticateUser(username, password) {
  const user = findUserByUsername(username);
  if (user && verifyPassword(password, user.hash)) {
    return generateToken(user);
  }
  throw new Error('Authentication failed');
}
```

## Notes

> **Important:** All team members must complete security training before accessing production systems.

> **Tip:** Use the staging environment for testing new features.

## Implementation Steps

1. **Phase 1: Setup**
   - Initialize project structure
   - Configure CI/CD pipeline

2. **Phase 2: Development**
   - Build core features
   - Integrate third-party services

3. **Phase 3: Testing**
   - Unit testing
   - Integration testing
   - User acceptance testing

## Team Responsibilities

- **Frontend Team**: UI/UX implementation, responsive design
- **Backend Team**: API development, database optimization
- **DevOps Team**: Infrastructure setup, deployment automation
- **QA Team**: Test planning, bug tracking, quality assurance

## Emphasis and Formatting

This text includes **bold text** for emphasis, *italic text* for subtle emphasis, and ***bold italic*** for strong emphasis.

You can also use `inline code` for technical terms and commands.

## Unordered List

- Item 1
- Item 2
  - Nested item 2.1
  - Nested item 2.2
    - Deeply nested item
- Item 3

## Horizontal Rule

---

## Status Update

Last updated: 2026-01-12
Status: In Progress
Priority: High
