import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Define tweet schema
const TweetSchema = z
  .object({
    id: z.string().describe('Unique tweet identifier'),
    text: z.string().describe('Tweet content'),
    author_id: z.string().optional().describe('Author user ID'),
    created_at: z
      .string()
      .optional()
      .describe('Creation time in ISO 8601 format'),
    public_metrics: z
      .object({
        retweet_count: z.number().optional(),
        like_count: z.number().optional(),
        reply_count: z.number().optional(),
        quote_count: z.number().optional(),
      })
      .optional()
      .describe('Public engagement metrics'),
  })
  .describe('X (Twitter) tweet metadata');

// Define user schema
const UserSchema = z
  .object({
    id: z.string().describe('Unique user identifier'),
    name: z.string().describe('User display name'),
    username: z.string().describe('User handle (without @)'),
    description: z.string().optional().describe('User bio'),
    public_metrics: z
      .object({
        followers_count: z.number().optional(),
        following_count: z.number().optional(),
        tweet_count: z.number().optional(),
        listed_count: z.number().optional(),
      })
      .optional()
      .describe('Public user metrics'),
    verified: z.boolean().optional().describe('Whether user is verified'),
  })
  .describe('X (Twitter) user metadata');

// Define the parameters schema for X Twitter operations
const XTwitterParamsSchema = z.discriminatedUnion('operation', [
  // Post tweet operation
  z.object({
    operation: z.literal('post_tweet').describe('Post a new tweet'),
    text: z
      .string()
      .min(1, 'Tweet text is required')
      .max(280, 'Tweet text cannot exceed 280 characters')
      .describe('Tweet content (max 280 characters)'),
    reply_to_tweet_id: z
      .string()
      .optional()
      .describe('ID of tweet to reply to (for replies)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get tweet operation
  z.object({
    operation: z.literal('get_tweet').describe('Get a tweet by ID'),
    tweet_id: z
      .string()
      .min(1, 'Tweet ID is required')
      .describe('X (Twitter) tweet ID'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get user info operation
  z.object({
    operation: z
      .literal('get_user_info')
      .describe('Get user information by username or ID'),
    username: z.string().optional().describe('Username (without @) to look up'),
    user_id: z.string().optional().describe('User ID to look up'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get user tweets operation
  z.object({
    operation: z
      .literal('get_user_tweets')
      .describe("Get a user's recent tweets"),
    username: z
      .string()
      .optional()
      .describe('Username (without @) to get tweets for'),
    user_id: z.string().optional().describe('User ID to get tweets for'),
    max_results: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe('Maximum number of tweets to return (1-100)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// Define result schemas for different operations
const XTwitterResultSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('post_tweet').describe('Post a new tweet'),
    success: z.boolean().describe('Whether the tweet was posted successfully'),
    tweet: TweetSchema.optional().describe('Posted tweet metadata'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z.literal('get_tweet').describe('Get a tweet by ID'),
    success: z
      .boolean()
      .describe('Whether the tweet was retrieved successfully'),
    tweet: TweetSchema.optional().describe('Tweet metadata'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z.literal('get_user_info').describe('Get user information'),
    success: z
      .boolean()
      .describe('Whether the user info was retrieved successfully'),
    user: UserSchema.optional().describe('User metadata'),
    error: z.string().describe('Error message if operation failed'),
  }),

  z.object({
    operation: z.literal('get_user_tweets').describe("Get a user's tweets"),
    success: z
      .boolean()
      .describe('Whether the tweets were retrieved successfully'),
    tweets: z.array(TweetSchema).optional().describe('List of tweets'),
    total_count: z
      .number()
      .optional()
      .describe('Total number of tweets returned'),
    error: z.string().describe('Error message if operation failed'),
  }),
]);

type XTwitterResult = z.output<typeof XTwitterResultSchema>;
type XTwitterParams = z.input<typeof XTwitterParamsSchema>;

// Helper type to get the result type for a specific operation
export type XTwitterOperationResult<T extends XTwitterParams['operation']> =
  Extract<XTwitterResult, { operation: T }>;

// Export the input type for external usage
export type XTwitterParamsInput = z.input<typeof XTwitterParamsSchema>;

export class XTwitterBubble<
  T extends XTwitterParams = XTwitterParams,
> extends ServiceBubble<
  T,
  Extract<XTwitterResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'x-twitter';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'x-twitter';
  static readonly schema = XTwitterParamsSchema;
  static readonly resultSchema = XTwitterResultSchema;
  static readonly shortDescription = 'X (Twitter) integration for social media';
  static readonly longDescription = `
    X (Twitter) service integration for social media operations.
    Use cases:
    - Post tweets
    - Read tweets by ID
    - Get user information
    - Get user's recent tweets
    
    Security Features:
    - OAuth 2.0 authentication with X (Twitter)
    - Scoped access permissions
    - Secure token handling
  `;
  static readonly alias = 'twitter';
  constructor(
    params: T = {
      operation: 'get_user_info',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    const credential = this.chooseCredential();
    if (!credential) {
      throw new Error('X (Twitter) credentials are required');
    }
    try {
      // Test the credentials by making a simple API call
      const response = await fetch(
        'https://api.twitter.com/2/users/me?user.fields=id,name,username',
        {
          headers: {
            Authorization: `Bearer ${credential}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  private async makeTwitterApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<any> {
    const url = endpoint.startsWith('https://')
      ? endpoint
      : `https://api.twitter.com/2${endpoint}`;

    const requestHeaders = {
      Authorization: `Bearer ${this.chooseCredential()}`,
      'Content-Type': 'application/json',
    };

    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method === 'POST') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `X (Twitter) API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<XTwitterResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<XTwitterResult> => {
        switch (operation) {
          case 'post_tweet':
            return await this.postTweet(this.params);
          case 'get_tweet':
            return await this.getTweet(this.params);
          case 'get_user_info':
            return await this.getUserInfo(this.params);
          case 'get_user_tweets':
            return await this.getUserTweets(this.params);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<XTwitterResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<XTwitterResult, { operation: T['operation'] }>;
    }
  }

  private async postTweet(
    params: Extract<XTwitterParams, { operation: 'post_tweet' }>
  ): Promise<Extract<XTwitterResult, { operation: 'post_tweet' }>> {
    try {
      const { text, reply_to_tweet_id } = params;

      const requestBody: any = {
        text,
      };

      if (reply_to_tweet_id) {
        requestBody.reply = {
          in_reply_to_tweet_id: reply_to_tweet_id,
        };
      }

      const response = await this.makeTwitterApiRequest(
        '/tweets',
        'POST',
        requestBody
      );

      // Fetch the created tweet details with all fields
      const tweetId = response.data.id;
      const tweetResponse = await this.makeTwitterApiRequest(
        `/tweets/${tweetId}?tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=id`
      );

      const tweetData = tweetResponse.data;

      return {
        operation: 'post_tweet',
        success: true,
        tweet: {
          id: tweetData.id,
          text: tweetData.text,
          author_id: tweetData.author_id,
          created_at: tweetData.created_at,
          public_metrics: tweetData.public_metrics,
        },
        error: '',
      };
    } catch (error) {
      let errorMessage = 'Unknown error occurred during tweet posting';

      if (error instanceof Error) {
        errorMessage = error.message;

        if (errorMessage.includes('401')) {
          errorMessage =
            'Authentication failed. Please check your X (Twitter) credentials.';
        } else if (errorMessage.includes('403')) {
          errorMessage =
            'Permission denied. Please ensure you have write access.';
        } else if (errorMessage.includes('429')) {
          errorMessage =
            'Rate limit exceeded. Please wait before posting again.';
        }
      }

      return {
        operation: 'post_tweet',
        success: false,
        tweet: undefined,
        error: errorMessage,
      };
    }
  }

  private async getTweet(
    params: Extract<XTwitterParams, { operation: 'get_tweet' }>
  ): Promise<Extract<XTwitterResult, { operation: 'get_tweet' }>> {
    try {
      const { tweet_id } = params;

      const response = await this.makeTwitterApiRequest(
        `/tweets/${tweet_id}?tweet.fields=created_at,public_metrics,author_id`
      );

      return {
        operation: 'get_tweet',
        success: true,
        tweet: {
          id: response.data.id,
          text: response.data.text,
          author_id: response.data.author_id,
          created_at: response.data.created_at,
          public_metrics: response.data.public_metrics,
        },
        error: '',
      };
    } catch (error) {
      let errorMessage = 'Unknown error occurred while fetching tweet';

      if (error instanceof Error) {
        errorMessage = error.message;

        if (errorMessage.includes('404')) {
          errorMessage = 'Tweet not found. Please check the tweet ID.';
        } else if (errorMessage.includes('401')) {
          errorMessage =
            'Authentication failed. Please check your X (Twitter) credentials.';
        }
      }

      return {
        operation: 'get_tweet',
        success: false,
        tweet: undefined,
        error: errorMessage,
      };
    }
  }

  private async getUserInfo(
    params: Extract<XTwitterParams, { operation: 'get_user_info' }>
  ): Promise<Extract<XTwitterResult, { operation: 'get_user_info' }>> {
    try {
      const { username, user_id } = params;

      if (!username && !user_id) {
        throw new Error('Either username or user_id is required');
      }

      let endpoint: string;
      if (username) {
        endpoint = `/users/by/username/${username}?user.fields=description,public_metrics,verified`;
      } else {
        endpoint = `/users/${user_id}?user.fields=description,public_metrics,verified`;
      }

      const response = await this.makeTwitterApiRequest(endpoint);

      return {
        operation: 'get_user_info',
        success: true,
        user: {
          id: response.data.id,
          name: response.data.name,
          username: response.data.username,
          description: response.data.description,
          public_metrics: response.data.public_metrics,
          verified: response.data.verified,
        },
        error: '',
      };
    } catch (error) {
      let errorMessage = 'Unknown error occurred while fetching user info';

      if (error instanceof Error) {
        errorMessage = error.message;

        if (errorMessage.includes('404')) {
          errorMessage =
            'User not found. Please check the username or user ID.';
        } else if (errorMessage.includes('401')) {
          errorMessage =
            'Authentication failed. Please check your X (Twitter) credentials.';
        }
      }

      return {
        operation: 'get_user_info',
        success: false,
        user: undefined,
        error: errorMessage,
      };
    }
  }

  private async getUserTweets(
    params: Extract<XTwitterParams, { operation: 'get_user_tweets' }>
  ): Promise<Extract<XTwitterResult, { operation: 'get_user_tweets' }>> {
    try {
      const { username, user_id, max_results } = params;

      if (!username && !user_id) {
        throw new Error('Either username or user_id is required');
      }

      // First get user ID if only username provided
      let actualUserId: string;
      if (username && !user_id) {
        const userResponse = await this.makeTwitterApiRequest(
          `/users/by/username/${username}`
        );
        actualUserId = userResponse.data.id;
      } else {
        actualUserId = user_id!;
      }

      const response = await this.makeTwitterApiRequest(
        `/users/${actualUserId}/tweets?max_results=${max_results}&tweet.fields=created_at,public_metrics,author_id`
      );

      const tweets =
        response.data?.map((tweet: any) => ({
          id: tweet.id,
          text: tweet.text,
          author_id: tweet.author_id,
          created_at: tweet.created_at,
          public_metrics: tweet.public_metrics,
        })) || [];

      return {
        operation: 'get_user_tweets',
        success: true,
        tweets,
        total_count: tweets.length,
        error: '',
      };
    } catch (error) {
      let errorMessage = 'Unknown error occurred while fetching user tweets';

      if (error instanceof Error) {
        errorMessage = error.message;

        if (errorMessage.includes('404')) {
          errorMessage =
            'User not found. Please check the username or user ID.';
        } else if (errorMessage.includes('401')) {
          errorMessage =
            'Authentication failed. Please check your X (Twitter) credentials.';
        }
      }

      return {
        operation: 'get_user_tweets',
        success: false,
        tweets: undefined,
        total_count: 0,
        error: errorMessage,
      };
    }
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No X (Twitter) credentials provided');
    }

    // X Twitter bubble uses X_TWITTER_CRED credentials
    return credentials[CredentialType.X_TWITTER_CRED];
  }
}
