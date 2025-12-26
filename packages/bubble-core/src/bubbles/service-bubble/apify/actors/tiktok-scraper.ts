import { z } from 'zod';

export const TikTokScraperInputSchema = z.object({
  hashtags: z
    .array(z.string())
    .optional()
    .describe('Hashtags to scrape posts from. Examples: ["tech", "ai"]'),

  resultsPerPage: z
    .number()
    .min(1)
    .default(1)
    .optional()
    .describe(
      'Number of videos per hashtag, profile, or search query (default: 1)'
    ),

  profiles: z
    .array(z.string())
    .optional()
    .describe(
      'TikTok usernames to scrape. Examples: ["username1", "username2"]'
    ),

  profileScrapeSections: z
    .array(z.enum(['videos', 'reposts']))
    .default(['videos'])
    .optional()
    .describe('Profile sections to scrape (default: ["videos"])'),

  profileSorting: z
    .enum(['latest', 'popular', 'oldest'])
    .default('latest')
    .optional()
    .describe(
      'Profile video sorting: latest, popular, or oldest (default: "latest")'
    ),

  excludePinnedPosts: z
    .boolean()
    .default(false)
    .optional()
    .describe('Exclude pinned posts from profiles (default: false)'),

  oldestPostDateUnified: z
    .string()
    .optional()
    .describe('Date filter - scrape profile videos published after this date'),

  newestPostDate: z
    .string()
    .optional()
    .describe('Date filter - scrape profile videos published before this date'),

  mostDiggs: z
    .number()
    .optional()
    .describe(
      'Popularity filter - scrape videos with hearts less than this number'
    ),

  leastDiggs: z
    .number()
    .optional()
    .describe(
      'Popularity filter - scrape videos with hearts greater than or equal to this number'
    ),

  maxFollowersPerProfile: z
    .number()
    .optional()
    .describe('Maximum number of followers profiles to scrape'),

  maxFollowingPerProfile: z
    .number()
    .optional()
    .describe('Maximum number of following profiles to scrape'),

  searchQueries: z
    .array(z.string())
    .optional()
    .describe('Search queries to find TikTok videos and profiles'),

  searchSection: z
    .enum(['', '/video', '/user'])
    .default('')
    .optional()
    .describe(
      'Search section: empty for top, "/video" for videos, "/user" for profiles (default: "")'
    ),

  maxProfilesPerQuery: z
    .number()
    .default(10)
    .optional()
    .describe('Number of profiles per search query (default: 10)'),

  searchSorting: z
    .enum(['0', '1', '3'])
    .default('0')
    .optional()
    .describe('Search sorting for videos (default: "0")'),

  searchDatePosted: z
    .enum(['0', '1', '2', '3', '4', '5'])
    .default('0')
    .optional()
    .describe('Search date filter for videos (default: "0")'),

  postURLs: z
    .array(z.string())
    .optional()
    .describe('Direct TikTok video URLs to scrape'),

  scrapeRelatedVideos: z
    .boolean()
    .default(false)
    .optional()
    .describe('Scrape related videos for post URLs (default: false)'),

  shouldDownloadVideos: z
    .boolean()
    .default(false)
    .optional()
    .describe('Download TikTok videos (charged add-on, default: false)'),

  shouldDownloadCovers: z
    .boolean()
    .default(false)
    .optional()
    .describe('Download video cover images/thumbnails (default: false)'),

  shouldDownloadSubtitles: z
    .boolean()
    .default(false)
    .optional()
    .describe('Download video subtitles when available (default: false)'),

  shouldDownloadSlideshowImages: z
    .boolean()
    .default(false)
    .optional()
    .describe('Download slideshow images (default: false)'),

  shouldDownloadAvatars: z
    .boolean()
    .default(false)
    .optional()
    .describe('Download profile avatars (default: false)'),

  shouldDownloadMusicCovers: z
    .boolean()
    .default(false)
    .optional()
    .describe('Download sound cover images (default: false)'),

  videoKvStoreIdOrName: z
    .string()
    .optional()
    .describe('Name or ID of Key Value Store for videos and media'),

  commentsPerPost: z
    .number()
    .optional()
    .describe('Maximum comments to extract per post'),

  maxRepliesPerComment: z
    .number()
    .optional()
    .describe('Maximum replies per comment'),

  proxyCountryCode: z
    .enum([
      'None',
      'AF',
      'AL',
      'DZ',
      'AS',
      'AD',
      'AO',
      'AI',
      'AG',
      'AR',
      'AM',
      'AU',
      'AT',
      'AZ',
      'BS',
      'BH',
      'BD',
      'BB',
      'BY',
      'BE',
      'BZ',
      'BJ',
      'BM',
      'BT',
      'BO',
      'BA',
      'BW',
      'BR',
      'VG',
      'BN',
      'BG',
      'BF',
      'BI',
      'KH',
      'CM',
      'CA',
      'CV',
      'KY',
      'TD',
      'CL',
      'CO',
      'CK',
      'CR',
      'HR',
      'CY',
      'CZ',
      'CD',
      'DK',
      'DJ',
      'DO',
      'EC',
      'EG',
      'SV',
      'EE',
      'ET',
      'FK',
      'FJ',
      'FI',
      'FR',
      'PF',
      'GA',
      'GE',
      'DE',
      'GH',
      'GI',
      'GR',
      'GL',
      'GD',
      'GP',
      'GT',
      'GN',
      'GW',
      'GY',
      'HN',
      'HK',
      'HU',
      'IS',
      'IN',
      'ID',
      'IQ',
      'IE',
      'IM',
      'IL',
      'IT',
      'CI',
      'JM',
      'JP',
      'JE',
      'KZ',
      'KE',
      'XK',
      'KW',
      'LA',
      'LV',
      'LB',
      'LS',
      'LR',
      'LY',
      'LT',
      'LU',
      'MO',
      'MG',
      'MW',
      'MY',
      'MV',
      'ML',
      'MT',
      'MH',
      'MQ',
      'MR',
      'MU',
      'MX',
      'MD',
      'MC',
      'MN',
      'ME',
      'MA',
      'MZ',
      'MM',
      'NA',
      'NR',
      'NP',
      'NL',
      'NZ',
      'NI',
      'NG',
      'MK',
      'NO',
      'OM',
      'PK',
      'PS',
      'PA',
      'PG',
      'PY',
      'PE',
      'PH',
      'PL',
      'PT',
      'PR',
      'QA',
      'CG',
      'RO',
      'RU',
      'RW',
      'RE',
      'KN',
      'LC',
      'MF',
      'PM',
      'VC',
      'SM',
      'SA',
      'SN',
      'RS',
      'SL',
      'SG',
      'SX',
      'SK',
      'SB',
      'SO',
      'ZA',
      'KR',
      'ES',
      'LK',
      'SR',
      'SZ',
      'SE',
      'CH',
      'TW',
      'TJ',
      'TZ',
      'TH',
      'TG',
      'TO',
      'TT',
      'TN',
      'TR',
      'TM',
      'TC',
      'TV',
      'VI',
      'UG',
      'UA',
      'AE',
      'GB',
      'US',
      'UY',
      'VE',
      'VN',
      'WF',
      'YE',
      'ZM',
      'ZW',
      'AX',
    ])
    .default('None')
    .optional()
    .describe('Proxy country code (default: "None")'),
});

const TikTokAuthorMetaSchema = z.object({
  avatar: z.string().optional().describe('Author avatar URL'),

  bioLink: z.null().optional().describe('Bio link (typically null)'),

  digg: z.number().optional().describe('Number of likes given by author'),

  fans: z.number().optional().describe('Number of followers'),

  followDatasetUrl: z
    .null()
    .optional()
    .describe('Follow dataset URL (typically null)'),

  following: z.number().optional().describe('Number of following'),

  friends: z.number().optional().describe('Number of friends'),

  heart: z.number().optional().describe('Total likes received'),

  id: z.string().optional().describe('Author user ID'),

  name: z.string().optional().describe('Author username'),

  nickName: z.string().optional().describe('Author display name'),

  originalAvatarUrl: z.string().optional().describe('Original avatar URL'),

  privateAccount: z.boolean().optional().describe('Whether account is private'),

  profileUrl: z.string().optional().describe('Author profile URL'),

  signature: z.string().optional().describe('Author bio/signature'),

  verified: z.boolean().optional().describe('Whether author is verified'),

  video: z.number().optional().describe('Total number of videos'),
});

const TikTokMusicMetaSchema = z.object({
  coverMediumUrl: z.string().optional().describe('Music cover medium URL'),

  musicAuthor: z.string().optional().describe('Music author name'),

  musicId: z.string().optional().describe('Music ID'),

  musicName: z.string().optional().describe('Music title'),

  musicOriginal: z.boolean().optional().describe('Whether music is original'),

  originalCoverMediumUrl: z
    .string()
    .optional()
    .describe('Original cover medium URL'),

  playUrl: z.string().optional().describe('Music play URL'),
});

const TikTokSubtitleLinkSchema = z.object({
  language: z.string().optional().describe('Subtitle language code'),

  downloadLink: z.string().optional().describe('Subtitle download URL'),

  tiktokLink: z.string().optional().describe('TikTok subtitle URL'),

  source: z.string().optional().describe('Subtitle source abbreviation'),

  sourceUnabbreviated: z
    .string()
    .optional()
    .describe('Subtitle source full name'),

  version: z.string().optional().describe('Subtitle version'),
});

const TikTokVideoMetaSchema = z.object({
  coverUrl: z.string().optional().describe('Video cover URL'),

  definition: z.string().optional().describe('Video definition/quality'),

  duration: z.number().optional().describe('Video duration in seconds'),

  format: z.string().optional().describe('Video format'),

  height: z.number().optional().describe('Video height'),

  originalCoverUrl: z.string().optional().describe('Original cover URL'),

  subtitleLinks: z
    .array(TikTokSubtitleLinkSchema)
    .optional()
    .describe('Subtitle links'),

  width: z.number().optional().describe('Video width'),
});

const TikTokHashtagSchema = z.object({
  name: z.string().optional().describe('Hashtag name'),
});

const TikTokEffectStickerSchema = z.object({
  ID: z.string().optional().describe('Effect sticker ID'),

  name: z.string().optional().describe('Effect sticker name'),

  stickerStats: z
    .object({
      useCount: z
        .number()
        .optional()
        .describe('Number of times sticker was used'),
    })
    .optional()
    .describe('Sticker usage statistics'),
});

const TikTokDetailedMentionSchema = z.object({
  id: z.string().optional().describe('Mentioned user ID'),

  name: z.string().optional().describe('Mentioned username'),

  nickName: z.string().optional().describe('Mentioned user display name'),

  profileUrl: z.string().optional().describe('Mentioned user profile URL'),
});

const TikTokSearchHashtagSchema = z.object({
  name: z.string().optional().describe('Hashtag name'),

  views: z.number().optional().describe('Number of views for hashtag'),
});

export const TikTokVideoSchema = z.object({
  authorMeta: TikTokAuthorMetaSchema.optional().describe(
    'Video author information'
  ),

  collectCount: z
    .number()
    .optional()
    .describe('Number of times collected/saved'),

  commentCount: z.number().optional().describe('Number of comments'),

  commentsDatasetUrl: z
    .null()
    .optional()
    .describe('Comments dataset URL (typically null)'),

  createTime: z.number().optional().describe('Creation timestamp'),

  createTimeISO: z.string().optional().describe('Creation time (ISO format)'),

  detailedMentions: z
    .array(TikTokDetailedMentionSchema)
    .optional()
    .describe('Detailed mentions array'),

  diggCount: z.number().optional().describe('Number of likes'),

  effectStickers: z
    .array(TikTokEffectStickerSchema)
    .optional()
    .describe('Effect stickers used'),

  hashtags: z
    .array(TikTokHashtagSchema)
    .optional()
    .describe('Hashtags used in the video'),

  id: z.string().optional().describe('Video ID'),

  input: z.string().optional().describe('Input used for scraping'),

  isAd: z.boolean().optional().describe('Whether this is a promoted video'),

  isPinned: z.boolean().optional().describe('Whether video is pinned'),

  isSlideshow: z.boolean().optional().describe('Whether this is a slideshow'),

  isSponsored: z.boolean().optional().describe('Whether video is sponsored'),

  mediaUrls: z.array(z.string()).optional().describe('Media URLs'),

  mentions: z
    .array(z.string())
    .optional()
    .describe('User mentions in the video'),

  musicMeta: TikTokMusicMetaSchema.optional().describe(
    'Background music information'
  ),

  playCount: z.number().optional().describe('Number of plays/views'),

  repostCount: z.number().optional().describe('Number of reposts'),

  searchHashtag: TikTokSearchHashtagSchema.optional().describe(
    'Search hashtag information'
  ),

  shareCount: z.number().optional().describe('Number of shares'),

  text: z.string().optional().describe('Video caption/description'),

  textLanguage: z.string().optional().describe('Language of the text'),

  videoMeta: TikTokVideoMetaSchema.optional().describe('Video metadata'),

  webVideoUrl: z.string().optional().describe('Web video URL'),
});

export type TikTokScraperInput = z.output<typeof TikTokScraperInputSchema>;
export type TikTokVideo = z.output<typeof TikTokVideoSchema>;
