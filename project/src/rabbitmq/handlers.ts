import * as rabbitmq from './client';
import * as db from '../db';
import fetch from 'node-fetch';
import { Activity, FollowActivity, CreateActivity } from '../types/activitypub';
import * as activitypub from '../utils/activitypub';
import crypto from 'crypto';

const DOMAIN = process.env.DOMAIN || 'localhost:3000';
// Initialize RabbitMQ connection
export async function connectRabbitMQ() {
  await rabbitmq.connect();
  console.log('RabbitMQ connected');
}

// Publish message to inbox processing queue
export async function publishToInbox(userId: string, inboxItemId: string) {
  const channel = await rabbitmq.getChannel();
  await channel.sendToQueue(
    rabbitmq.INBOX_QUEUE,
    Buffer.from(JSON.stringify({ userId, inboxItemId })),
    { persistent: true }
  );
}

// Publish message to outbox processing queue
export async function publishToOutbox(userId: string, outboxItemId: string) {
  const channel = await rabbitmq.getChannel();
  await channel.sendToQueue(
    rabbitmq.OUTBOX_QUEUE,
    Buffer.from(JSON.stringify({ userId, outboxItemId })),
    { persistent: true }
  );
}

// Process inbox messages consumer
export async function startInboxConsumer() {
  const channel = await rabbitmq.getChannel();
  
  // Consume messages from the inbox queue
  await channel.consume(rabbitmq.INBOX_QUEUE, async (msg) => {
    if (!msg) return;
    
    try {
      const data = JSON.parse(msg.content.toString());
      const { userId, inboxItemId } = data;
      
      // Retrieve the activity from the database
      const inboxItem = await db.getInboxItemById(inboxItemId);
      if (!inboxItem) {
        console.error(`Inbox item with ID ${inboxItemId} not found`);
        channel.ack(msg); // Acknowledge to prevent requeuing
        return;
      }
      
      // Parse the activity from the JSON stored in the database
      const activity = inboxItem.activity
      
      console.log('Processing inbox activity:', activity.type);
      console.log('Inbox item ID:', inboxItemId);
      
      // Process different activity types
      switch (activity.type) {
        case 'Create':
          await handleCreateActivity(activity as CreateActivity);
          break;
        case 'Follow':
          await handleFollowActivity(activity as FollowActivity);
          break;
        case 'Accept':
          await handleAcceptActivity(activity);
          break;
        case 'Undo':
          await handleUndoActivity(activity);
          break;
        default:
          console.log(`Unhandled activity type: ${activity.type}`);
      }
      
      // Mark as processed using the database row ID
      if (inboxItemId) {
        await db.markInboxItemProcessed(inboxItemId);
        console.log(`Marked inbox item ${inboxItemId} as processed`);
      } else {
        console.warn('No inbox item ID provided, skipping database update');
      }
      
      // Acknowledge the message was processed
      channel.ack(msg);
    } catch (error) {
      console.error('Error processing inbox message:', error);
      
      // Reject the message and requeue it
      channel.nack(msg, false, true);
    }
  }, { noAck: false });
  
  console.log('Inbox consumer started');
}

// Process outbox messages consumer
export async function startOutboxConsumer() {
  const channel = await rabbitmq.getChannel();
  
  // Consume messages from the outbox queue
  await channel.consume(rabbitmq.OUTBOX_QUEUE, async (msg) => {
    if (!msg) return;
    
    try {
      const { userId, outboxItemId } = JSON.parse(msg.content.toString());
      
      // Retrieve the activity from the database
      const outboxItem = await db.getOutboxItemById(outboxItemId);
      if (!outboxItem) {
        console.error(`Outbox item with ID ${outboxItemId} not found`);
        channel.ack(msg); // Acknowledge to prevent requeuing
        return;
      }
      
      // Parse the activity from the JSON stored in the database
      const activity = outboxItem.activity
      
      console.log('Processing outbox activity:', activity.type);
      console.log('Outbox item ID:', outboxItemId);
      
      // Get user info for sending out messages
      const user = await db.getUserById(userId);
      if (!user) {
        console.error('User not found for outbox activity');
        channel.ack(msg); // Acknowledge even if user not found to avoid requeuing
        return;
      }
      
      // Get followers to deliver to
      const followers = await db.getFollowers(userId);
      
      // Send activity to each follower's inbox
      for (const follower of followers) {
        try {
          let inboxUrl: string;
          
          try {
            // First try to fetch the actor object to get the proper inbox URL
            console.log(`Fetching actor info from: ${follower.follower_actor_id}`);
            const actorResponse = await fetch(follower.follower_actor_id, {
              headers: { 'Accept': 'application/json' }
            });
            
            if (actorResponse.ok) {
              const actorData = await actorResponse.json() as { inbox?: string };
              
              if (actorData.inbox) {
                inboxUrl = actorData.inbox;
                console.log(`Found inbox URL in actor object: ${inboxUrl}`);
              } else {
                // Actor object exists but doesn't have inbox
                throw new Error(`Actor object does not have an inbox property`);
              }
            } else {
              // Actor endpoint not available
              throw new Error(`Failed to fetch actor: ${actorResponse.status}`);
            }
          } catch (error) {
            // Fallback: construct inbox URL by appending /inbox to the actor ID
            const actorError = error as Error;
            console.log(`Could not fetch actor object: ${actorError.message}`);
            console.log(`Falling back to ${follower.follower_actor_id}/inbox`);
            inboxUrl = `${follower.follower_actor_id}/inbox`;
          }
          
          // Deliver the activity to the resolved inbox URL
          await deliverToRemoteInbox(inboxUrl, activity, user);
        } catch (error) {
          console.error(`Error delivering to ${follower.follower_actor_id}:`, error);
        }
      }
      
      // Mark as processed using the database row ID
      if (outboxItemId) {
        await db.markOutboxItemProcessed(outboxItemId);
        console.log(`Marked outbox item ${outboxItemId} as processed`);
      } else {
        console.warn('No outbox item ID provided, skipping database update');
      }
      
      // Acknowledge the message was processed
      channel.ack(msg);
    } catch (error) {
      console.error('Error processing outbox message:', error);
      
      // Reject the message and requeue it
      channel.nack(msg, false, true);
    }

    console.log('Outbox consumer started');
  }, { noAck: false });
  
  console.log('Outbox consumer started');
}

// Activity handlers
async function handleCreateActivity(activity: CreateActivity) {
  if (activity.object?.type !== 'Note') {
    console.log('Create activity object is not a Note, ignoring');
    return;
  }
  
  // We could store remote notes if desired, but for this example we'll just log
  console.log('Received Note:', activity.object.content);
}

async function handleFollowActivity(activity: FollowActivity) {
  // Extract username from object URL
  const targetUrl = activity.object.toString();
  const match = targetUrl.match(/\/users\/([^/]+)$/);
  
  if (!match) {
    console.error('Could not parse username from Follow activity target:', targetUrl);
    return;
  }
  
  const username = match[1];
  const user = await db.getUserByUsername(username);
  
  if (!user) {
    console.error('User not found for Follow activity:', username);
    return;
  }
  
  // Record the follow
  await db.addFollower(user.id, activity.actor);
  
  // Create Accept activity
  const acceptActivity = activitypub.createAcceptActivity(targetUrl, activity);
  
  // Add to outbox
  const outboxItem = await db.addOutboxItem(user.id, acceptActivity);
  
  // Process immediately
  await publishToOutbox(user.id, outboxItem.id);
}

async function handleAcceptActivity(activity: Activity) {
  // Extract our user from context
  if (typeof activity.object !== 'object' || !activity.object.actor || !activity.object.object) {
    console.error('Invalid Accept activity:', activity);
    return;
  }
  
  const ourActorUrl = activity.object.actor.toString();
  const match = ourActorUrl.match(/\/users\/([^/]+)$/);
  
  if (!match) {
    console.error('Could not parse username from our actor URL:', ourActorUrl);
    return;
  }
  
  const username = match[1];
  const user = await db.getUserByUsername(username);
  
  if (!user) {
    console.error('User not found for Accept activity:', username);
    return;
  }
  
  // Update following status to accepted
  await db.addFollowing(user.id, activity.actor, true);
}

// Handle Undo activities (used for unfollowing)
async function handleUndoActivity(activity: Activity) {
  // Check if this is an Undo of a Follow
  if (typeof activity.object !== 'object' || !activity.object.type || activity.object.type !== 'Follow') {
    console.log('Undo activity is not for a Follow, ignoring');
    return;
  }
  
  // Extract the follow details
  const followActivity = activity.object;
  
  if (!followActivity.object) {
    console.error('Invalid Undo Follow activity, missing object:', followActivity);
    return;
  }
  console.log("undo", followActivity)
  // Handle based on the direction of the follow
  if (typeof followActivity.object === 'string') {
    // Someone is unfollowing one of our users
    const targetUrl = followActivity.object.toString();
    const match = targetUrl.match(/\/users\/([^/]+)$/);
    
    if (!match) {
      console.error('Could not parse username from Undo Follow activity target:', targetUrl);
      return;
    }
    
    const username = match[1];
    const user = await db.getUserByUsername(username);
    
    if (!user) {
      console.error('User not found for Undo Follow activity:', username);
      return;
    }
    
    // Remove the follower relationship
    // When someone unfollows our user, they are removed from our user's followers list
    await db.removeFollower(user.id, activity.actor);
    console.log(`Removed follower ${activity.actor} from user ${username}`);
  } else if (followActivity.actor && followActivity.object.id) {
    // Our user is unfollowing someone else
    const ourActorUrl = followActivity.actor.toString();
    const match = ourActorUrl.match(/\/users\/([^/]+)$/);
    
    if (!match) {
      console.error('Could not parse username from our actor URL:', ourActorUrl);
      return;
    }
    
    const username = match[1];
    console.log(username)
    const user = await db.getUserByUsername(username);
    
    if (!user) {
      console.error('User not found for our Undo Follow activity:', username);
      return;
    }
    
    // Remove the following relationship
    // When our user unfollows someone, that person is removed from our user's following list
    await db.removeFollowing(user.id, followActivity.object.id);
    console.log(`Removed following ${followActivity.object.id} from user ${username}`);
  } else {
    console.error('Could not determine follow direction from Undo activity:', activity);
  }
}

// Helper function to deliver activities to remote inboxes
async function deliverToRemoteInbox(inboxUrl: string, activity: Activity, user: any) {  
  // Prepare the request body
  const body = JSON.stringify(activity);
  
  // Create digest
  const digest = `SHA-256=${crypto
    .createHash('sha256')
    .update(body)
    .digest('base64')}`;
  
  // Generate signature
  const { signature, date } = await activitypub.generateSignatureHeader(
    'POST',
    inboxUrl,
    digest,
    user.id
  );
  
  // Send the request
  const response = await fetch(inboxUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Digest': digest,
      'Date': date,
      'Signature': signature,
      'Host': new URL(inboxUrl).host,
      'Accept': 'application/json'
    },
    body
  });
  
  if (!response.ok) {
    console.error(`Error delivering to ${inboxUrl}: ${response.status} ${response.statusText}`);
    throw new Error(`Failed to deliver to inbox: ${response.status}`);
  }
  
  return response;
}
