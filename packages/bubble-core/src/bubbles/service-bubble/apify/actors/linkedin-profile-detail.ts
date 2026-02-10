import { z } from 'zod';

// ============================================================================
// LINKEDIN PROFILE DETAIL SCRAPER SCHEMAS
// ============================================================================

export const LinkedInProfileDetailInputSchema = z.object({
  profileScraperMode: z
    .string()
    .default('Profile details no email ($4 per 1k)')
    .describe('Scraper mode - use "Profile details no email ($4 per 1k)"'),

  queries: z
    .array(z.string().min(1))
    .min(1, 'At least one LinkedIn profile URL is required')
    .describe(
      'Array of LinkedIn profile URLs (e.g., "https://www.linkedin.com/in/williamhgates")'
    ),
});

// Date schema used across experience, education, projects, etc.
const ProfileDateSchema = z.object({
  month: z.string().optional().describe('Month name (e.g., "Jan", "May")'),
  year: z.number().optional().describe('Year (e.g., 2024)'),
  text: z
    .string()
    .optional()
    .describe('Formatted date text (e.g., "Jan 2024")'),
});

// Location schema
const ProfileLocationSchema = z.object({
  linkedinText: z
    .string()
    .optional()
    .describe('Location as displayed on LinkedIn'),
  countryCode: z.string().optional().describe('ISO country code'),
  parsed: z
    .object({
      text: z.string().optional().describe('Parsed location text'),
      countryCode: z
        .string()
        .nullable()
        .optional()
        .describe('Parsed country code'),
      regionCode: z
        .string()
        .nullable()
        .optional()
        .describe('Parsed region code'),
      country: z.string().optional().describe('Country name'),
      countryFull: z.string().optional().describe('Full country name'),
      state: z.string().optional().describe('State or region'),
      city: z.string().optional().describe('City name'),
    })
    .optional()
    .describe('Parsed location components'),
});

// Experience schema
const ProfileExperienceSchema = z.object({
  position: z.string().optional().describe('Job title/position'),
  location: z.string().optional().describe('Job location'),
  employmentType: z
    .string()
    .nullable()
    .optional()
    .describe('Employment type (Full-time, Part-time, Internship, etc.)'),
  workplaceType: z
    .string()
    .nullable()
    .optional()
    .describe('Workplace type (On-site, Remote, Hybrid)'),
  companyName: z.string().optional().describe('Company name'),
  companyLinkedinUrl: z.string().optional().describe('Company LinkedIn URL'),
  companyId: z.string().optional().describe('Company LinkedIn ID'),
  companyUniversalName: z
    .string()
    .optional()
    .describe('Company universal name slug'),
  duration: z
    .string()
    .optional()
    .describe('Duration text (e.g., "1 yr 7 mos")'),
  description: z.string().optional().describe('Role description'),
  skills: z
    .array(z.string())
    .optional()
    .describe('Skills associated with this role'),
  startDate: ProfileDateSchema.optional().describe('Start date'),
  endDate: ProfileDateSchema.optional().describe('End date'),
});

// Education schema
const ProfileEducationSchema = z.object({
  schoolName: z.string().optional().describe('School/university name'),
  schoolLinkedinUrl: z.string().optional().describe('School LinkedIn URL'),
  degree: z.string().optional().describe('Degree type'),
  fieldOfStudy: z.string().nullable().optional().describe('Field of study'),
  skills: z.array(z.string()).optional().describe('Skills from this education'),
  startDate: ProfileDateSchema.optional().describe('Start date'),
  endDate: ProfileDateSchema.optional().describe('End date'),
  period: z
    .string()
    .optional()
    .describe('Period text (e.g., "Aug 2018 - May 2022")'),
});

// Certification schema
const ProfileCertificationSchema = z.object({
  title: z.string().optional().describe('Certification title'),
  issuedAt: z.string().optional().describe('Issue date text'),
  issuedBy: z.string().optional().describe('Issuing organization'),
  issuedByLink: z
    .string()
    .optional()
    .describe('Issuing organization LinkedIn URL'),
});

// Project schema
const ProfileProjectSchema = z.object({
  title: z.string().optional().describe('Project title'),
  description: z.string().optional().describe('Project description'),
  duration: z.string().optional().describe('Duration text'),
  startDate: ProfileDateSchema.optional().describe('Start date'),
  endDate: ProfileDateSchema.optional().describe('End date'),
});

// Volunteering schema
const ProfileVolunteeringSchema = z.object({
  role: z.string().optional().describe('Volunteer role'),
  duration: z.string().optional().describe('Duration text'),
  startDate: ProfileDateSchema.nullable().optional().describe('Start date'),
  endDate: ProfileDateSchema.optional().describe('End date'),
  organizationName: z.string().optional().describe('Organization name'),
  organizationLinkedinUrl: z
    .string()
    .nullable()
    .optional()
    .describe('Organization LinkedIn URL'),
  cause: z.string().optional().describe('Cause category'),
});

// Skill schema
const ProfileSkillSchema = z.object({
  name: z.string().optional().describe('Skill name'),
  positions: z
    .array(z.string())
    .optional()
    .describe('Positions where skill is used'),
  endorsements: z.string().optional().describe('Endorsement count text'),
});

// Publication schema
const ProfilePublicationSchema = z.object({
  title: z.string().optional().describe('Publication title'),
  publishedAt: z.string().optional().describe('Publication info'),
  link: z.string().optional().describe('Publication URL'),
});

// Honor/Award schema
const ProfileHonorSchema = z.object({
  title: z.string().optional().describe('Award title'),
  issuedBy: z.string().optional().describe('Issuing organization'),
  issuedAt: z.string().optional().describe('Issue date'),
  description: z.string().optional().describe('Award description'),
  associatedWith: z.string().optional().describe('Associated institution text'),
  associatedWithLink: z
    .string()
    .optional()
    .describe('Associated institution URL'),
});

// Language schema
const ProfileLanguageSchema = z.object({
  name: z.string().optional().describe('Language name'),
  proficiency: z.string().optional().describe('Proficiency level'),
});

// Course schema
const ProfileCourseSchema = z.object({
  title: z.string().optional().describe('Course title'),
  associatedWith: z.string().optional().describe('Associated institution text'),
  associatedWithLink: z
    .string()
    .optional()
    .describe('Associated institution URL'),
});

// More profiles (related) schema
const MoreProfileSchema = z.object({
  id: z.string().optional().describe('Profile ID'),
  firstName: z.string().optional().describe('First name'),
  lastName: z.string().optional().describe('Last name'),
  position: z.string().optional().describe('Current position'),
  publicIdentifier: z.string().optional().describe('Public identifier/slug'),
  linkedinUrl: z.string().optional().describe('LinkedIn profile URL'),
});

// Output schema - what the actor returns per profile
export const LinkedInProfileDetailOutputSchema = z.object({
  id: z.string().optional().describe('LinkedIn member ID'),
  publicIdentifier: z
    .string()
    .optional()
    .describe('Public profile identifier/slug'),
  linkedinUrl: z.string().optional().describe('Full LinkedIn profile URL'),
  firstName: z.string().optional().describe('First name'),
  lastName: z.string().optional().describe('Last name'),
  headline: z.string().optional().describe('Profile headline'),
  about: z.string().optional().describe('About/summary section'),
  openToWork: z.boolean().optional().describe('Whether open to work'),
  hiring: z.boolean().optional().describe('Whether actively hiring'),
  photo: z.string().optional().describe('Profile photo URL'),
  premium: z.boolean().optional().describe('Whether premium subscriber'),
  influencer: z.boolean().optional().describe('Whether LinkedIn influencer'),
  location: ProfileLocationSchema.optional().describe('Location information'),
  verified: z.boolean().optional().describe('Whether profile is verified'),
  registeredAt: z
    .string()
    .optional()
    .describe('Account registration date (ISO)'),
  topSkills: z.string().optional().describe('Top skills summary text'),
  connectionsCount: z.number().optional().describe('Number of connections'),
  followerCount: z.number().optional().describe('Number of followers'),
  currentPosition: z
    .array(z.object({ companyName: z.string().optional() }))
    .optional()
    .describe('Current position(s)'),
  experience: z
    .array(ProfileExperienceSchema)
    .optional()
    .describe('Work experience history'),
  education: z
    .array(ProfileEducationSchema)
    .optional()
    .describe('Education history'),
  certifications: z
    .array(ProfileCertificationSchema)
    .optional()
    .describe('Certifications'),
  projects: z.array(ProfileProjectSchema).optional().describe('Projects'),
  volunteering: z
    .array(ProfileVolunteeringSchema)
    .optional()
    .describe('Volunteering experience'),
  skills: z.array(ProfileSkillSchema).optional().describe('Skills list'),
  courses: z.array(ProfileCourseSchema).optional().describe('Courses'),
  publications: z
    .array(ProfilePublicationSchema)
    .optional()
    .describe('Publications'),
  patents: z.array(z.any()).optional().describe('Patents'),
  honorsAndAwards: z
    .array(ProfileHonorSchema)
    .optional()
    .describe('Honors and awards'),
  languages: z.array(ProfileLanguageSchema).optional().describe('Languages'),
  featured: z.any().nullable().optional().describe('Featured section'),
  moreProfiles: z
    .array(MoreProfileSchema)
    .optional()
    .describe('Related/similar profiles'),
  query: z
    .object({
      publicIdentifier: z.string().optional(),
      profileId: z.string().optional(),
    })
    .optional()
    .describe('Original query info'),
  status: z.number().optional().describe('HTTP status code'),
  entityId: z.string().optional().describe('Entity ID'),
  requestId: z.string().optional().describe('Request ID'),
});

// Export types
export type LinkedInProfileDetailInput = z.output<
  typeof LinkedInProfileDetailInputSchema
>;
export type LinkedInProfileDetailOutput = z.output<
  typeof LinkedInProfileDetailOutputSchema
>;
