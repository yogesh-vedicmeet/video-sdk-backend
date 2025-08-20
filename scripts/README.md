# Database Seeding Script

This directory contains scripts for populating your database with fake data for testing and development purposes.

## Files

- `seed-data.ts` - Main seeding script that generates fake data for all models
- `README.md` - This documentation file

## Usage

### Prerequisites

1. Make sure MongoDB is running and accessible
2. Ensure your environment variables are properly configured (see `.env` file)
3. Install dependencies: `npm install`

### Running the Seeding Script

#### One-time seeding:
```bash
npm run seed
```

#### Development mode (with auto-restart):
```bash
npm run seed:dev
```

#### Direct execution:
```bash
npx ts-node -r tsconfig-paths/register scripts/seed-data.ts
```

## What Data is Generated

The seeding script generates realistic fake data for all your models:

### 👥 Users (20 records)
- Realistic names and email addresses
- Different roles: admin, moderator, user
- Hashed passwords (default: "password123")
- Avatar URLs using DiceBear API
- Various account states (active/inactive, verified/unverified)

### 🏠 Rooms (15 records)
- Meeting room names and descriptions
- Different participant limits and current counts
- Various settings (recording, chat, screen share, etc.)
- Metadata with categories and tags

### 👤 Participants (50 records)
- Connected to rooms and users
- Different roles: host, moderator, participant, viewer
- Various states (online/offline, muted/unmuted, video on/off)
- Device and browser information

### 📅 Sessions (25 records)
- Connected to rooms and hosts
- Different statuses: scheduled, active, ended, cancelled
- Realistic start/end times and durations
- Recording information

### 📊 Polls (30 records)
- Various question types and options
- Vote counts and settings
- Anonymous and multiple vote options

### ❓ Questions (40 records)
- Q&A session questions
- Upvotes and downvotes
- Anonymous questions

### 😊 Emoji Reactions (100 records)
- Various emoji types
- Reaction counts

### 🎁 Gifts (50 records)
- Virtual gifts between participants
- Gift values and messages

## Data Relationships

The script maintains proper relationships between entities:
- Users create rooms
- Participants join rooms
- Sessions are created in rooms
- Polls, questions, emojis, and gifts are associated with sessions

## Customization

You can modify the seeding script to:
- Change the number of records generated
- Add more variety to the fake data
- Include additional fields
- Modify the data generation logic

### Example: Changing Record Counts

Edit the `seedDatabase()` function in `seed-data.ts`:

```typescript
// Generate data in order of dependencies
const users = await generateUsers(50);        // Change from 20 to 50
const rooms = await generateRooms(30, users); // Change from 15 to 30
const participants = await generateParticipants(100, rooms, users); // Change from 50 to 100
// ... etc
```

### Example: Adding Custom Data

Add new data to the `faker` object:

```typescript
const faker = {
    // ... existing data
    customField: [
        'value1', 'value2', 'value3'
    ],
    // ... rest of faker object
};
```

## Database Connection

The script uses the same database configuration as your main application:
- Reads from environment variables
- Connects to the same MongoDB instance
- Uses the same database name

## Safety Features

- **Data Clearing**: The script clears all existing data before seeding
- **Error Handling**: Proper error handling and logging
- **Connection Management**: Proper database connection and disconnection
- **Validation**: Data follows your model schemas and validation rules

## Troubleshooting

### Connection Issues
- Ensure MongoDB is running
- Check your `.env` file configuration
- Verify network connectivity

### Permission Issues
- Ensure you have write permissions to the database
- Check MongoDB user permissions

### Memory Issues
- Reduce the number of records if you encounter memory problems
- Run the script in smaller batches

## Environment Variables

Make sure these environment variables are set in your `.env` file:

```env
MONGO_URI=mongodb://localhost:27017/your-database
MONGO_DB_NAME=your-database
```

## Notes

- All passwords are set to "password123" for testing
- The script generates realistic but fake data
- Data is generated with proper timestamps and relationships
- The script is idempotent - running it multiple times will reset the data

## Production Warning

⚠️ **Never run this script in production!** It will delete all existing data and replace it with fake data. This script is intended for development and testing purposes only.
