# Room Joiner Script

This script allows you to join users one by one to a specific room ID. It's useful for testing, load testing, or populating rooms with participants.

## Features

- ✅ Join specific users by their IDs
- ✅ Join random users (specified count)
- ✅ Join all users in the database
- ✅ Configurable delay between joins
- ✅ Role assignment (host, moderator, participant, viewer)
- ✅ Room capacity validation
- ✅ Duplicate user detection
- ✅ Real-time progress tracking
- ✅ Comprehensive error handling

## Prerequisites

1. Make sure your backend server is running
2. Ensure you have users in your database
3. Ensure you have at least one active room
4. Make sure Redis is running (for caching)

## Usage

### Basic Commands

```bash
# Join 5 random users to a room
npm run join-users -- --roomId 507f1f77bcf86cd799439011 --userCount 5

# Join specific users to a room
npm run join-users -- --roomId 507f1f77bcf86cd799439011 --userIds 507f1f77bcf86cd799439012,507f1f77bcf86cd799439013

# Join all users to a room
npm run join-users -- --roomId 507f1f77bcf86cd799439011

# Join users with custom delay and role
npm run join-users -- --roomId 507f1f77bcf86cd799439011 --userCount 3 --delay 2000 --role moderator
```

### Command Line Options

| Option | Short | Description | Required | Default |
|--------|-------|-------------|----------|---------|
| `--roomId` | `-r` | Room ID to join users to | ✅ Yes | - |
| `--userIds` | `-u` | Comma-separated list of user IDs | ❌ No | All users |
| `--userCount` | `-c` | Number of random users to join | ❌ No | All users |
| `--delay` | `-d` | Delay between joins in milliseconds | ❌ No | 1000ms |
| `--role` | - | Role for users (host\|moderator\|participant\|viewer) | ❌ No | participant |
| `--help` | `-h` | Show help message | ❌ No | - |

### Examples

#### 1. Load Testing
Join 20 users with a 500ms delay to simulate real-world usage:
```bash
npm run join-users -- --roomId 507f1f77bcf86cd799439011 --userCount 20 --delay 500
```

#### 2. Specific User Testing
Join specific users to test particular scenarios:
```bash
npm run join-users -- --roomId 507f1f77bcf86cd799439011 --userIds 507f1f77bcf86cd799439012,507f1f77bcf86cd799439013,507f1f77bcf86cd799439014
```

#### 3. Role-Based Testing
Join users with different roles:
```bash
# Join a host
npm run join-users -- --roomId 507f1f77bcf86cd799439011 --userIds 507f1f77bcf86cd799439012 --role host

# Join moderators
npm run join-users -- --roomId 507f1f77bcf86cd799439011 --userCount 3 --role moderator

# Join regular participants
npm run join-users -- --roomId 507f1f77bcf86cd799439011 --userCount 10 --role participant
```

#### 4. Quick Testing
Join users quickly for rapid testing:
```bash
npm run join-users -- --roomId 507f1f77bcf86cd799439011 --userCount 5 --delay 100
```

## What the Script Does

1. **Connects to Database**: Establishes connection to MongoDB
2. **Validates Room**: Checks if room exists, is active, and has capacity
3. **Gets Users**: Retrieves users based on your criteria (specific IDs, random count, or all)
4. **Joins Users One by One**:
   - Generates LiveKit token for each user
   - Creates participant record in database
   - Caches participant in Redis
   - Updates room participant count
   - Adds configurable delay between joins
5. **Provides Summary**: Shows success/failure counts and final room stats

## Output Example

```
🚀 Starting room joining process...
Options: {
  "roomId": "507f1f77bcf86cd799439011",
  "userCount": 5,
  "delayMs": 1000,
  "role": "participant"
}
✅ Connected to MongoDB
✅ Room validated: Team Meeting (2/20 participants)
✅ Found 5 random users

📋 Joining 5 users to room: Team Meeting
==================================================

👤 [1/5] Joining user: Alice Johnson (alice@example.com)
✅ User Alice Johnson (alice@example.com) joined room as participant
⏳ Waiting 1000ms before next join...

👤 [2/5] Joining user: Bob Smith (bob@example.com)
✅ User Bob Smith (bob@example.com) joined room as participant
⏳ Waiting 1000ms before next join...

...

==================================================
📊 Join Summary:
✅ Successful joins: 5
❌ Failed joins: 0
📈 Total users in room: 7
🏠 Room: Team Meeting
👥 Current participants: 7/20
✅ Disconnected from MongoDB
```

## Error Handling

The script handles various error scenarios:

- **Room not found**: Validates room exists and is active
- **Room capacity exceeded**: Checks available slots before joining
- **User already in room**: Prevents duplicate joins
- **Database connection issues**: Graceful connection handling
- **Invalid user IDs**: Validates user existence

## Troubleshooting

### Common Issues

1. **"Room not found"**
   - Verify the room ID is correct
   - Ensure the room is active
   - Check if you're using the right ID format (ObjectId or roomId string)

2. **"No users found"**
   - Run the seed script first: `npm run seed`
   - Check if users exist in the database

3. **"Room is at maximum capacity"**
   - Increase room maxParticipants
   - Remove some existing participants
   - Use a different room

4. **"Failed to connect to MongoDB"**
   - Ensure MongoDB is running
   - Check your database connection string
   - Verify network connectivity

### Debug Mode

To see more detailed output, you can modify the script to include debug logging or run with verbose output.

## Integration with Other Scripts

This script works well with other scripts in the project:

- **Seed Data**: Use `npm run seed` to create test users first
- **Room Creation**: Create rooms via API or database directly
- **Cleanup**: Manually remove participants when done testing

## Performance Considerations

- **Delay**: Use appropriate delays to avoid overwhelming the system
- **Batch Size**: For large numbers, consider running multiple smaller batches
- **Monitoring**: Monitor system resources during execution
- **Cleanup**: Remember to clean up test data after testing

## Security Notes

- This script is for development/testing purposes only
- Don't use in production without proper security review
- Ensure proper authentication/authorization in production
- Be careful with user data and tokens
