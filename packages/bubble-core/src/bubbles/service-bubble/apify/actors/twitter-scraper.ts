import { z } from 'zod';

export const TwitterScraperInputSchema = z.object({
  startUrls: z
    .array(z.string())
    .optional()
    .describe(
      'Twitter (X) URLs. Paste the URLs and get the results immediately. Tweet, Profile, Search or List URLs are supported.'
    ),

  searchTerms: z
    .array(z.string())
    .optional()
    .describe(
      'Search terms you want to search from Twitter (X). You can refer to https://github.com/igorbrigadir/twitter-advanced-search.'
    ),

  twitterHandles: z
    .array(z.string())
    .optional()
    .describe('Twitter handles that you want to search on Twitter (X)'),

  conversationIds: z
    .array(z.string())
    .optional()
    .describe('Conversation IDs that you want to search on Twitter (X)'),

  maxItems: z
    .number()
    .optional()
    .describe('Maximum number of items that you want as output.'),

  sort: z
    .enum(['Top', 'Latest'])
    .optional()
    .describe(
      'Sorts search results by the given option. Only works with search terms and search URLs.'
    ),

  tweetLanguage: z
    .enum([
      'ab',
      'aa',
      'af',
      'ak',
      'sq',
      'am',
      'ar',
      'an',
      'hy',
      'as',
      'av',
      'ae',
      'ay',
      'az',
      'bm',
      'ba',
      'eu',
      'be',
      'bn',
      'bi',
      'bs',
      'br',
      'bg',
      'my',
      'ca',
      'ch',
      'ce',
      'ny',
      'zh',
      'cu',
      'cv',
      'kw',
      'co',
      'cr',
      'hr',
      'cs',
      'da',
      'dv',
      'nl',
      'dz',
      'en',
      'eo',
      'et',
      'ee',
      'fo',
      'fj',
      'fi',
      'fr',
      'fy',
      'ff',
      'gd',
      'gl',
      'lg',
      'ka',
      'de',
      'el',
      'kl',
      'gn',
      'gu',
      'ht',
      'ha',
      'he',
      'hz',
      'hi',
      'ho',
      'hu',
      'is',
      'io',
      'ig',
      'id',
      'ia',
      'ie',
      'iu',
      'ik',
      'ga',
      'it',
      'ja',
      'jv',
      'kn',
      'kr',
      'ks',
      'kk',
      'km',
      'ki',
      'rw',
      'ky',
      'kv',
      'kg',
      'ko',
      'kj',
      'ku',
      'lo',
      'la',
      'lv',
      'li',
      'ln',
      'lt',
      'lu',
      'lb',
      'mk',
      'mg',
      'ms',
      'ml',
      'mt',
      'gv',
      'mi',
      'mr',
      'mh',
      'mn',
      'na',
      'nv',
      'nd',
      'nr',
      'ng',
      'ne',
      'no',
      'nb',
      'nn',
      'ii',
      'oc',
      'oj',
      'or',
      'om',
      'os',
      'pi',
      'ps',
      'fa',
      'pl',
      'pt',
      'pa',
      'qu',
      'ro',
      'rm',
      'rn',
      'ru',
      'se',
      'sm',
      'sg',
      'sa',
      'sc',
      'sr',
      'sn',
      'sd',
      'si',
      'sk',
      'sl',
      'so',
      'st',
      'es',
      'su',
      'sw',
      'ss',
      'sv',
      'tl',
      'ty',
      'tg',
      'ta',
      'tt',
      'te',
      'th',
      'bo',
      'ti',
      'to',
      'ts',
      'tn',
      'tr',
      'tk',
      'tw',
      'ug',
      'uk',
      'ur',
      'uz',
      've',
      'vi',
      'vo',
      'wa',
      'cy',
      'wo',
      'xh',
      'yi',
      'yo',
      'za',
      'zu',
    ])
    .optional()
    .describe(
      'Restricts tweets to the given language, given by an ISO 639-1 code.'
    ),
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

  media: z
    .array(z.union([z.string(), TwitterMediaSchema]))
    .optional()
    .describe('Media attachments (can be URLs or media objects)'),

  entities: TwitterEntitySchema.optional().describe('Tweet entities'),

  isRetweet: z.boolean().optional().describe('Whether this is a retweet'),

  isQuote: z.boolean().optional().describe('Whether this is a quote tweet'),

  isReply: z.boolean().optional().describe('Whether this is a reply'),
});

export type TwitterScraperInput = z.output<typeof TwitterScraperInputSchema>;
export type TwitterTweet = z.output<typeof TwitterTweetSchema>;
