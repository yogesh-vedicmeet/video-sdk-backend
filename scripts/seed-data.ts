import mongoose from 'mongoose';
import { config } from '../src/config/config';
import { User } from '../src/models/User';
import { Room } from '../src/models/Room';
import { Participant } from '../src/models/Participant';
import { Session } from '../src/models/Session';
import { Poll } from '../src/models/Poll';
import { Question } from '../src/models/Question';
import { Emoji } from '../src/models/Emoji';
import { Gift } from '../src/models/Gift';
import * as bcrypt from 'bcryptjs';

// Fake data generators
const faker = {
    // Names and personal info
    names: [
        'Alice Johnson', 'Bob Smith', 'Carol Davis', 'David Wilson', 'Emma Brown',
        'Frank Miller', 'Grace Lee', 'Henry Taylor', 'Ivy Chen', 'Jack Anderson',
        'Kate Martinez', 'Liam O\'Connor', 'Maya Patel', 'Noah Garcia', 'Olivia Kim',
        'Paul Rodriguez', 'Quinn Thompson', 'Ruby Singh', 'Sam Williams', 'Tina Nguyen'
    ],
    
    emails: [
        'alice.johnson@example.com', 'bob.smith@example.com', 'carol.davis@example.com',
        'david.wilson@example.com', 'emma.brown@example.com', 'frank.miller@example.com',
        'grace.lee@example.com', 'henry.taylor@example.com', 'ivy.chen@example.com',
        'jack.anderson@example.com', 'kate.martinez@example.com', 'liam.oconnor@example.com',
        'maya.patel@example.com', 'noah.garcia@example.com', 'olivia.kim@example.com',
        'paul.rodriguez@example.com', 'quinn.thompson@example.com', 'ruby.singh@example.com',
        'sam.williams@example.com', 'tina.nguyen@example.com'
    ],
    
    roomNames: [
        'Team Standup Meeting', 'Product Demo', 'Client Presentation', 'Code Review Session',
        'Design Workshop', 'Strategy Planning', 'Training Session', 'Q&A Session',
        'Brainstorming Meeting', 'Project Kickoff', 'Sprint Planning', 'Retrospective',
        'All-Hands Meeting', 'Technical Discussion', 'Sales Pitch', 'Customer Support',
        'Research Discussion', 'Architecture Review', 'Testing Session', 'Deployment Planning'
    ],
    
    roomDescriptions: [
        'Daily team synchronization meeting',
        'Product feature demonstration and feedback',
        'Client presentation and discussion',
        'Code review and technical discussion',
        'Design workshop and collaboration',
        'Strategic planning and goal setting',
        'Training and knowledge sharing session',
        'Question and answer session',
        'Creative brainstorming meeting',
        'Project kickoff and planning',
        'Sprint planning and task assignment',
        'Sprint retrospective and improvement discussion',
        'Company-wide all-hands meeting',
        'Technical architecture discussion',
        'Sales presentation and pitch',
        'Customer support and troubleshooting',
        'Research findings and discussion',
        'System architecture review',
        'Testing strategy and execution',
        'Deployment planning and coordination'
    ],
    
    pollQuestions: [
        'What is your preferred meeting time?',
        'Which feature should we prioritize?',
        'How would you rate the session?',
        'What topic should we discuss next?',
        'Which design option do you prefer?',
        'How confident are you with the current plan?',
        'What is your availability for next week?',
        'Which tool should we use for this project?',
        'How would you rate the presentation?',
        'What should be our next milestone?'
    ],
    
    pollOptions: [
        ['Morning', 'Afternoon', 'Evening'],
        ['Feature A', 'Feature B', 'Feature C'],
        ['Excellent', 'Good', 'Average', 'Poor'],
        ['Topic A', 'Topic B', 'Topic C', 'Topic D'],
        ['Design 1', 'Design 2', 'Design 3'],
        ['Very Confident', 'Confident', 'Somewhat Confident', 'Not Confident'],
        ['Available', 'Partially Available', 'Not Available'],
        ['Tool A', 'Tool B', 'Tool C'],
        ['5 Stars', '4 Stars', '3 Stars', '2 Stars', '1 Star'],
        ['Milestone A', 'Milestone B', 'Milestone C']
    ],
    
    questionTexts: [
        'How do I join the meeting?',
        'Can I share my screen?',
        'Is the meeting being recorded?',
        'How do I mute my microphone?',
        'Can I change my video settings?',
        'How do I leave the meeting?',
        'Is there a chat feature?',
        'Can I raise my hand?',
        'How do I change my name?',
        'Is there a waiting room?'
    ],
    
    emojiNames: [
        'thumbs_up', 'clap', 'heart', 'laugh', 'wow', 'sad', 'angry', 'fire', 'rocket', 'star'
    ],
    
    giftNames: [
        'Virtual Coffee', 'Digital Flower', 'Gold Star', 'Trophy', 'Medal',
        'Crown', 'Diamond', 'Rose', 'Chocolate', 'Gift Box'
    ],
    
    // Utility functions
    randomElement: <T>(array: T[]): T => {
        return array[Math.floor(Math.random() * array.length)];
    },
    
    randomElements: <T>(array: T[], count: number): T[] => {
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    },
    
    randomNumber: (min: number, max: number): number => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    randomBoolean: (): boolean => {
        return Math.random() > 0.5;
    },
    
    randomDate: (start: Date, end: Date): Date => {
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    },
    
    generateId: (prefix: string): string => {
        return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
    },
    
    generateUserId: (): string => {
        return `user_${Math.random().toString(36).substr(2, 8)}`;
    },
    
    generateRoomId: (): string => {
        return `room_${Math.random().toString(36).substr(2, 8)}`;
    },
    
    generateParticipantId: (): string => {
        return `participant_${Math.random().toString(36).substr(2, 8)}`;
    },
    
    generateSessionId: (): string => {
        return `session_${Math.random().toString(36).substr(2, 8)}`;
    }
};

// Database connection
async function connectToDatabase() {
    try {
        await mongoose.connect(config.mongoUri, {
            dbName: config.mongoDbName,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

// Generate fake users
async function generateUsers(count: number = 20) {
    console.log(`👥 Generating ${count} users...`);
    const users = [];
        
    for (let i = 0; i < count; i++) {
        const name = faker.randomElement(faker.names);
        const email = faker.randomElement(faker.emails);
        const role = i === 0 ? 'admin' : i < 3 ? 'moderator' : 'user';
        
        const user = new User({
            userId: faker.generateUserId(),
            email,
            name,
            password: bcrypt.hashSync('password123', 10), // Will be hashed by pre-save middleware
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
            role,
            isActive: faker.randomBoolean(),
            isEmailVerified: faker.randomBoolean(),
            lastLoginAt: faker.randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()),
            loginAttempts: faker.randomNumber(0, 3),
            twoFactorEnabled: faker.randomBoolean(),
            refreshTokens: []
        });
        
        users.push(user);
    }
    
    await User.insertMany(users);
    console.log(`✅ Generated ${users.length} users`);
    return users;
}

// Generate fake rooms
async function generateRooms(count: number = 15, users: any[]) {
    console.log(`🏠 Generating ${count} rooms...`);
    const rooms = [];
    
    for (let i = 0; i < count; i++) {
        const user = faker.randomElement(users);
        const room = new Room({
            roomId: faker.generateRoomId(),
            name: faker.randomElement(faker.roomNames),
            description: faker.randomElement(faker.roomDescriptions),
            createdBy: user.userId,
            isActive: faker.randomBoolean(),
            maxParticipants: faker.randomNumber(5, 50),
            currentParticipants: faker.randomNumber(0, 10),
            settings: {
                recordingEnabled: faker.randomBoolean(),
                chatEnabled: faker.randomBoolean(),
                screenShareEnabled: faker.randomBoolean(),
                waitingRoomEnabled: faker.randomBoolean(),
                moderatorApprovalRequired: faker.randomBoolean()
            },
            metadata: {
                category: faker.randomElement(['meeting', 'presentation', 'workshop', 'training']),
                tags: faker.randomElements(['urgent', 'important', 'confidential', 'public'], faker.randomNumber(1, 3))
            },
            lastActivityAt: faker.randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date())
        });
        
        rooms.push(room);
    }
    
    await Room.insertMany(rooms);
    console.log(`✅ Generated ${rooms.length} rooms`);
    return rooms;
}

// Generate fake participants
async function generateParticipants(count: number = 50, rooms: any[], users: any[]) {
    console.log(`👤 Generating ${count} participants...`);
    const participants = [];
    const room = await Room.findOne({_id: '68a460f12c5f471c834cd55c'});

    if (!room) {
        console.error('Room not found');
        return [];
    }
    const userlist:any = await User.find({_id:{$ne:['68a460f12c5f471c834cd55c']}})
    if (!userlist) {
        console.error('User not found');
        return [];
    }
    for (let i = 0; i < count; i++) {
       
        const role = faker.randomElement(['host', 'moderator', 'participant', 'viewer']);
        const user:any = faker.randomElement(userlist);

        console.log(user);
        
        const participant = new Participant({
            participantId: faker.generateParticipantId(),
            roomId: room.roomId,
            identity: user._id.toString()       ,
            name: user.name,
            email: user.email,
            role,
            isOnline: faker.randomBoolean(),
            isMuted: faker.randomBoolean(),
            isVideoEnabled: faker.randomBoolean(),
            isScreenSharing: faker.randomBoolean(),
            metadata: {
                device: faker.randomElement(['desktop', 'mobile', 'tablet']),
                browser: faker.randomElement(['Chrome', 'Firefox', 'Safari', 'Edge']),
                location: faker.randomElement(['US', 'UK', 'CA', 'AU', 'DE', 'FR'])
            },
            joinedAt: faker.randomDate(new Date(Date.now() - 24 * 60 * 60 * 1000), new Date()),
            leftAt: faker.randomBoolean() ? faker.randomDate(new Date(Date.now() - 24 * 60 * 60 * 1000), new Date()) : undefined,
            lastActivityAt: faker.randomDate(new Date(Date.now() - 60 * 60 * 1000), new Date())
        });
        
        participants.push(participant);
    }
    
    await Participant.insertMany(participants);
    await Room.updateOne({_id: room._id}, {$set: {currentParticipants: participants.length}});
    console.log(`✅ Generated ${participants.length} participants`);
    return participants;
}

// Generate fake sessions
async function generateSessions(count: number = 25, rooms: any[], users: any[]) {
    console.log(`📅 Generating ${count} sessions...`);
    const sessions = [];
    
    for (let i = 0; i < count; i++) {
        const room = faker.randomElement(rooms);
        const host = faker.randomElement(users);
        const status = faker.randomElement(['scheduled', 'active', 'ended', 'cancelled']);
        
        // Generate start time first (within last 30 days, but not in the future)
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const startTime = faker.randomDate(thirtyDaysAgo, now);
        
        // Generate end time only for ended sessions, ensuring it's after start time
        let endTime: Date | undefined = undefined;
        if (status === 'ended') {
            // Ensure end time is at least 10 minutes after start time
            const minEndTime = new Date(startTime.getTime() + 10 * 60 * 1000);
            // And not more than 7 days ago (to keep it recent)
            const maxEndTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            if (minEndTime < maxEndTime) {
                endTime = faker.randomDate(minEndTime, maxEndTime);
            } else {
                // Fallback: just add 30 minutes to start time
                endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
            }
        }
        
        // Debug logging for time issues
        if (endTime && endTime <= startTime) {
            console.warn(`⚠️ Time issue detected: startTime=${startTime}, endTime=${endTime}`);
        }
        
        const session = new Session({
            sessionId: faker.generateSessionId(),
            roomId: room.roomId,
            hostId: host.userId,
            title: faker.randomElement(faker.roomNames),
            description: faker.randomElement(faker.roomDescriptions),
            startTime,
            endTime,
            duration: 0, // Will be calculated by pre-save middleware
            participantCount: faker.randomNumber(1, 20),
            maxParticipants: faker.randomNumber(10, 50),
            isRecording: faker.randomBoolean(),
            recordingUrl: faker.randomBoolean() ? `https://example.com/recordings/${faker.generateSessionId()}.mp4` : undefined,
            status,
            settings: {
                recordingEnabled: faker.randomBoolean(),
                chatEnabled: faker.randomBoolean(),
                screenShareEnabled: faker.randomBoolean(),
                waitingRoomEnabled: faker.randomBoolean(),
                moderatorApprovalRequired: faker.randomBoolean()
            },
            metadata: {
                category: faker.randomElement(['meeting', 'presentation', 'workshop', 'training']),
                tags: faker.randomElements(['urgent', 'important', 'confidential', 'public'], faker.randomNumber(1, 3))
            }
        });
        
        sessions.push(session);
    }
    
    await Session.insertMany(sessions);
    console.log(`✅ Generated ${sessions.length} sessions`);
    return sessions;
}

// Generate fake polls
async function generatePolls(count: number = 30, sessions: any[]) {
    console.log(`📊 Generating ${count} polls...`);
    const polls = [];
    
    for (let i = 0; i < count; i++) {
        const session = faker.randomElement(sessions);
        const questionIndex = faker.randomNumber(0, faker.pollQuestions.length - 1);
        const options = faker.pollOptions[questionIndex];
        
        const poll = new Poll({
            pollId: `poll_${Math.random().toString(36).substr(2, 8)}`,
            roomId: session.roomId,
            createdBy: session.hostId,
            question: faker.pollQuestions[questionIndex],
            options: options.map((option, index) => ({
                id: `option_${index}`,
                text: option,
                votes: faker.randomNumber(0, 10),
                voters: [] // Initialize empty voters array
            })),
            isActive: faker.randomBoolean(),
            isMultipleChoice: faker.randomBoolean(),
            createdAt: faker.randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()),
            expiresAt: faker.randomDate(new Date(), new Date(Date.now() + 24 * 60 * 60 * 1000))
        });
        
        polls.push(poll);
    }
    
    await Poll.insertMany(polls);
    console.log(`✅ Generated ${polls.length} polls`);
    return polls;
}

// Generate fake questions
async function generateQuestions(count: number = 40, sessions: any[]) {
    console.log(`❓ Generating ${count} questions...`);
    const questions = [];
    
    for (let i = 0; i < count; i++) {
        const session = faker.randomElement(sessions);  
        
        const question = new Question({
            questionId: `question_${Math.random().toString(36).substr(2, 8)}`,
            roomId: session.roomId,
            askedBy: session.hostId,
            askedByName: session.hostId, // Using hostId as name for simplicity
            question: faker.randomElement(faker.questionTexts),
            isAnswered: faker.randomBoolean(),
            upvotes: faker.randomNumber(0, 15),
            downvotes: faker.randomNumber(0, 5),
            createdAt: faker.randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()),
            answeredAt: faker.randomBoolean() ? faker.randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()) : undefined
        });
        
        questions.push(question);
    }
    
    await Question.insertMany(questions);
    console.log(`✅ Generated ${questions.length} questions`);
    return questions;
}

// Generate fake emojis
async function generateEmojis(count: number = 100, sessions: any[]) {
    console.log(`😊 Generating ${count} emoji reactions...`);
    const emojis = [];
    
    for (let i = 0; i < count; i++) {
        const session = faker.randomElement(sessions);
        
        const emoji = new Emoji({
            emojiId: `emoji_${Math.random().toString(36).substr(2, 8)}`,
            roomId: session.roomId,
            emoji: faker.randomElement(['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🔥', '🚀', '⭐']),
            senderId: session.hostId,
            senderName: session.hostId, // Using hostId as name for simplicity
            isGlobal: faker.randomBoolean(),
            createdAt: faker.randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date())
        });
        
        emojis.push(emoji);
    }
    
    await Emoji.insertMany(emojis);
    console.log(`✅ Generated ${emojis.length} emoji reactions`);
    return emojis;
}

// Generate fake gifts
async function generateGifts(count: number = 50, sessions: any[]) {
    console.log(`🎁 Generating ${count} gifts...`);
    const gifts = [];
    
    for (let i = 0; i < count; i++) {
        const session = faker.randomElement(sessions);
        
        const gift = new Gift({
            giftId: `gift_${Math.random().toString(36).substr(2, 8)}`,
            roomId: session.roomId,
            giftType: faker.randomElement(faker.giftNames),
            giftName: faker.randomElement(faker.giftNames),
            giftValue: faker.randomNumber(1, 100),
            senderId: session.hostId,
            senderName: session.hostId, // Using hostId as name for simplicity
            receiverId: `participant_${Math.random().toString(36).substr(2, 8)}`,
            receiverName: `Participant ${Math.random().toString(36).substr(2, 4)}`,
            message: faker.randomElement(['Great job!', 'Well done!', 'Keep it up!', 'Amazing!', 'Fantastic!']),
            createdAt: faker.randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date())
        });
        
        gifts.push(gift);
    }
    
    await Gift.insertMany(gifts);
    console.log(`✅ Generated ${gifts.length} gifts`);
    return gifts;
}

// Main seeding function
async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...');
        
        // Clear existing data
        console.log('🧹 Clearing existing data...');
        // await Promise.all([
        //     User.deleteMany({}),
        //     Room.deleteMany({}),
        //     Participant.deleteMany({}),
        //     Session.deleteMany({}),
        //     Poll.deleteMany({}),
        //     Question.deleteMany({}),
        //     Emoji.deleteMany({}),
        //     Gift.deleteMany({})
        // ]);
        console.log('✅ Cleared existing data');
        
        // Generate data in order of dependencies
        let users = await User.find({});
        if (users.length === 0) {
            console.log('No users found, generating new users...');
            users = await generateUsers(20);
        } else {
            console.log(`Found ${users.length} existing users`);
        }
        // const rooms = await generateRooms(15, users);
        const participants = await generateParticipants(50, [], users);
        // const sessions = await generateSessions(25, rooms, users);
        // const polls = await generatePolls(30, sessions);
        // const questions = await generateQuestions(40, sessions);
        // const emojis = await generateEmojis(100, sessions);
        // const gifts = await generateGifts(50, sessions);
        
        // Display summary
        console.log('\n📊 Seeding Summary:');
        console.log(`👥 Users: ${users.length}`);
        // console.log(`🏠 Rooms: ${rooms.length}`);
        // console.log(`👤 Participants: ${participants.length}`);
        // console.log(`📅 Sessions: ${sessions.length}`);
        // console.log(`📊 Polls: ${polls.length}`);
        // console.log(`❓ Questions: ${questions.length}`);
        // console.log(`😊 Emoji Reactions: ${emojis.length}`);
        // console.log(`🎁 Gifts: ${gifts.length}`);
        
        console.log('\n✅ Database seeding completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during seeding:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
        process.exit(0);
    }
}

// Run the seeding
if (require.main === module) {
    connectToDatabase().then(seedDatabase);
}

export { seedDatabase, connectToDatabase };
