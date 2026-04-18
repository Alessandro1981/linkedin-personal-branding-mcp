export interface ProfileMetadata {
  full_name: string;
  linkedin_url: string;
  extracted_at: string;
  source: 'linkedin_playwright_mcp';
}

export interface BrandingContext {
  target_positioning: string;
  core_topics: string[];
  tone_of_voice: string;
  audience: string[];
  do_not_emphasize: string[];
}

export interface ProfileCore {
  headline: string;
  location: string;
  industry: string;
  about: string;
}

export interface ExperienceItem {
  company: string;
  role: string;
  employment_type: string;
  start_date: string;
  end_date: string;
  location: string;
  description: string;
  highlights: string[];
}

export interface EducationItem {
  school: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date: string;
  description: string;
}

export interface CertificationItem {
  name: string;
  issuer: string;
  issue_date: string;
  credential_id: string;
}

export interface FeaturedItem {
  type: 'post' | 'article' | 'link' | 'media';
  title: string;
  url: string;
  date: string;
  summary: string;
}

export interface RecentPostItem {
  date: string;
  url: string;
  text: string;
  engagement_hint: string;
}

export interface LinkedInProfileExport {
  profile_metadata: ProfileMetadata;
  branding_context: BrandingContext;
  profile_core: ProfileCore;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  certifications: CertificationItem[];
  languages: LanguageItem[];
  featured: FeaturedItem[];
  recent_posts: RecentPostItem[];
}


export interface CertificationItem {
  name: string;
  issuer: string;
  issue_date: string;
  credential_id: string;
}

export interface LanguageItem {
  name: string;
  proficiency: string;
}