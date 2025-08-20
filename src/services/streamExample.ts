import LiveStreamService, { StreamConfig, StreamStats } from './liveStreamService';
import RedisVideoService from './redis-enhanced';

/**
 * Comprehensive example demonstrating live streaming functionality
 */
export class StreamExample {
    
    /**
     * Complete live streaming workflow example
     */
    static async runCompleteStreamExample(): Promise<void> {
        console.log('🎬 Starting Complete Live Stream Example...\n');

        try {
            // Step 1: Create a new live stream
            console.log('📝 Step 1: Creating a new live stream...');
            const streamConfig = await LiveStreamService.createStream({
                roomId: 'example-room-123',
                title: 'My First Live Stream',
                description: 'A demonstration of live streaming capabilities',
                quality: 'high',
                maxViewers: 500,
                settings: {
                    enableChat: true,
                    enableScreenShare: true,
                    enableRecording: true,
                    enableModeration: false,
                    allowViewerInteraction: true,
                    autoRecord: false,
                    streamDelay: 2,
                    maxBitrate: 3000,
                    resolution: { width: 1920, height: 1080 }
                },
                metadata: {
                    category: 'technology',
                    tags: ['demo', 'live', 'streaming'],
                    language: 'en'
                }
            });

            console.log('✅ Stream created:', {
                streamId: streamConfig.streamId,
                title: streamConfig.title,
                streamKey: streamConfig.streamKey,
                status: streamConfig.status
            });

            // Step 2: Start the live stream
            console.log('\n🎬 Step 2: Starting the live stream...');
            const startResult = await LiveStreamService.startStream(streamConfig.streamId, {
                identity: 'streamer-001',
                name: 'John Doe',
                email: 'john@example.com'
            });

            console.log('✅ Stream started:', {
                hostToken: startResult.hostToken.substring(0, 20) + '...',
                rtmpUrl: startResult.rtmpUrl,
                streamKey: startResult.streamKey,
                hlsUrl: startResult.streamConfig.hlsUrl,
                webRtcUrl: startResult.streamConfig.webRtcUrl
            });

            // Step 3: Add viewers to the stream
            console.log('\n👥 Step 3: Adding viewers to the stream...');
            const viewers = [
                { identity: 'viewer-001', name: 'Alice Smith', email: 'alice@example.com' },
                { identity: 'viewer-002', name: 'Bob Johnson', email: 'bob@example.com' },
                { identity: 'viewer-003', name: 'Carol Davis', email: 'carol@example.com' }
            ];

            for (const viewer of viewers) {
                const joinResult = await LiveStreamService.addViewer(streamConfig.streamId, viewer);
                console.log(`✅ ${viewer.name} joined:`, {
                    token: joinResult.token.substring(0, 20) + '...',
                    viewerCount: joinResult.viewerCount
                });
            }

            // Step 4: Send chat messages
            console.log('\n💬 Step 4: Sending chat messages...');
            const messages = [
                { sender: 'Alice Smith', message: 'Hello everyone! 👋', type: 'text' },
                { sender: 'Bob Johnson', message: 'Great stream! 👍', type: 'text' },
                { sender: 'Carol Davis', message: '🎉', type: 'emoji' },
                { sender: 'System', message: 'Welcome to the live stream!', type: 'system' }
            ];

            for (const message of messages) {
                const success = await LiveStreamService.sendChatMessage(streamConfig.streamId, message as any);
                if (success) {
                    console.log(`✅ Chat message sent: ${message.sender}: ${message.message}`);
                }
            }

            // Step 5: Start recording
            console.log('\n🎥 Step 5: Starting recording...');
            const recordingStarted = await LiveStreamService.startRecording(streamConfig.streamId);
            if (recordingStarted) {
                console.log('✅ Recording started successfully');
            }

            // Step 6: Get stream statistics
            console.log('\n📊 Step 6: Getting stream statistics...');
            const stats = await LiveStreamService.getStreamStats(streamConfig.streamId);
            if (stats) {
                console.log('✅ Stream statistics:', {
                    viewerCount: stats.viewerCount,
                    peakViewers: stats.peakViewers,
                    chatMessages: stats.chatMessages,
                    bandwidth: stats.bandwidth,
                    quality: stats.quality,
                    uptime: stats.uptime
                });
            }

            // Step 7: Simulate some stream events
            console.log('\n📈 Step 7: Simulating stream events...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

            // Step 8: Remove a viewer
            console.log('\n🚪 Step 8: Removing a viewer...');
            const viewerRemoved = await LiveStreamService.removeViewer(streamConfig.streamId, 'viewer-001');
            if (viewerRemoved) {
                console.log('✅ Alice Smith left the stream');
            }

            // Step 9: Stop recording
            console.log('\n⏹️ Step 9: Stopping recording...');
            const recordingStopped = await LiveStreamService.stopRecording(streamConfig.streamId, 'https://example.com/recordings/stream-123.mp4');
            if (recordingStopped) {
                console.log('✅ Recording stopped successfully');
            }

            // Step 10: Get final statistics
            console.log('\n📊 Step 10: Getting final statistics...');
            const finalStats = await LiveStreamService.getStreamStats(streamConfig.streamId);
            if (finalStats) {
                console.log('✅ Final stream statistics:', {
                    viewerCount: finalStats.viewerCount,
                    peakViewers: finalStats.peakViewers,
                    chatMessages: finalStats.chatMessages,
                    recordingSize: finalStats.recordingSize,
                    uptime: finalStats.uptime
                });
            }

            // Step 11: Stop the stream
            console.log('\n⏹️ Step 11: Stopping the stream...');
            const streamStopped = await LiveStreamService.stopStream(streamConfig.streamId);
            if (streamStopped) {
                console.log('✅ Stream stopped successfully');
            }

            // Step 12: Get stream events
            console.log('\n📋 Step 12: Getting stream events...');
            const events = await LiveStreamService.getStreamEvents(streamConfig.streamId, 50);
            console.log(`✅ Retrieved ${events.length} stream events`);

            console.log('\n🎉 Complete Live Stream Example finished successfully!');

        } catch (error) {
            console.error('❌ Error in complete stream example:', error);
        }
    }

    /**
     * Example of managing multiple streams
     */
    static async runMultipleStreamsExample(): Promise<void> {
        console.log('🎬 Starting Multiple Streams Example...\n');

        try {
            const streams = [];

            // Create multiple streams
            for (let i = 1; i <= 3; i++) {
                const streamConfig = await LiveStreamService.createStream({
                    roomId: `multi-room-${i}`,
                    title: `Multi Stream ${i}`,
                    description: `Stream number ${i} in multiple streams example`,
                    quality: i === 1 ? 'ultra' : i === 2 ? 'high' : 'medium',
                    maxViewers: 100 * i,
                    settings: {
                        enableChat: true,
                        enableScreenShare: true,
                        enableRecording: i % 2 === 0, // Only even streams record
                        enableModeration: i === 1,
                        allowViewerInteraction: true,
                        autoRecord: false,
                        streamDelay: i,
                        maxBitrate: 1000 * i,
                        resolution: { 
                            width: i === 1 ? 2560 : i === 2 ? 1920 : 1280, 
                            height: i === 1 ? 1440 : i === 2 ? 1080 : 720 
                        }
                    },
                    metadata: {
                        category: 'multi-stream',
                        streamNumber: i,
                        priority: i === 1 ? 'high' : i === 2 ? 'medium' : 'low'
                    }
                });

                streams.push(streamConfig);
                console.log(`✅ Created stream ${i}:`, streamConfig.streamId);
            }

            // Start all streams
            console.log('\n🎬 Starting all streams...');
            for (const stream of streams) {
                await LiveStreamService.startStream(stream.streamId, {
                    identity: `host-${stream.streamId}`,
                    name: `Host ${stream.streamId}`,
                    email: `host-${stream.streamId}@example.com`
                });
                console.log(`✅ Started stream: ${stream.streamId}`);
            }

            // Add viewers to each stream
            console.log('\n👥 Adding viewers to all streams...');
            for (const stream of streams) {
                for (let j = 1; j <= 3; j++) {
                    await LiveStreamService.addViewer(stream.streamId, {
                        identity: `viewer-${stream.streamId}-${j}`,
                        name: `Viewer ${j} of ${stream.streamId}`,
                        email: `viewer-${j}@example.com`
                    });
                }
                console.log(`✅ Added 3 viewers to stream: ${stream.streamId}`);
            }

            // Get statistics for all streams
            console.log('\n📊 Getting statistics for all streams...');
            for (const stream of streams) {
                const stats = await LiveStreamService.getStreamStats(stream.streamId);
                if (stats) {
                    console.log(`📊 Stream ${stream.streamId} stats:`, {
                        viewerCount: stats.viewerCount,
                        peakViewers: stats.peakViewers,
                        chatMessages: stats.chatMessages
                    });
                }
            }

            // Stop all streams
            console.log('\n⏹️ Stopping all streams...');
            for (const stream of streams) {
                await LiveStreamService.stopStream(stream.streamId);
                console.log(`✅ Stopped stream: ${stream.streamId}`);
            }

            console.log('\n🎉 Multiple Streams Example completed!');

        } catch (error) {
            console.error('❌ Error in multiple streams example:', error);
        }
    }

    /**
     * Example of stream quality management
     */
    static async runQualityManagementExample(): Promise<void> {
        console.log('🎬 Starting Quality Management Example...\n');

        try {
            // Create a stream with high quality
            const streamConfig = await LiveStreamService.createStream({
                roomId: 'quality-room',
                title: 'Quality Management Demo',
                description: 'Demonstrating quality management features',
                quality: 'ultra',
                maxViewers: 1000,
                settings: {
                    enableChat: true,
                    enableScreenShare: true,
                    enableRecording: true,
                    enableModeration: true,
                    allowViewerInteraction: true,
                    autoRecord: true,
                    streamDelay: 1,
                    maxBitrate: 6000,
                    resolution: { width: 2560, height: 1440 }
                }
            });

            console.log('✅ Created high-quality stream:', streamConfig.streamId);

            // Start the stream
            await LiveStreamService.startStream(streamConfig.streamId, {
                identity: 'quality-host',
                name: 'Quality Manager',
                email: 'quality@example.com'
            });

            console.log('✅ Started high-quality stream');

            // Simulate quality changes
            console.log('\n🔄 Simulating quality changes...');

            // Change to medium quality
            await LiveStreamService.updateStream(streamConfig.streamId, {
                quality: 'medium',
                settings: {
                    ...streamConfig.settings,
                    maxBitrate: 1500,
                    resolution: { width: 1280, height: 720 }
                }
            });
            console.log('✅ Changed to medium quality');

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Change to low quality
            await LiveStreamService.updateStream(streamConfig.streamId, {
                quality: 'low',
                settings: {
                    ...streamConfig.settings,
                    maxBitrate: 500,
                    resolution: { width: 640, height: 360 }
                }
            });
            console.log('✅ Changed to low quality');

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Change back to high quality
            await LiveStreamService.updateStream(streamConfig.streamId, {
                quality: 'high',
                settings: {
                    ...streamConfig.settings,
                    maxBitrate: 3000,
                    resolution: { width: 1920, height: 1080 }
                }
            });
            console.log('✅ Changed back to high quality');

            // Get final statistics
            const stats = await LiveStreamService.getStreamStats(streamConfig.streamId);
            if (stats) {
                console.log('\n📊 Final quality statistics:', {
                    quality: stats.quality,
                    bitrate: stats.quality.bitrate,
                    resolution: stats.quality.resolution,
                    latency: stats.quality.latency
                });
            }

            // Stop the stream
            await LiveStreamService.stopStream(streamConfig.streamId);
            console.log('✅ Stopped quality management stream');

            console.log('\n🎉 Quality Management Example completed!');

        } catch (error) {
            console.error('❌ Error in quality management example:', error);
        }
    }

    /**
     * Example of chat and interaction features
     */
    static async runChatInteractionExample(): Promise<void> {
        console.log('🎬 Starting Chat & Interaction Example...\n');

        try {
            // Create a stream with chat enabled
            const streamConfig = await LiveStreamService.createStream({
                roomId: 'chat-room',
                title: 'Chat & Interaction Demo',
                description: 'Demonstrating chat and interaction features',
                quality: 'medium',
                maxViewers: 100,
                settings: {
                    enableChat: true,
                    enableScreenShare: true,
                    enableRecording: false,
                    enableModeration: true,
                    allowViewerInteraction: true,
                    autoRecord: false,
                    streamDelay: 1,
                    maxBitrate: 1500,
                    resolution: { width: 1280, height: 720 }
                }
            });

            console.log('✅ Created chat-enabled stream:', streamConfig.streamId);

            // Start the stream
            await LiveStreamService.startStream(streamConfig.streamId, {
                identity: 'chat-host',
                name: 'Chat Host',
                email: 'chat@example.com'
            });

            // Add multiple viewers
            const viewers = [
                { identity: 'chat-viewer-1', name: 'Alice', email: 'alice@example.com' },
                { identity: 'chat-viewer-2', name: 'Bob', email: 'bob@example.com' },
                { identity: 'chat-viewer-3', name: 'Charlie', email: 'charlie@example.com' },
                { identity: 'chat-viewer-4', name: 'Diana', email: 'diana@example.com' },
                { identity: 'chat-viewer-5', name: 'Eve', email: 'eve@example.com' }
            ];

            for (const viewer of viewers) {
                await LiveStreamService.addViewer(streamConfig.streamId, viewer);
            }

            console.log('✅ Added 5 viewers to chat stream');

            // Simulate chat conversation
            console.log('\n💬 Simulating chat conversation...');

            const chatMessages = [
                { sender: 'Alice', message: 'Hello everyone! 👋', type: 'text' },
                { sender: 'Bob', message: 'Hi Alice! How are you?', type: 'text' },
                { sender: 'Charlie', message: 'Great to be here! 🎉', type: 'text' },
                { sender: 'Diana', message: 'This is amazing!', type: 'text' },
                { sender: 'Eve', message: '🔥🔥🔥', type: 'emoji' },
                { sender: 'Chat Host', message: 'Welcome everyone! Thanks for joining!', type: 'text' },
                { sender: 'Alice', message: 'Can we ask questions?', type: 'text' },
                { sender: 'Chat Host', message: 'Absolutely! Feel free to ask anything.', type: 'text' },
                { sender: 'Bob', message: 'What\'s the topic today?', type: 'text' },
                { sender: 'System', message: 'Chat is now moderated', type: 'system' },
                { sender: 'Charlie', message: '👍', type: 'emoji' },
                { sender: 'Diana', message: 'This is so interactive!', type: 'text' },
                { sender: 'Eve', message: 'Love the features! ❤️', type: 'emoji' }
            ];

            for (const message of chatMessages) {
                await LiveStreamService.sendChatMessage(streamConfig.streamId, message as any);
                console.log(`💬 ${message.sender}: ${message.message}`);
                
                // Add a small delay between messages
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Get chat statistics
            const stats = await LiveStreamService.getStreamStats(streamConfig.streamId);
            if (stats) {
                console.log('\n📊 Chat statistics:', {
                    chatMessages: stats.chatMessages,
                    viewerCount: stats.viewerCount,
                    peakViewers: stats.peakViewers
                });
            }

            // Remove some viewers
            console.log('\n🚪 Some viewers leaving...');
            await LiveStreamService.removeViewer(streamConfig.streamId, 'chat-viewer-1');
            await LiveStreamService.removeViewer(streamConfig.streamId, 'chat-viewer-3');
            console.log('✅ Alice and Charlie left the stream');

            // Send final messages
            await LiveStreamService.sendChatMessage(streamConfig.streamId, {
                sender: 'Chat Host',
                message: 'Thanks everyone for the great interaction!',
                type: 'text'
            });

            await LiveStreamService.sendChatMessage(streamConfig.streamId, {
                sender: 'System',
                message: 'Stream ending in 5 seconds...',
                type: 'system'
            });

            // Stop the stream
            await LiveStreamService.stopStream(streamConfig.streamId);
            console.log('✅ Stopped chat interaction stream');

            console.log('\n🎉 Chat & Interaction Example completed!');

        } catch (error) {
            console.error('❌ Error in chat interaction example:', error);
        }
    }

    /**
     * Run all examples
     */
    static async runAllExamples(): Promise<void> {
        console.log('🚀 Starting All Live Stream Examples...\n');

        await this.runCompleteStreamExample();
        console.log('\n' + '='.repeat(60) + '\n');

        await this.runMultipleStreamsExample();
        console.log('\n' + '='.repeat(60) + '\n');

        await this.runQualityManagementExample();
        console.log('\n' + '='.repeat(60) + '\n');

        await this.runChatInteractionExample();
        console.log('\n' + '='.repeat(60) + '\n');

        console.log('🎉 All Live Stream Examples completed successfully!');
    }
}

export default StreamExample;
