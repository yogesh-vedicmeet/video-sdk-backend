# Authentication & Authorization System

This document describes the comprehensive authentication and authorization system implemented for the Video SDK backend.

## Overview

The authentication system provides:
- User registration and login with JWT tokens
- Role-based access control (RBAC)
- Password security with bcrypt hashing
- Account lockout protection
- Email verification system
- Password reset functionality
- Refresh token mechanism
- Admin panel for user management

## Features

### 🔐 Authentication Features
- **JWT-based authentication** with access and refresh tokens
- **Password hashing** using bcrypt with salt rounds
- **Account lockout** after 5 failed login attempts (2-hour lockout)
- **Email verification** with expiring tokens
- **Password reset** with secure token generation
- **Session management** with refresh tokens

### 🛡️ Security Features
- **Rate limiting** on authentication endpoints
- **Input validation** using Joi schemas
- **Password complexity requirements**
- **CORS protection**
- **Request logging** and error handling
- **Secure token storage** in database

### 👥 Authorization Features
- **Role-based access control** (user, moderator, admin)
- **Resource ownership** validation
- **Admin panel** for user management
- **Granular permissions** for different operations

## User Roles

### User (Default)
- Create and manage their own rooms
- Participate in video calls
- Create polls and interact with features
- Update their own profile

### Moderator
- All user permissions
- Moderate rooms and content
- Manage participants in rooms
- Access moderation tools

### Admin
- All moderator permissions
- Manage all users
- Access system statistics
- Full administrative control

## API Endpoints

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "SecurePass123!",
  "userId": "john_doe"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

#### Verify Email
```http
GET /api/auth/verify-email/:token
```

#### Forgot Password
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Reset Password
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token",
  "newPassword": "NewSecurePass123!"
}
```

#### Change Password
```http
POST /api/auth/change-password
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "currentPassword": "OldPass123!",
  "newPassword": "NewSecurePass123!"
}
```

#### Get Profile
```http
GET /api/auth/me
Authorization: Bearer your-access-token
```

#### Update Profile
```http
PUT /api/auth/profile
Authorization: Bearer your-access-token
Content-Type: application/json

{
  "name": "Updated Name",
  "avatar": "https://example.com/avatar.jpg"
}
```

### Admin Endpoints

#### Get All Users
```http
GET /api/admin/users?page=1&limit=10&search=john&role=user&isActive=true
Authorization: Bearer admin-access-token
```

#### Get User by ID
```http
GET /api/admin/users/:userId
Authorization: Bearer admin-access-token
```

#### Update User
```http
PUT /api/admin/users/:userId
Authorization: Bearer admin-access-token
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "newemail@example.com",
  "role": "moderator",
  "isActive": true,
  "isEmailVerified": true
}
```

#### Delete User
```http
DELETE /api/admin/users/:userId
Authorization: Bearer admin-access-token
```

#### Reset User Password
```http
POST /api/admin/users/:userId/reset-password
Authorization: Bearer admin-access-token
Content-Type: application/json

{
  "newPassword": "NewSecurePass123!"
}
```

#### Unlock User Account
```http
POST /api/admin/users/:userId/unlock
Authorization: Bearer admin-access-token
```

#### Promote User
```http
POST /api/admin/users/:userId/promote
Authorization: Bearer admin-access-token
```

#### Demote User
```http
POST /api/admin/users/:userId/demote
Authorization: Bearer admin-access-token
```

#### Get System Statistics
```http
GET /api/admin/stats
Authorization: Bearer admin-access-token
```

## Middleware

### Authentication Middleware

#### `authenticate`
Verifies JWT token and attaches user to request.

#### `optionalAuth`
Attaches user if token is valid, but doesn't require it.

#### `authorize(roles)`
Requires specific role(s) to access the route.

#### `requireAdmin`
Requires admin role.

#### `requireModerator`
Requires moderator or admin role.

#### `requireUser`
Requires any authenticated user.

#### `requireOwnership(field)`
Ensures user owns the resource or has admin role.

### Security Middleware

#### `rateLimit(options)`
Limits requests based on user ID or IP.

#### `requireApiKey`
Validates API key from headers.

#### `cors`
Handles Cross-Origin Resource Sharing.

## Database Models

### User Model
```typescript
interface IUser {
  userId: string;
  email: string;
  name: string;
  password: string;
  avatar?: string;
  role: 'admin' | 'moderator' | 'user';
  isActive: boolean;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLoginAt?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  refreshTokens: string[];
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Environment Variables

Add these to your `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# API Security
API_KEY=your-api-key-here

# CORS Configuration
CORS_ORIGIN=*

# Email Configuration (for future implementation)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
```

## Password Requirements

Passwords must meet the following criteria:
- Minimum 8 characters
- Maximum 128 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (@$!%*?&)

## Security Best Practices

1. **Use HTTPS** in production
2. **Set strong JWT secrets** and rotate them regularly
3. **Implement rate limiting** on all endpoints
4. **Validate all inputs** using Joi schemas
5. **Log security events** for monitoring
6. **Use environment variables** for sensitive data
7. **Implement proper CORS** configuration
8. **Regular security audits** of the codebase

## Usage Examples

### Protecting Routes
```typescript
// Require authentication
router.get('/protected', authenticate, controller.method);

// Require specific role
router.post('/admin-only', authenticate, requireAdmin, controller.method);

// Require ownership
router.put('/resource/:id', authenticate, requireOwnership('createdBy'), controller.method);
```

### Creating Users
```typescript
const user = new User({
  email: 'user@example.com',
  name: 'John Doe',
  password: 'SecurePass123!',
  userId: 'john_doe'
});
await user.save();
```

### Verifying Passwords
```typescript
const isPasswordValid = await user.comparePassword(candidatePassword);
```

### Generating Tokens
```typescript
const accessToken = jwt.sign(
  { id: user._id, email: user.email, role: user.role },
  config.jwtSecret,
  { expiresIn: '1h' }
);
```

## Error Handling

The system provides comprehensive error handling:

- **Validation errors** with detailed field information
- **Authentication errors** with appropriate HTTP status codes
- **Authorization errors** for insufficient permissions
- **Rate limiting errors** with retry information
- **Database errors** with proper error messages

## Future Enhancements

1. **Two-factor authentication** (2FA)
2. **OAuth integration** (Google, GitHub, etc.)
3. **Email service integration** for verification and reset
4. **Session management** with Redis
5. **Audit logging** for security events
6. **API key management** for third-party integrations
7. **Multi-tenancy** support
8. **Advanced role permissions** with custom scopes

## Testing

To test the authentication system:

1. **Install dependencies**: `npm install`
2. **Set up environment variables** in `.env`
3. **Start the server**: `npm run dev`
4. **Use the API endpoints** with proper authentication headers

Example test flow:
1. Register a new user
2. Verify email (check console for token)
3. Login to get access token
4. Use access token for protected endpoints
5. Refresh token when needed
6. Test admin endpoints with admin user

## Support

For questions or issues with the authentication system, please refer to:
- API documentation
- Error logs in the console
- Database queries for debugging
- Security best practices documentation
