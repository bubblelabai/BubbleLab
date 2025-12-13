-- Add onboarding_completed column to users table
ALTER TABLE `users` ADD COLUMN `onboarding_completed` integer DEFAULT false NOT NULL;
