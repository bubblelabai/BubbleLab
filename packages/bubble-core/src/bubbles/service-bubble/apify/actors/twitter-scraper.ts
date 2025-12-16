import { z } from 'zod';

export const TwitterScraperInputSchema = z.object({
  searchTerms: z
    .array(z.string())
    .optional()
    .describe('Keywords or hashtags to search for on Twitter/X'),

  twitterHandles: z
    .array(z.string())
    .optional()
    .describe(
      'Twitter/X usernames to scrape (without @ symbol). Examples: ["elonmusk", "openai"]'
    ),

  urls: z
    .array(z.string())
    .optional()
    .describe('Direct URLs to tweets, profiles, or search results'),

  tweetsDesired: z
    .number()
    .min(1)
    .max(1000)
    .default(100)
    .optional()
    .describe('Maximum number of tweets to scrape per query (default: 100)'),

  maxItems: z
    .number()
    .min(1)
    .max(1000)
    .default(100)
    .optional()
    .describe('Maximum total items to scrape'),

  onlyImage: z
    .boolean()
    .default(false)
    .optional()
    .describe('Filter to only tweets with images'),

  onlyVideo: z
    .boolean()
    .default(false)
    .optional()
    .describe('Filter to only tweets with videos'),

  onlyQuote: z
    .boolean()
    .default(false)
    .optional()
    .describe('Filter to only quote tweets'),

  onlyVerifiedUsers: z
    .boolean()
    .default(false)
    .optional()
    .describe('Filter to only verified users'),

  onlyTwitterBlue: z
    .boolean()
    .default(false)
    .optional()
    .describe('Filter to only Twitter Blue subscribers'),

  sort: z
    .enum(['Latest', 'Top', 'People', 'Photos', 'Videos'])
    .optional()
    .describe('Sort order for search results'),

  startDate: z
    .string()
    .optional()
    .describe('Start date for search (YYYY-MM-DD format)'),

  endDate: z
    .string()
    .optional()
    .describe('End date for search (YYYY-MM-DD format)'),
});

const TwitterUserSchema = z.object({
  id: z.string().optional().describe('User ID'),

  name: z.string().optional().describe('User display name'),

  userName: z.string().optional().describe('User handle (username)'),

  description: z.string().optional().describe('User bio'),

  isVerified: z.boolean().optional().describe('Whether user is verified'),

  isBlueVerified: z
    .boolean()
    .optional()
    .describe('Whether user has Twitter Blue'),

  profilePicture: z.string().optional().describe('Profile picture URL'),

  followers: z.number().optional().describe('Number of followers'),

  following: z.number().optional().describe('Number of following'),

  tweetsCount: z.number().optional().describe('Total number of tweets'),

  url: z.string().optional().describe('Profile URL'),

  createdAt: z.string().optional().describe('Account creation date'),
});

const TwitterMediaSchema = z.object({
  type: z
    .enum(['photo', 'video', 'animated_gif'])
    .optional()
    .describe('Media type'),

  url: z.string().optional().describe('Media URL'),

  width: z.number().optional().describe('Media width'),

  height: z.number().optional().describe('Media height'),

  duration: z
    .number()
    .optional()
    .describe('Duration for videos (milliseconds)'),
});

const TwitterEntitySchema = z.object({
  hashtags: z
    .array(
      z.object({
        text: z.string().optional(),
      })
    )
    .optional()
    .describe('Hashtags in the tweet'),

  urls: z
    .array(
      z.object({
        url: z.string().optional(),
        expandedUrl: z.string().optional(),
        displayUrl: z.string().optional(),
      })
    )
    .optional()
    .describe('URLs in the tweet'),

  userMentions: z
    .array(
      z.object({
        screenName: z.string().optional(),
        name: z.string().optional(),
      })
    )
    .optional()
    .describe('User mentions in the tweet'),
});

export const TwitterTweetSchema = z.object({
  id: z.string().optional().describe('Tweet ID'),

  url: z.string().optional().describe('Tweet URL'),

  text: z.string().optional().describe('Tweet text content'),

  author: TwitterUserSchema.optional().describe('Tweet author information'),

  createdAt: z.string().optional().describe('Tweet creation date (ISO format)'),

  retweetCount: z.number().optional().describe('Number of retweets'),

  replyCount: z.number().optional().describe('Number of replies'),

  likeCount: z.number().optional().describe('Number of likes'),

  quoteCount: z.number().optional().describe('Number of quote tweets'),

  viewCount: z.number().optional().describe('Number of views'),

  bookmarkCount: z.number().optional().describe('Number of bookmarks'),

  lang: z.string().optional().describe('Tweet language code'),

  media: z.array(TwitterMediaSchema).optional().describe('Media attachments'),

  entities: TwitterEntitySchema.optional().describe('Tweet entities'),

  isRetweet: z.boolean().optional().describe('Whether this is a retweet'),

  isQuote: z.boolean().optional().describe('Whether this is a quote tweet'),

  isReply: z.boolean().optional().describe('Whether this is a reply'),

  inReplyToStatusId: z
    .string()
    .optional()
    .describe('ID of tweet being replied to'),

  quotedTweet: z
    .object({
      id: z.string().optional(),
      text: z.string().optional(),
      author: TwitterUserSchema.optional(),
    })
    .optional()
    .describe('Quoted tweet information'),

  retweetedTweet: z
    .object({
      id: z.string().optional(),
      text: z.string().optional(),
      author: TwitterUserSchema.optional(),
    })
    .optional()
    .describe('Retweeted tweet information'),
});

export type TwitterScraperInput = z.output<typeof TwitterScraperInputSchema>;
export type TwitterTweet = z.output<typeof TwitterTweetSchema>;
