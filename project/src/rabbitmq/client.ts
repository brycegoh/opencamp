import amqp, { ChannelModel, Channel } from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const INBOX_QUEUE = 'activitypub-inbox';
const OUTBOX_QUEUE = 'activitypub-outbox';

// Track connection instances
let connection: ChannelModel | null = null;
let channel: Channel | null = null;

/**
 * Connects to RabbitMQ and creates a channel
 */
export async function connect(): Promise<{ connection: ChannelModel; channel: Channel }> {
  try {
    // Create a new connection if one doesn't exist
    if (!connection) {
      connection = await amqp.connect(RABBITMQ_URL);
      
      // Handle connection closure
      connection.on('close', () => {
        console.log('RabbitMQ connection closed');
        connection = null;
        channel = null;
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
          connect().catch(e => console.error('Reconnection failed:', e));
        }, 5000);
      });
    }
    
    // Create a channel if one doesn't exist
    if (!channel && connection) {
      channel = await (connection as any).createChannel();
      
      // Ensure queues exist
      if (channel) {
        await channel.assertQueue(INBOX_QUEUE, { durable: true });
        await channel.assertQueue(OUTBOX_QUEUE, { durable: true });
        console.log('RabbitMQ connection established');
      }
    }
    
    // Verify both connection and channel are available
    if (!connection || !channel) {
      throw new Error('Failed to establish RabbitMQ connection or channel');
    }
    
    return { connection, channel };
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    
    // Clear references
    connection = null;
    channel = null;
    
    // Attempt to reconnect after a delay
    setTimeout(() => {
      connect().catch(e => console.error('Reconnection failed:', e));
    }, 5000);
    
    throw error;
  }
}

/**
 * Gets an existing channel or creates a new one
 */
export async function getChannel(): Promise<Channel> {
  if (!channel) {
    const result = await connect();
    return result.channel;
  }
  
  return channel;
}

export { INBOX_QUEUE, OUTBOX_QUEUE };